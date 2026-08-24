import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { prisma } from "../../db/prisma";
import { calcGrandTotal } from "../../utils/vat";
import {
  decimalStr,
  logActivity,
  nextCode,
  paginatedMeta,
  parsePage,
} from "../../utils/helpers";

const poItemSchema = z.object({
  productId: z.string().optional(),
  sku: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.union([z.string(), z.number()]),
});

export const createPoSchema = z.object({
  supplier: z
    .object({
      name: z.string().min(1),
      id: z.string().optional(),
    })
    .optional(),
  supplierId: z.string().optional(),
  dateOrdered: z.string().min(1),
  expectedDelivery: z.string().min(1),
  total: z.union([z.string(), z.number()]).optional(),
  status: z
    .enum(["DRAFT", "PENDING", "SHIPPED", "RECEIVED", "CANCELLED"])
    .optional()
    .default("DRAFT"),
  paymentTerms: z.string().optional(),
  shipping: z.union([z.string(), z.number()]).optional().default(0),
  notes: z.string().optional(),
  items: z.array(poItemSchema).min(1),
});

export const updatePoSchema = createPoSchema.partial();

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isDelayed(expected: Date, status: string): boolean {
  if (status === "RECEIVED" || status === "CANCELLED") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expected < today;
}

function mapPoList(po: {
  poNumber: string;
  orderDate: Date;
  expectedDelivery: Date;
  total: Prisma.Decimal;
  status: string;
  supplier: { name: string };
}) {
  return {
    id: po.poNumber,
    supplier: { name: po.supplier.name },
    dateOrdered: dateStr(po.orderDate),
    expectedDelivery: dateStr(po.expectedDelivery),
    isDelayed: isDelayed(po.expectedDelivery, po.status),
    total: decimalStr(po.total),
    status: po.status,
  };
}

async function findPo(id: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { OR: [{ poNumber: id }, { id }] },
    include: {
      supplier: true,
      items: true,
    },
  });
  if (!po) throw new AppError("Purchase order not found", 404);
  return po;
}

function mapPoDetail(po: Awaited<ReturnType<typeof findPo>>) {
  return {
    ...mapPoList(po),
    paymentTerms: po.paymentTerms ?? undefined,
    shipping: decimalStr(po.shipping),
    subtotal: decimalStr(po.subtotal),
    vat: decimalStr(po.vat),
    notes: po.notes ?? undefined,
    items: po.items.map((i) => ({
      id: i.id,
      productId: i.productId ?? undefined,
      sku: i.sku,
      name: i.name,
      quantity: i.quantity,
      unitPrice: decimalStr(i.unitPrice),
      receivedQty: i.receivedQty,
    })),
  };
}

async function resolveSupplier(input: z.infer<typeof createPoSchema>) {
  if (input.supplierId) {
    const byId = await prisma.supplier.findFirst({
      where: { OR: [{ id: input.supplierId }, { code: input.supplierId }] },
    });
    if (byId) return byId;
  }
  if (input.supplier?.id) {
    const byId = await prisma.supplier.findFirst({
      where: { OR: [{ id: input.supplier.id }, { code: input.supplier.id }] },
    });
    if (byId) return byId;
  }
  if (input.supplier?.name) {
    const byName = await prisma.supplier.findFirst({
      where: { name: { equals: input.supplier.name, mode: "insensitive" } },
    });
    if (byName) return byName;
  }
  throw new AppError("Supplier not found", 404);
}

function calcTotals(
  items: { quantity: number; unitPrice: string | number }[],
  shipping: number
) {
  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.unitPrice) * i.quantity,
    0
  );
  const { vat, total } = calcGrandTotal(subtotal, shipping);
  return {
    subtotal: Number(subtotal.toFixed(2)),
    vat,
    total,
  };
}

export async function listPurchaseOrders(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePage(query);
  const where: Prisma.PurchaseOrderWhereInput = {};

  if (typeof query.status === "string" && query.status) {
    where.status = query.status as Prisma.EnumPurchaseOrderStatusFilter;
  }
  if (typeof query.q === "string" && query.q) {
    where.OR = [
      { poNumber: { contains: query.q, mode: "insensitive" } },
      { supplier: { name: { contains: query.q, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { supplier: { select: { name: true } } },
    }),
  ]);

  return {
    data: rows.map(mapPoList),
    meta: paginatedMeta(total, page, limit),
  };
}

export async function getPurchaseOrder(id: string) {
  const po = await findPo(id);
  return mapPoDetail(po);
}

export async function createPurchaseOrder(raw: unknown, userId?: string) {
  const input = createPoSchema.parse(raw);
  const supplier = await resolveSupplier(input);
  const shipping = Number(input.shipping || 0);
  const totals = calcTotals(input.items, shipping);
  const poNumber = await nextCode("PO", "po");

  const itemCreates: {
    productId?: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
  }[] = [];

  for (const item of input.items) {
    let productId = item.productId;
    if (!productId) {
      const p = await prisma.product.findUnique({ where: { sku: item.sku } });
      productId = p?.id;
    }
    itemCreates.push({
      productId,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: new Prisma.Decimal(item.unitPrice),
    });
  }

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: supplier.id,
      orderDate: new Date(input.dateOrdered),
      expectedDelivery: new Date(input.expectedDelivery),
      paymentTerms: input.paymentTerms,
      status: input.status || "DRAFT",
      subtotal: totals.subtotal,
      vat: totals.vat,
      shipping,
      total: totals.total,
      notes: input.notes,
      items: { create: itemCreates },
    },
    include: { supplier: true, items: true },
  });

  await logActivity({
    userId,
    action: "CREATE_PO",
    entity: "PurchaseOrder",
    entityId: po.id,
    details: po.poNumber,
  });

  return mapPoDetail(po);
}

export async function updatePurchaseOrder(
  id: string,
  raw: unknown,
  userId?: string
) {
  const input = updatePoSchema.parse(raw);
  const existing = await findPo(id);

  if (existing.status === "RECEIVED" || existing.status === "CANCELLED") {
    throw new AppError(`Cannot update a ${existing.status} purchase order`, 400);
  }

  let supplierId = existing.supplierId;
  if (input.supplier || input.supplierId) {
    const supplier = await resolveSupplier({
      ...input,
      items: input.items || [{ sku: "x", name: "x", quantity: 1, unitPrice: 0 }],
      dateOrdered: input.dateOrdered || dateStr(existing.orderDate),
      expectedDelivery:
        input.expectedDelivery || dateStr(existing.expectedDelivery),
    } as z.infer<typeof createPoSchema>);
    supplierId = supplier.id;
  }

  const shipping =
    input.shipping !== undefined
      ? Number(input.shipping)
      : Number(existing.shipping);
  let totals = {
    subtotal: Number(existing.subtotal),
    vat: Number(existing.vat),
    total: Number(existing.total),
  };

  if (input.items) {
    totals = calcTotals(input.items, shipping);
  }

  const po = await prisma.$transaction(async (tx) => {
    if (input.items) {
      await tx.purchaseOrderItem.deleteMany({ where: { poId: existing.id } });
      for (const item of input.items) {
        let productId = item.productId;
        if (!productId) {
          const p = await tx.product.findUnique({ where: { sku: item.sku } });
          productId = p?.id;
        }
        await tx.purchaseOrderItem.create({
          data: {
            poId: existing.id,
            productId,
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
          },
        });
      }
    }

    return tx.purchaseOrder.update({
      where: { id: existing.id },
      data: {
        supplierId,
        ...(input.dateOrdered && { orderDate: new Date(input.dateOrdered) }),
        ...(input.expectedDelivery && {
          expectedDelivery: new Date(input.expectedDelivery),
        }),
        ...(input.paymentTerms !== undefined && {
          paymentTerms: input.paymentTerms,
        }),
        ...(input.status && { status: input.status }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.shipping !== undefined && { shipping }),
        ...(input.items && {
          subtotal: totals.subtotal,
          vat: totals.vat,
          total: totals.total,
          shipping,
        }),
      },
      include: { supplier: true, items: true },
    });
  });

  await logActivity({
    userId,
    action: "UPDATE_PO",
    entity: "PurchaseOrder",
    entityId: po.id,
  });

  return mapPoDetail(po);
}

export async function submitPurchaseOrder(id: string, userId?: string) {
  const existing = await findPo(id);
  if (existing.status !== "DRAFT") {
    throw new AppError("Only DRAFT purchase orders can be submitted", 400);
  }

  const po = await prisma.purchaseOrder.update({
    where: { id: existing.id },
    data: { status: "PENDING" },
    include: { supplier: true, items: true },
  });

  await logActivity({
    userId,
    action: "SUBMIT_PO",
    entity: "PurchaseOrder",
    entityId: po.id,
  });

  return { message: "Purchase order submitted", data: mapPoDetail(po) };
}

export async function receivePurchaseOrder(
  id: string,
  raw: unknown,
  userId?: string
) {
  const existing = await findPo(id);
  if (existing.status === "RECEIVED") {
    throw new AppError("Purchase order already received", 400);
  }
  if (existing.status === "CANCELLED") {
    throw new AppError("Cannot receive a cancelled purchase order", 400);
  }

  const body = (raw || {}) as {
    items?: { id?: string; sku?: string; receivedQty?: number }[];
    batchNo?: string;
  };

  await prisma.$transaction(async (tx) => {
    for (const item of existing.items) {
      const override = body.items?.find(
        (i) => i.id === item.id || i.sku === item.sku
      );
      const qty = override?.receivedQty ?? item.quantity;
      if (qty <= 0) continue;

      let productId = item.productId;
      if (!productId) {
        const p = await tx.product.findUnique({ where: { sku: item.sku } });
        if (!p) {
          const created = await tx.product.create({
            data: {
              name: item.name,
              category: "Uncategorized",
              sku: item.sku,
              manufacturer: "",
              price: item.unitPrice,
              status: "Active",
            },
          });
          productId = created.id;
        } else {
          productId = p.id;
        }
      }

      const batchNo =
        body.batchNo || `RCV-${existing.poNumber}-${item.sku}`.slice(0, 40);
      const existingBatch = await tx.inventoryBatch.findUnique({
        where: {
          productId_batchNo: { productId, batchNo },
        },
      });

      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 2);

      if (existingBatch) {
        await tx.inventoryBatch.update({
          where: { id: existingBatch.id },
          data: { quantity: existingBatch.quantity + qty },
        });
      } else {
        await tx.inventoryBatch.create({
          data: {
            productId,
            batchNo,
            quantity: qty,
            minStock: 10,
            maxStock: Math.max(qty * 2, 100),
            expiryDate: expiry,
            unitPrice: item.unitPrice,
          },
        });
      }

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: qty, productId },
      });
    }

    await tx.purchaseOrder.update({
      where: { id: existing.id },
      data: { status: "RECEIVED" },
    });
  });

  await logActivity({
    userId,
    action: "RECEIVE_PO",
    entity: "PurchaseOrder",
    entityId: existing.id,
  });

  const po = await findPo(id);
  return { message: "Purchase order received", data: mapPoDetail(po) };
}

export async function cancelPurchaseOrder(id: string, userId?: string) {
  const existing = await findPo(id);
  if (existing.status === "RECEIVED") {
    throw new AppError("Cannot cancel a received purchase order", 400);
  }
  if (existing.status === "CANCELLED") {
    throw new AppError("Purchase order already cancelled", 400);
  }

  const po = await prisma.purchaseOrder.update({
    where: { id: existing.id },
    data: { status: "CANCELLED" },
    include: { supplier: true, items: true },
  });

  await logActivity({
    userId,
    action: "CANCEL_PO",
    entity: "PurchaseOrder",
    entityId: po.id,
  });

  return { message: "Purchase order cancelled", data: mapPoDetail(po) };
}
