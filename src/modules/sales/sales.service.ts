import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { prisma } from "../../db/prisma";
import { calcVat } from "../../utils/vat";
import {
  deductStockFefo,
  logActivity,
  nextCode,
  productStock,
  toNumber,
} from "../../utils/helpers";

export const checkoutSchema = z.object({
  customerName: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        name: z.string().optional(),
        price: z.number().nonnegative(),
        qty: z.number().int().positive(),
      })
    )
    .min(1),
  paymentMethod: z.enum(["cash", "telebirr", "card"]),
  amountTendered: z.number().optional(),
  notes: z.string().optional(),
});

function mapInvoicePaymentMethod(
  method: "cash" | "telebirr" | "card"
): string {
  if (method === "cash") return "Cash";
  if (method === "telebirr") return "Telebirr";
  return "Card";
}

export async function listPosProducts(query: Record<string, unknown>) {
  const q = typeof query.q === "string" ? query.q : undefined;

  const products = await prisma.product.findMany({
    where: {
      status: "Active",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { sku: { contains: q, mode: "insensitive" as const } },
              { category: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  const data = [];
  for (const p of products) {
    const stock = await productStock(p.id);
    if (stock <= 0) continue;
    data.push({
      id: p.id,
      name: p.name,
      category: p.category,
      stock,
      price: toNumber(p.price),
      stockUnit: "units",
    });
  }

  return { data };
}

export async function completeSale(raw: unknown, userId: string) {
  const input = checkoutSchema.parse(raw);

  const subtotal = Number(
    input.items
      .reduce((sum, i) => sum + i.price * i.qty, 0)
      .toFixed(2)
  );
  const vat = calcVat(subtotal);
  const total = Number((subtotal + vat).toFixed(2));
  const amountTendered =
    input.amountTendered !== undefined ? input.amountTendered : total;
  const changeDue = Number(Math.max(0, amountTendered - total).toFixed(2));
  const invoiceNumber = await nextCode("INV", "invoice");

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product || product.status !== "Active") {
          throw new AppError(`Product not found: ${item.name || item.productId}`, 404);
        }
        await deductStockFefo(tx, item.productId, item.qty);
      }

      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerName: input.customerName?.trim() || "Walk-in",
          paymentMethod: input.paymentMethod,
          amountTendered,
          changeDue,
          subtotal,
          vat,
          total,
          notes: input.notes,
          soldById: userId,
          items: {
            create: input.items.map((i) => ({
              productId: i.productId,
              name: i.name || "Item",
              price: new Prisma.Decimal(i.price),
              qty: i.qty,
            })),
          },
        },
      });

      await tx.invoice.create({
        data: {
          invoiceNumber,
          saleId: sale.id,
          customerName: input.customerName?.trim() || "Walk-in",
          date: new Date(),
          amount: total,
          paymentMethod: mapInvoicePaymentMethod(input.paymentMethod),
          status: "Paid",
        },
      });
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Error && err.message === "Insufficient stock") {
      throw new AppError("Insufficient stock", 400);
    }
    throw err;
  }

  await logActivity({
    userId,
    action: "COMPLETE_SALE",
    entity: "Sale",
    entityId: invoiceNumber,
    details: `Total ${total}`,
  });

  return {
    message: "Sale completed",
    invoiceNumber,
    subtotal,
    vat,
    total,
    changeDue,
    paymentMethod: input.paymentMethod,
    items: input.items.map((i) => ({
      name: i.name || "Item",
      price: i.price,
      qty: i.qty,
    })),
    createdAt: new Date().toISOString(),
  };
}

export async function holdSale(raw: unknown, userId: string) {
  const body = (raw ?? {}) as { items?: unknown[] };

  await logActivity({
    userId,
    action: "HOLD_SALE",
    entity: "Sale",
    details: `Held ${Array.isArray(body.items) ? body.items.length : 0} items`,
  });

  return {
    message: "Sale held successfully",
  };
}
