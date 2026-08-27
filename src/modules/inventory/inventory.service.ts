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

const money = z.coerce.number().min(0);

export const addStockSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  batchNo: z.string().min(1),
  stock: z.number().int(),
  minStock: z.number().int().min(0),
  maxStock: z.number().int().optional(),
  expiryDate: z.string().min(1),
  purchasePrice: money.optional(),
  sellingPrice: money.optional(),
  /** @deprecated use purchasePrice */
  unitPrice: z.union([z.string(), z.number()]).optional(),
  priceValidFrom: z.string().optional(),
  priceValidUntil: z.string().optional().nullable(),
  location: z.string().optional(),
});

export const updateStockSchema = z.object({
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().nullable().optional(),
  location: z.string().nullable().optional(),
  stock: z.number().int().optional(),
  quantity: z.number().int().optional(),
  purchasePrice: money.optional(),
  sellingPrice: money.optional(),
  unitPrice: z.union([z.string(), z.number()]).optional(),
  expiryDate: z.string().optional(),
  priceValidFrom: z.string().optional(),
  priceValidUntil: z.string().optional().nullable(),
});

export const restockSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  purchasePrice: money.optional(),
  sellingPrice: money.optional(),
  unitPrice: z.union([z.string(), z.number()]).optional(),
  batchNo: z.string().optional(),
  expiryDate: z.string().optional(),
  priceValidFrom: z.string().optional(),
  priceValidUntil: z.string().optional().nullable(),
  minStock: z.number().int().min(0).optional(),
});

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

async function getExpiryLeadDays(): Promise<number> {
  const settings = await prisma.expiryAlertSettings.findUnique({
    where: { id: "default" },
  });
  return settings?.leadDays ?? 90;
}

async function getCriticalUnits(): Promise<number> {
  const settings = await prisma.stockAlertSettings.findUnique({
    where: { id: "default" },
  });
  return settings?.criticalUnits ?? 20;
}

type BatchWithProduct = {
  id: string;
  batchNo: string;
  quantity: number;
  minStock: number;
  maxStock: number | null;
  expiryDate: Date;
  purchasePrice: Prisma.Decimal;
  sellingPrice: Prisma.Decimal;
  priceEffectiveFrom: Date;
  priceEffectiveUntil: Date | null;
  product: { name: string; category: string };
};

async function mapBatch(batch: BatchWithProduct, leadDays: number) {
  const threshold = daysFromNow(leadDays);
  return {
    id: batch.id,
    name: batch.product.name,
    category: batch.product.category,
    batchNo: batch.batchNo,
    stock: batch.quantity,
    minStock: batch.minStock,
    maxStock: batch.maxStock ?? undefined,
    expiryDate: dateStr(batch.expiryDate),
    isExpiringSoon: batch.expiryDate <= threshold,
    purchasePrice: decimalStr(batch.purchasePrice),
    sellingPrice: decimalStr(batch.sellingPrice),
    priceValidFrom: dateStr(batch.priceEffectiveFrom),
    priceValidUntil: batch.priceEffectiveUntil
      ? dateStr(batch.priceEffectiveUntil)
      : null,
    /** Backward-compatible alias for existing inventory UI */
    unitPrice: decimalStr(batch.sellingPrice),
  };
}

function generateSku(name: string) {
  const prefix =
    name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "PRD";
  return `${prefix}-${Date.now().toString().slice(-5)}`;
}

function resolvePrices(input: {
  purchasePrice?: number;
  sellingPrice?: number;
  unitPrice?: string | number;
}) {
  const purchase =
    input.purchasePrice !== undefined
      ? Number(input.purchasePrice)
      : input.unitPrice !== undefined
        ? Number(input.unitPrice)
        : undefined;
  const selling =
    input.sellingPrice !== undefined
      ? Number(input.sellingPrice)
      : input.unitPrice !== undefined
        ? Number(input.unitPrice)
        : undefined;
  return { purchase, selling };
}

export async function listInventory(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePage(query);
  const where: Prisma.InventoryBatchWhereInput = {};

  if (typeof query.q === "string" && query.q) {
    where.OR = [
      { batchNo: { contains: query.q, mode: "insensitive" } },
      { product: { name: { contains: query.q, mode: "insensitive" } } },
      { product: { sku: { contains: query.q, mode: "insensitive" } } },
    ];
  }

  const leadDays = await getExpiryLeadDays();
  const [total, rows] = await Promise.all([
    prisma.inventoryBatch.count({ where }),
    prisma.inventoryBatch.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
      include: { product: { select: { name: true, category: true } } },
    }),
  ]);

  const data = await Promise.all(rows.map((b) => mapBatch(b, leadDays)));
  return { data, meta: paginatedMeta(total, page, limit) };
}

export async function addStock(raw: unknown, userId?: string) {
  const input = addStockSchema.parse(raw);
  const leadDays = await getExpiryLeadDays();
  const { purchase, selling } = resolvePrices(input);
  if (purchase === undefined || selling === undefined) {
    throw new AppError("purchasePrice and sellingPrice are required", 400);
  }

  await ensureCategory(input.category);

  let product = await prisma.product.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: input.name,
        category: input.category,
        sku: generateSku(input.name),
        price: new Prisma.Decimal(selling),
        status: "Active",
      },
    });
  }

  const priceFrom = input.priceValidFrom
    ? new Date(input.priceValidFrom)
    : new Date();
  const priceUntil = input.priceValidUntil
    ? new Date(input.priceValidUntil)
    : null;

  const existingBatch = await prisma.inventoryBatch.findUnique({
    where: {
      productId_batchNo: { productId: product.id, batchNo: input.batchNo },
    },
  });

  let batch;
  if (existingBatch) {
    // Same batch number: increase qty only — do not overwrite historical prices
    batch = await prisma.inventoryBatch.update({
      where: { id: existingBatch.id },
      data: {
        quantity: existingBatch.quantity + input.stock,
        minStock: input.minStock,
        maxStock: input.maxStock ?? existingBatch.maxStock,
        expiryDate: new Date(input.expiryDate),
        ...(input.location !== undefined && { location: input.location }),
      },
      include: { product: { select: { name: true, category: true } } },
    });
  } else {
    batch = await prisma.inventoryBatch.create({
      data: {
        productId: product.id,
        batchNo: input.batchNo,
        quantity: input.stock,
        minStock: input.minStock,
        maxStock: input.maxStock,
        expiryDate: new Date(input.expiryDate),
        purchasePrice: new Prisma.Decimal(purchase),
        sellingPrice: new Prisma.Decimal(selling),
        priceEffectiveFrom: priceFrom,
        priceEffectiveUntil: priceUntil,
        location: input.location,
      },
      include: { product: { select: { name: true, category: true } } },
    });
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { price: new Prisma.Decimal(selling) },
  });

  await logActivity({
    userId,
    action: "ADD_STOCK",
    entity: "InventoryBatch",
    entityId: batch.id,
    details: `${product.name} ${input.batchNo} +${input.stock}`,
  });

  const afterStock = await productStock(product.id);
  await createStockNotification({
    type: "ADD_STOCK",
    title: "New stock added",
    message: `${product.name} was restocked. +${input.stock} units added.`,
    productId: product.id,
    productName: product.name,
    quantityChange: input.stock,
    quantityAfter: afterStock,
    batchNo: batch.batchNo,
    actorId: userId,
  });

  return mapBatch(batch, leadDays);
}

export async function restockInventory(raw: unknown, userId?: string) {
  const input = restockSchema.parse(raw);
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
  });
  if (!product) throw new AppError("Product not found", 404);

  const { purchase, selling } = resolvePrices(input);
  const purchasePrice =
    purchase !== undefined ? purchase : Number(product.price);
  const sellingPrice =
    selling !== undefined ? selling : Number(product.price);

  const batchNo =
    input.batchNo?.trim() || `RST-${Date.now().toString().slice(-6)}`;
  const expiry = input.expiryDate
    ? new Date(input.expiryDate)
    : (() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 2);
        return d;
      })();
  const priceFrom = input.priceValidFrom
    ? new Date(input.priceValidFrom)
    : new Date();
  const priceUntil = input.priceValidUntil
    ? new Date(input.priceValidUntil)
    : null;

  const existingBatch = await prisma.inventoryBatch.findUnique({
    where: {
      productId_batchNo: { productId: product.id, batchNo },
    },
  });

  let batch;
  if (existingBatch) {
    batch = await prisma.inventoryBatch.update({
      where: { id: existingBatch.id },
      data: { quantity: existingBatch.quantity + input.quantity },
      include: { product: { select: { name: true, category: true } } },
    });
  } else {
    batch = await prisma.inventoryBatch.create({
      data: {
        productId: product.id,
        batchNo,
        quantity: input.quantity,
        minStock: input.minStock ?? 10,
        maxStock: Math.max(input.quantity * 2, 100),
        expiryDate: expiry,
        purchasePrice: new Prisma.Decimal(purchasePrice),
        sellingPrice: new Prisma.Decimal(sellingPrice),
        priceEffectiveFrom: priceFrom,
        priceEffectiveUntil: priceUntil,
      },
      include: { product: { select: { name: true, category: true } } },
    });
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { price: new Prisma.Decimal(sellingPrice) },
  });

  await logActivity({
    userId,
    action: "RESTOCK",
    entity: "InventoryBatch",
    entityId: batch.id,
    details: `${product.name} +${input.quantity}`,
  });

  const beforeStock = (await productStock(product.id)) - input.quantity;
  const afterStock = beforeStock + input.quantity;
  await createStockNotification({
    type: "RESTOCK",
    title: "Medication restocked",
    message: `${product.name} was restocked. +${input.quantity} units added.`,
    productId: product.id,
    productName: product.name,
    quantityChange: input.quantity,
    quantityBefore: Math.max(0, beforeStock),
    quantityAfter: afterStock,
    batchNo: batch.batchNo,
    actorId: userId,
  });

  const leadDays = await getExpiryLeadDays();
  return mapBatch(batch, leadDays);
}

export async function updateStock(id: string, raw: unknown, userId?: string) {
  const input = updateStockSchema.parse(raw);
  const existing = await prisma.inventoryBatch.findUnique({
    where: { id },
    include: { product: { select: { name: true, category: true } } },
  });
  if (!existing) throw new AppError("Inventory batch not found", 404);

  const qty = input.stock ?? input.quantity;
  const beforeTotal = await productStock(existing.productId);
  const { purchase, selling } = resolvePrices(input);

  const batch = await prisma.inventoryBatch.update({
    where: { id },
    data: {
      ...(input.minStock !== undefined && { minStock: input.minStock }),
      ...(input.maxStock !== undefined && { maxStock: input.maxStock }),
      ...(input.location !== undefined && { location: input.location }),
      ...(qty !== undefined && { quantity: qty }),
      ...(purchase !== undefined && {
        purchasePrice: new Prisma.Decimal(purchase),
      }),
      ...(selling !== undefined && {
        sellingPrice: new Prisma.Decimal(selling),
      }),
      ...(input.expiryDate !== undefined && {
        expiryDate: new Date(input.expiryDate),
      }),
      ...(input.priceValidFrom !== undefined && {
        priceEffectiveFrom: new Date(input.priceValidFrom),
      }),
      ...(input.priceValidUntil !== undefined && {
        priceEffectiveUntil: input.priceValidUntil
          ? new Date(input.priceValidUntil)
          : null,
      }),
    },
    include: { product: { select: { name: true, category: true } } },
  });

  if (selling !== undefined) {
    await prisma.product.update({
      where: { id: existing.productId },
      data: { price: new Prisma.Decimal(selling) },
    });
  }

  await logActivity({
    userId,
    action: "UPDATE_STOCK",
    entity: "InventoryBatch",
    entityId: id,
  });

  if (qty !== undefined && qty !== existing.quantity) {
    const afterTotal = await productStock(existing.productId);
    const productName = existing.product.name;
    await createStockNotification({
      type: "UPDATE_STOCK",
      title: "Stock updated",
      message: `${productName} stock was adjusted from ${beforeTotal} to ${afterTotal} units.`,
      productId: existing.productId,
      productName,
      quantityChange: afterTotal - beforeTotal,
      quantityBefore: beforeTotal,
      quantityAfter: afterTotal,
      batchNo: existing.batchNo,
      actorId: userId,
    });
  }

  const leadDays = await getExpiryLeadDays();
  return mapBatch(batch, leadDays);
}

export async function getAlerts() {
  const criticalUnits = await getCriticalUnits();
  const leadDays = await getExpiryLeadDays();

  const batches = await prisma.inventoryBatch.findMany({
    include: { product: { select: { name: true, category: true } } },
    orderBy: { quantity: "asc" },
  });

  const alerts = batches.filter(
    (b) => b.quantity <= criticalUnits || b.quantity <= b.minStock
  );

  return Promise.all(
    alerts.map(async (b) => {
      const item = await mapBatch(b, leadDays);
      const alertLevel =
        b.quantity <= criticalUnits ? "Critical" : "Low Stock";
      return { ...item, alertLevel };
    })
  );
}

export async function getExpiring() {
  const leadDays = await getExpiryLeadDays();
  const until = daysFromNow(leadDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const batches = await prisma.inventoryBatch.findMany({
    where: {
      expiryDate: { gte: today, lte: until },
      quantity: { gt: 0 },
    },
    include: { product: { select: { name: true, category: true } } },
    orderBy: { expiryDate: "asc" },
  });

  return Promise.all(batches.map((b) => mapBatch(b, leadDays)));
}
