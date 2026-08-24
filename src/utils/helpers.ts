/**
 * Shared helpers for modules
 */
import { prisma } from "../db/prisma";
import { Prisma } from "@prisma/client";

export function decimalStr(value: Prisma.Decimal | number | string): string {
  return Number(value).toFixed(2);
}

export function toNumber(value: Prisma.Decimal | number | string): number {
  return Number(value);
}

export function parsePage(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginatedMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function logActivity(input: {
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
}) {
  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      details: input.details,
    },
  });
}

export async function nextCode(prefix: string, model: "supplier" | "adjustment" | "invoice" | "po") {
  const year = new Date().getFullYear();
  if (model === "supplier") {
    const count = await prisma.supplier.count();
    return `SUP-${String(count + 1).padStart(3, "0")}`;
  }
  if (model === "adjustment") {
    const count = await prisma.stockAdjustment.count();
    return `#ADJ-${String(count + 1).padStart(3, "0")}`;
  }
  if (model === "invoice") {
    const count = await prisma.invoice.count();
    return `INV-${year}-${String(count + 1).padStart(4, "0")}`;
  }
  const count = await prisma.purchaseOrder.count();
  return `PO-${year}-${String(count + 1).padStart(4, "0")}`;
}

/** Sum stock across batches for a product */
export async function productStock(productId: string): Promise<number> {
  const agg = await prisma.inventoryBatch.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

/**
 * FEFO stock deduction: earliest expiry first.
 * Throws if insufficient stock.
 */
export async function deductStockFefo(
  tx: Prisma.TransactionClient,
  productId: string,
  qty: number
) {
  const batches = await tx.inventoryBatch.findMany({
    where: { productId, quantity: { gt: 0 } },
    orderBy: { expiryDate: "asc" },
  });

  let remaining = qty;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    await tx.inventoryBatch.update({
      where: { id: batch.id },
      data: { quantity: batch.quantity - take },
    });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error("Insufficient stock");
  }
}
