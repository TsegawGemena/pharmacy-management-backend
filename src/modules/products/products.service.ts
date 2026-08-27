import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { prisma } from "../../db/prisma";
import {
  decimalStr,
  logActivity,
  paginatedMeta,
  parsePage,
  productStock,
} from "../../utils/helpers";
import { ensureCategory } from "../categories/categories.service";
import { createStockNotification } from "../notifications/notifications.service";

const money = z.coerce.number().min(0, "Price must be >= 0");

export const createProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  sku: z.string().optional(),
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
  status: z.enum(["Active", "Inactive"]).optional(),
  /** Catalog selling price shown in product list / POS */
  price: z.union([z.string(), z.number()]).optional(),
  sellingPrice: money.optional(),
});

function generateSku(name: string) {
  const prefix =
    name
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 3)
      .toUpperCase() || "PRD";
  return `${prefix}-${Date.now().toString().slice(-5)}`;
}

async function mapProduct(p: {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: Prisma.Decimal;
  status: string;
}) {
  const stock = await productStock(p.id);
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    sku: p.sku,
    price: decimalStr(p.price),
    sellingPrice: decimalStr(p.price),
    stock,
    status: p.status,
  };
}

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
      ...(nextPrice !== undefined && { price: nextPrice }),
      ...(input.status !== undefined && { status: input.status }),
    },
  });

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
