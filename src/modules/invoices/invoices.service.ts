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

export const updateStatusSchema = z.object({
  status: z.enum(["Paid", "Pending", "Overdue", "Cancelled"]),
});

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapInvoice(inv: {
  invoiceNumber: string;
  customerName: string;
  date: Date;
  amount: Prisma.Decimal;
  paymentMethod: string;
  status: string;
}) {
  return {
    id: inv.invoiceNumber,
    customerName: inv.customerName,
    date: dateStr(inv.date),
    amount: decimalStr(inv.amount),
    paymentMethod: inv.paymentMethod,
    status: inv.status,
  };
}

function buildWhere(query: Record<string, unknown>): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {};

  if (typeof query.status === "string" && query.status) {
    where.status = query.status as Prisma.EnumInvoiceStatusFilter;
  }
  if (typeof query.dateFrom === "string" && query.dateFrom) {
    where.date = { ...(where.date as object), gte: new Date(query.dateFrom) };
  }
  if (typeof query.dateTo === "string" && query.dateTo) {
    where.date = { ...(where.date as object), lte: new Date(query.dateTo) };
  }
  if (typeof query.q === "string" && query.q) {
    where.OR = [
      { invoiceNumber: { contains: query.q, mode: "insensitive" } },
      { customerName: { contains: query.q, mode: "insensitive" } },
    ];
  }

  return where;
}

async function findInvoice(id: string) {
  const inv = await prisma.invoice.findFirst({
    where: { OR: [{ invoiceNumber: id }, { id }] },
  });
  if (!inv) throw new AppError("Invoice not found", 404);
  return inv;
}

export async function listInvoices(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePage(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: "desc" },
    }),
  ]);

  return {
    data: rows.map(mapInvoice),
    meta: paginatedMeta(total, page, limit),
  };
}

export async function getInvoice(id: string) {
  const inv = await findInvoice(id);
  return mapInvoice(inv);
}

export async function updateInvoiceStatus(
  id: string,
  raw: unknown,
  userId?: string
) {
  const input = updateStatusSchema.parse(raw);
  const existing = await findInvoice(id);

  const inv = await prisma.invoice.update({
    where: { id: existing.id },
    data: { status: input.status },
  });

  await logActivity({
    userId,
    action: "UPDATE_INVOICE_STATUS",
    entity: "Invoice",
    entityId: inv.id,
    details: input.status,
  });

  return mapInvoice(inv);
}

export async function exportInvoices(query: Record<string, unknown>) {
  const where = buildWhere(query);
  const rows = await prisma.invoice.findMany({
    where,
    orderBy: { date: "desc" },
  });

  const header = "Invoice Number,Customer,Date,Amount,Payment Method,Status";
  const lines = rows.map((r) =>
    [
      r.invoiceNumber,
      `"${r.customerName.replace(/"/g, '""')}"`,
      dateStr(r.date),
      decimalStr(r.amount),
      r.paymentMethod,
      r.status,
    ].join(",")
  );

  return [header, ...lines].join("\n");
}
