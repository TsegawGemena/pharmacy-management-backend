import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { prisma } from "../../db/prisma";
import {
  decimalStr,
  logActivity,
  paginatedMeta,
  parsePage,
} from "../../utils/helpers";

export const addStockSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  batchNo: z.string().min(1),
  stock: z.number().int(),
  minStock: z.number().int().min(0),
  maxStock: z.number().int().optional(),
  expiryDate: z.string().min(1),
  unitPrice: z.union([z.string(), z.number()]),
  location: z.string().optional(),
});

export const updateStockSchema = z.object({
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().nullable().optional(),
  location: z.string().nullable().optional(),
  stock: z.number().int().optional(),
  quantity: z.number().int().optional(),
  unitPrice: z.union([z.string(), z.number()]).optional(),
  expiryDate: z.string().optional(),
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
  unitPrice: Prisma.Decimal;
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
    unitPrice: decimalStr(batch.unitPrice),
  };
}

function generateSku(name: string) {
  const prefix =
    name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "PRD";
  return `${prefix}-${Date.now().toString().slice(-5)}`;
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

export async function addStock(
  raw: unknown,
  userId?: string
) {
  const input = addStockSchema.parse(raw);
  const leadDays = await getExpiryLeadDays();

  let product = await prisma.product.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: input.name,
        category: input.category,
        sku: generateSku(input.name),
        manufacturer: "",
        price: new Prisma.Decimal(input.unitPrice),
        status: "Active",
      },
    });
  }

  const existingBatch = await prisma.inventoryBatch.findUnique({
    where: {
      productId_batchNo: { productId: product.id, batchNo: input.batchNo },
    },
  });

  let batch;
  if (existingBatch) {
    batch = await prisma.inventoryBatch.update({
      where: { id: existingBatch.id },
      data: {
        quantity: existingBatch.quantity + input.stock,
        minStock: input.minStock,
        maxStock: input.maxStock ?? existingBatch.maxStock,
        expiryDate: new Date(input.expiryDate),
        unitPrice: new Prisma.Decimal(input.unitPrice),
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
        unitPrice: new Prisma.Decimal(input.unitPrice),
        location: input.location,
      },
      include: { product: { select: { name: true, category: true } } },
    });
  }

  await logActivity({
    userId,
    action: "ADD_STOCK",
    entity: "InventoryBatch",
    entityId: batch.id,
    details: `${product.name} ${input.batchNo} +${input.stock}`,
  });

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
  const batch = await prisma.inventoryBatch.update({
    where: { id },
    data: {
      ...(input.minStock !== undefined && { minStock: input.minStock }),
      ...(input.maxStock !== undefined && { maxStock: input.maxStock }),
      ...(input.location !== undefined && { location: input.location }),
      ...(qty !== undefined && { quantity: qty }),
      ...(input.unitPrice !== undefined && {
        unitPrice: new Prisma.Decimal(input.unitPrice),
      }),
      ...(input.expiryDate !== undefined && {
        expiryDate: new Date(input.expiryDate),
      }),
    },
    include: { product: { select: { name: true, category: true } } },
  });

  await logActivity({
    userId,
    action: "UPDATE_STOCK",
    entity: "InventoryBatch",
    entityId: id,
  });

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
