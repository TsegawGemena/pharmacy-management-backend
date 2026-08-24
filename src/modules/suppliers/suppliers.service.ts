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

export const createSupplierSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  contact: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  address: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional().default(5),
  status: z.enum(["Active", "Inactive"]).optional().default("Active"),
});

export const updateSupplierSchema = createSupplierSchema.partial();

function mapSupplier(s: {
  code: string;
  name: string;
  category: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  rating: number;
  status: string;
}) {
  return {
    id: s.code,
    name: s.name,
    category: s.category,
    contact: {
      name: s.contactName ?? undefined,
      email: s.email ?? undefined,
      phone: s.phone ?? undefined,
    },
    address: s.address ?? undefined,
    rating: s.rating,
    status: s.status,
  };
}

async function findByPublicId(id: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { OR: [{ code: id }, { id }] },
  });
  if (!supplier) throw new AppError("Supplier not found", 404);
  return supplier;
}

export async function listSuppliers(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePage(query);
  const where: Prisma.SupplierWhereInput = {};

  if (typeof query.q === "string" && query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { code: { contains: query.q, mode: "insensitive" } },
      { category: { contains: query.q, mode: "insensitive" } },
    ];
  }
  if (typeof query.status === "string" && query.status) {
    where.status = query.status as "Active" | "Inactive";
  }

  const [total, rows] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    data: rows.map(mapSupplier),
    meta: paginatedMeta(total, page, limit),
  };
}

export async function createSupplier(raw: unknown, userId?: string) {
  const input = createSupplierSchema.parse(raw);
  const code = await nextCode("SUP", "supplier");

  const supplier = await prisma.supplier.create({
    data: {
      code,
      name: input.name,
      category: input.category,
      contactName: input.contact?.name,
      email: input.contact?.email,
      phone: input.contact?.phone,
      address: input.address,
      rating: input.rating ?? 5,
      status: input.status || "Active",
    },
  });

  await logActivity({
    userId,
    action: "CREATE_SUPPLIER",
    entity: "Supplier",
    entityId: supplier.id,
    details: supplier.code,
  });

  return mapSupplier(supplier);
}

export async function updateSupplier(
  id: string,
  raw: unknown,
  userId?: string
) {
  const input = updateSupplierSchema.parse(raw);
  const existing = await findByPublicId(id);

  const supplier = await prisma.supplier.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.rating !== undefined && { rating: input.rating }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.contact?.name !== undefined && {
        contactName: input.contact.name,
      }),
      ...(input.contact?.email !== undefined && { email: input.contact.email }),
      ...(input.contact?.phone !== undefined && { phone: input.contact.phone }),
    },
  });

  await logActivity({
    userId,
    action: "UPDATE_SUPPLIER",
    entity: "Supplier",
    entityId: supplier.id,
  });

  return mapSupplier(supplier);
}

export async function deleteSupplier(id: string, userId?: string) {
  const existing = await findByPublicId(id);
  await prisma.supplier.update({
    where: { id: existing.id },
    data: { status: "Inactive" },
  });

  await logActivity({
    userId,
    action: "DEACTIVATE_SUPPLIER",
    entity: "Supplier",
    entityId: existing.id,
  });

  return { message: "Supplier deactivated" };
}
