import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { prisma } from "../../db/prisma";
import {
  decimalStr,
  deductStockFefo,
  logActivity,
  paginatedMeta,
  parsePage,
  productStock,
} from "../../utils/helpers";
import { ensureCategory } from "../categories/categories.service";
import { createStockNotification } from "../notifications/notifications.service";

const money = z.coerce.number().min(0, "Price must be >= 0");
const DRUG_UNITS = [
  "Units",
  "Tablets",
  "Capsules",
  "Bottles",
  "Boxes",
  "Packs",
  "Sachets",
  "Vials",
  "Tubes",
  "ml",
] as const;

export const createProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  sku: z.string().optional(),
  unit: z.string().min(1).optional().default("Units"),
  status: z.enum(["Active", "Inactive"]).optional().default("Active"),
  // Initial stock
  quantity: z.coerce.number().int().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(), // alias
  batchNo: z.string().optional(),
  expiryDate: z.string().optional(),
  // Pricing (batch-level; product.price stores current selling price for POS)
  purchasePrice: money,
  sellingPrice: money,
  priceValidFrom: z.string().optional(),
  priceValidUntil: z.string().optional().nullable(),
  // Legacy alias accepted but not preferred
  price: z.union([z.string(), z.number()]).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  sku: z.string().optional(),
  unit: z.string().min(1).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  /** Catalog selling price shown in product list / POS */
  price: z.union([z.string(), z.number()]).optional(),
  sellingPrice: money.optional(),
  /** Set absolute on-hand quantity (edits inventory batches). */
  quantity: z.coerce.number().int().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  /** Required when increasing absolute stock from zero / adding a new batch. */
  expiryDate: z.string().optional(),
  purchasePrice: money.optional(),
});

function generateSku(name: string) {
  const prefix =
    name
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 3)
      .toUpperCase() || "PRD";
  return `${prefix}-${Date.now().toString().slice(-5)}`;
}

function normalizeUnit(unit?: string | null) {
  const value = (unit || "Units").trim() || "Units";
  return value;
}

async function mapProduct(p: {
  id: string;
  name: string;
  category: string;
  sku: string;
  unit?: string | null;
  price: Prisma.Decimal;
  status: string;
}) {
  const stock = await productStock(p.id);
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    sku: p.sku,
    unit: normalizeUnit(p.unit),
    price: decimalStr(p.price),
    sellingPrice: decimalStr(p.price),
    stock,
    status: p.status,
  };
}

async function setAbsoluteStock(
  productId: string,
  productName: string,
  targetQty: number,
  opts: {
    expiryDate?: string;
    purchasePrice?: number;
    sellingPrice?: number;
    userId?: string;
  }
) {
  const before = await productStock(productId);
  if (targetQty === before) return;

  if (targetQty > before) {
    const add = targetQty - before;
    if (before === 0 && !opts.expiryDate) {
      throw new AppError(
        "Expiry date is required when setting stock for a product with no inventory",
        400
      );
    }
    const batches = await prisma.inventoryBatch.findMany({
      where: { productId },
      orderBy: { expiryDate: "asc" },
    });
    if (batches.length > 0) {
      await prisma.inventoryBatch.update({
        where: { id: batches[0].id },
        data: { quantity: batches[0].quantity + add },
      });
    } else {
      const expiry = opts.expiryDate
        ? new Date(opts.expiryDate)
        : (() => {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 2);
            return d;
          })();
      const purchase = opts.purchasePrice ?? opts.sellingPrice ?? 0;
      const selling = opts.sellingPrice ?? opts.purchasePrice ?? 0;
      await prisma.inventoryBatch.create({
        data: {
          productId,
          batchNo: `ADJ-${Date.now().toString().slice(-6)}`,
          quantity: add,
          minStock: 10,
          maxStock: Math.max(add * 2, 100),
          expiryDate: expiry,
          purchasePrice: new Prisma.Decimal(purchase),
          sellingPrice: new Prisma.Decimal(selling),
          priceEffectiveFrom: new Date(),
        },
      });
    }
  } else {
    await prisma.$transaction(async (tx) => {
      await deductStockFefo(tx, productId, before - targetQty);
    });
  }

  const after = await productStock(productId);
  await createStockNotification({
    type: "UPDATE_STOCK",
    title: "Stock updated",
    message: `${productName} stock was set from ${before} to ${after}.`,
    productId,
    productName,
    quantityChange: after - before,
    quantityBefore: before,
    quantityAfter: after,
    actorId: opts.userId,
  });
}

export { DRUG_UNITS };

export async function listProducts(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePage(query);
  const where: Prisma.ProductWhereInput = {};

  if (typeof query.q === "string" && query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { sku: { contains: query.q, mode: "insensitive" } },
      { category: { contains: query.q, mode: "insensitive" } },
    ];
  }
  if (typeof query.category === "string" && query.category) {
    where.category = query.category;
  }
  if (typeof query.status === "string" && query.status) {
    where.status = query.status as "Active" | "Inactive";
  }

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
    }),
  ]);

  const data = await Promise.all(rows.map(mapProduct));
  return { data, meta: paginatedMeta(total, page, limit) };
}

export async function getProduct(id: string) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new AppError("Product not found", 404);
  return mapProduct(p);
}

export async function createProduct(
  input: z.infer<typeof createProductSchema>,
  userId?: string
) {
  const sku = input.sku?.trim() || generateSku(input.name);
  const existing = await prisma.product.findUnique({ where: { sku } });
  if (existing) throw new AppError("SKU already exists", 400);

  const qty = input.quantity ?? input.stock ?? 0;
  if (qty > 0 && !input.expiryDate) {
    throw new AppError("Expiry Date is required when creating initial stock", 400);
  }

  const purchasePrice = Number(input.purchasePrice);
  const sellingPrice = Number(input.sellingPrice);
  const priceValidFrom = input.priceValidFrom
    ? new Date(input.priceValidFrom)
    : new Date();
  if (Number.isNaN(priceValidFrom.getTime())) {
    throw new AppError("Invalid Price Valid From date", 400);
  }
  const priceValidUntil = input.priceValidUntil
    ? new Date(input.priceValidUntil)
    : null;
  if (priceValidUntil && Number.isNaN(priceValidUntil.getTime())) {
    throw new AppError("Invalid Price Valid Until date", 400);
  }

  await ensureCategory(input.category);

  const product = await prisma.product.create({
    data: {
      name: input.name,
      category: input.category.trim(),
      sku,
      unit: normalizeUnit(input.unit),
      price: new Prisma.Decimal(sellingPrice),
      status: input.status || "Active",
    },
  });

  if (qty > 0) {
    const batchNo =
      input.batchNo?.trim() || `BX-${Date.now().toString().slice(-6)}`;
    await prisma.inventoryBatch.create({
      data: {
        productId: product.id,
        batchNo,
        quantity: qty,
        minStock: 10,
        maxStock: Math.max(qty * 2, 100),
        expiryDate: new Date(input.expiryDate!),
        purchasePrice: new Prisma.Decimal(purchasePrice),
        sellingPrice: new Prisma.Decimal(sellingPrice),
        priceEffectiveFrom: priceValidFrom,
        priceEffectiveUntil: priceValidUntil,
      },
    });

    await createStockNotification({
      type: "ADD_STOCK",
      title: "New stock added",
      message: `${product.name} was restocked. +${qty} units added.`,
      productId: product.id,
      productName: product.name,
      quantityChange: qty,
      quantityBefore: 0,
      quantityAfter: qty,
      batchNo,
      actorId: userId,
    });
  }

  await logActivity({
    userId,
    action: "CREATE_PRODUCT",
    entity: "Product",
    entityId: product.id,
    details: product.name,
  });

  return mapProduct(product);
}

export async function updateProduct(
  id: string,
  input: z.infer<typeof updateProductSchema>,
  userId?: string
) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError("Product not found", 404);

  if (input.sku && input.sku !== existing.sku) {
    const taken = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (taken) throw new AppError("SKU already exists", 400);
  }

  if (input.category) {
    await ensureCategory(input.category);
  }

  const nextPrice =
    input.sellingPrice !== undefined
      ? new Prisma.Decimal(input.sellingPrice)
      : input.price !== undefined
        ? new Prisma.Decimal(input.price)
        : undefined;

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.category !== undefined && { category: input.category.trim() }),
      ...(input.sku !== undefined && { sku: input.sku }),
      ...(input.unit !== undefined && { unit: normalizeUnit(input.unit) }),
      ...(nextPrice !== undefined && { price: nextPrice }),
      ...(input.status !== undefined && { status: input.status }),
    },
  });

  const absoluteStock =
    input.stock !== undefined
      ? input.stock
      : input.quantity !== undefined
        ? input.quantity
        : undefined;

  if (absoluteStock !== undefined) {
    await setAbsoluteStock(id, product.name, absoluteStock, {
      expiryDate: input.expiryDate,
      purchasePrice: input.purchasePrice,
      sellingPrice:
        input.sellingPrice !== undefined
          ? input.sellingPrice
          : nextPrice !== undefined
            ? Number(nextPrice)
            : Number(product.price),
      userId,
    });
  }

  await logActivity({
    userId,
    action: "UPDATE_PRODUCT",
    entity: "Product",
    entityId: id,
  });

  return mapProduct(product);
}

export async function deleteProduct(id: string, userId?: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError("Product not found", 404);

  await prisma.product.update({
    where: { id },
    data: { status: "Inactive" },
  });

  await logActivity({
    userId,
    action: "DEACTIVATE_PRODUCT",
    entity: "Product",
    entityId: id,
  });

  return { message: "Product deactivated" };
}
