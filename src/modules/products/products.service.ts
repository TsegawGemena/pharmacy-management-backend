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

export const createProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  sku: z.string().optional(),
  manufacturer: z.string().optional().default(""),
  price: z.union([z.string(), z.number()]),
  stock: z.number().int().min(0).optional(),
  status: z.enum(["Active", "Inactive"]).optional().default("Active"),
});

export const updateProductSchema = createProductSchema.partial();

function generateSku(name: string) {
  const prefix = name
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
  manufacturer: string;
  price: Prisma.Decimal;
  status: string;
}) {
  const stock = await productStock(p.id);
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    sku: p.sku,
    manufacturer: p.manufacturer,
    price: decimalStr(p.price),
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

  const product = await prisma.product.create({
    data: {
      name: input.name,
      category: input.category,
      sku,
      manufacturer: input.manufacturer || "",
      price: new Prisma.Decimal(input.price),
      status: input.status || "Active",
    },
  });

  if (input.stock && input.stock > 0) {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 2);
    await prisma.inventoryBatch.create({
      data: {
        productId: product.id,
        batchNo: `BX-${Date.now().toString().slice(-6)}`,
        quantity: input.stock,
        minStock: 10,
        maxStock: Math.max(input.stock * 2, 100),
        expiryDate: expiry,
        unitPrice: new Prisma.Decimal(input.price),
      },
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

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.sku !== undefined && { sku: input.sku }),
      ...(input.manufacturer !== undefined && { manufacturer: input.manufacturer }),
      ...(input.price !== undefined && { price: new Prisma.Decimal(input.price) }),
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
