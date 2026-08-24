import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { prisma } from "../../db/prisma";
import {
  logActivity,
  nextCode,
  paginatedMeta,
  parsePage,
} from "../../utils/helpers";

export const createAdjustmentSchema = z.object({
  date: z.string().min(1),
  productName: z.string().min(1),
  sku: z.string().min(1),
  type: z.string().min(1),
  qtyChange: z.number().int(),
  adjustedBy: z.string().optional(),
  status: z
    .enum(["Completed", "Pending Review"])
    .optional()
    .default("Completed"),
  reason: z.string().optional(),
});

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapAdjustment(row: {
  code: string;
  date: Date;
  productName: string;
  sku: string;
  type: string;
  qtyChange: number;
  status: string;
  reason: string | null;
  adjustedBy: { name: string } | null;
}) {
  return {
    id: row.code,
    date: dateStr(row.date),
    productName: row.productName,
    sku: row.sku,
    type: row.type,
    qtyChange: row.qtyChange,
    adjustedBy: row.adjustedBy?.name ?? "System",
    status: row.status,
    reason: row.reason ?? undefined,
  };
}

export async function listAdjustments(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePage(query);
  const where: Prisma.StockAdjustmentWhereInput = {};

  if (typeof query.q === "string" && query.q) {
    where.OR = [
      { productName: { contains: query.q, mode: "insensitive" } },
      { sku: { contains: query.q, mode: "insensitive" } },
      { code: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.stockAdjustment.count({ where }),
    prisma.stockAdjustment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { adjustedBy: { select: { name: true } } },
    }),
  ]);

  return {
    data: rows.map(mapAdjustment),
    meta: paginatedMeta(total, page, limit),
  };
}

export async function createAdjustment(raw: unknown, userId: string) {
  const input = createAdjustmentSchema.parse(raw);

  const product = await prisma.product.findUnique({
    where: { sku: input.sku },
  });
  if (!product) throw new AppError("Product not found for SKU", 404);

  const code = await nextCode("ADJ", "adjustment");

  const adjustment = await prisma.$transaction(async (tx) => {
    if (input.qtyChange !== 0) {
      if (input.qtyChange < 0) {
        let remaining = Math.abs(input.qtyChange);
        const batches = await tx.inventoryBatch.findMany({
          where: { productId: product.id, quantity: { gt: 0 } },
          orderBy: { expiryDate: "asc" },
        });
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
          throw new AppError("Insufficient stock for adjustment", 400);
        }
      } else {
        const batch = await tx.inventoryBatch.findFirst({
          where: { productId: product.id },
          orderBy: { expiryDate: "asc" },
        });
        if (batch) {
          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: { quantity: batch.quantity + input.qtyChange },
          });
        } else {
          const expiry = new Date();
          expiry.setFullYear(expiry.getFullYear() + 1);
          await tx.inventoryBatch.create({
            data: {
              productId: product.id,
              batchNo: `ADJ-${Date.now().toString().slice(-6)}`,
              quantity: input.qtyChange,
              minStock: 10,
              expiryDate: expiry,
              unitPrice: product.price,
            },
          });
        }
      }
    }

    return tx.stockAdjustment.create({
      data: {
        code,
        date: new Date(input.date),
        productName: input.productName,
        sku: input.sku,
        type: input.type,
        qtyChange: input.qtyChange,
        reason: input.reason,
        status: input.status || "Completed",
        adjustedById: userId,
      },
      include: { adjustedBy: { select: { name: true } } },
    });
  });

  await logActivity({
    userId,
    action: "CREATE_ADJUSTMENT",
    entity: "StockAdjustment",
    entityId: adjustment.id,
    details: `${code} ${input.sku} ${input.qtyChange}`,
  });

  return mapAdjustment({
    ...adjustment,
    adjustedBy: adjustment.adjustedBy ?? {
      name: input.adjustedBy || "System",
    },
  });
}
