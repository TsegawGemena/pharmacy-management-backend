import { z } from "zod";
import { AppError } from "../../middleware/errorHandler";
import { prisma } from "../../db/prisma";
import { logActivity } from "../../utils/helpers";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required"),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required"),
});

function mapCategory(c: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    name: c.name,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function listCategories() {
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });
  return { data: rows.map(mapCategory) };
}

export async function createCategory(raw: unknown, userId?: string) {
  const input = createCategorySchema.parse(raw);
  const name = input.name.trim();

  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    throw new AppError("Category already exists", 400);
  }

  const category = await prisma.category.create({
    data: { name },
  });

  await logActivity({
    userId,
    action: "CREATE_CATEGORY",
    entity: "Category",
    entityId: category.id,
    details: category.name,
  });

  return mapCategory(category);
}

/**
 * Rename a category and rewrite product.category strings so products stay linked.
 */
export async function updateCategory(
  id: string,
  raw: unknown,
  userId?: string
) {
  const input = updateCategorySchema.parse(raw);
  const name = input.name.trim();
  if (!name) {
    throw new AppError("Category name is required", 400);
  }

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found", 404);

  if (existing.name === name) {
    return mapCategory(existing);
  }

  const duplicate = await prisma.category.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      NOT: { id },
    },
  });
  if (duplicate) {
    throw new AppError("Category already exists", 400);
  }

  const oldName = existing.name;

  const category = await prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({
      where: { id },
      data: { name },
    });
    await tx.product.updateMany({
      where: { category: oldName },
      data: { category: name },
    });
    return updated;
  });

  await logActivity({
    userId,
    action: "UPDATE_CATEGORY",
    entity: "Category",
    entityId: id,
    details: `${oldName} → ${name}`,
  });

  return mapCategory(category);
}

export async function deleteCategory(id: string, userId?: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found", 404);

  await prisma.category.delete({ where: { id } });

  await logActivity({
    userId,
    action: "DELETE_CATEGORY",
    entity: "Category",
    entityId: id,
    details: existing.name,
  });

  return { message: "Category deleted" };
}

/** Ensure a category row exists for the given name (idempotent). */
export async function ensureCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = await prisma.category.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return existing;
  return prisma.category.create({ data: { name: trimmed } });
}
