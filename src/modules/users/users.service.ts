import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/errorHandler";
import { prisma } from "../../db/prisma";
import { toPublicUser } from "../auth/auth.service";
import { hashPassword } from "../../utils/password";
import { logActivity, paginatedMeta, parsePage } from "../../utils/helpers";

export const updateProfileSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
});

export const createEmployeeSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().nullable(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["Admin", "Pharmacist", "Cashier"]),
  phone: z.string().optional().nullable(),
  status: z.enum(["Active", "Inactive"]).optional().default("Active"),
});

export const updateEmployeeSchema = z.object({
  employeeId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  password: z.string().min(8).optional(),
  role: z.enum(["Admin", "Pharmacist", "Cashier"]).optional(),
  phone: z.string().optional().nullable(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["Active", "Inactive"]),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404);
  return toPublicUser(user);
}

export async function updateProfile(userId: string, data: UpdateProfileInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404);

  if (data.email && data.email !== user.email) {
    const taken = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id: userId } },
    });
    if (taken) throw new AppError("Email already in use", 400);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.fullName !== undefined && { name: data.fullName }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
    },
  });

  await logActivity({
    userId,
    action: "UPDATE_PROFILE",
    entity: "User",
    entityId: userId,
  });

  return toPublicUser(updated);
}

export async function listEmployees(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePage(query);
  const where: Prisma.UserWhereInput = {};

  if (typeof query.q === "string" && query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { employeeId: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
    ];
  }
  if (typeof query.role === "string" && query.role) {
    where.role = query.role as "Admin" | "Pharmacist" | "Cashier";
  }
  if (typeof query.status === "string" && query.status) {
    where.status = query.status as "Active" | "Inactive";
  }

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { employeeId: "asc" },
    }),
  ]);

  return {
    data: rows.map(toPublicUser),
    meta: paginatedMeta(total, page, limit),
  };
}

export async function getEmployee(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError("Employee not found", 404);
  return toPublicUser(user);
}

export async function createEmployee(
  input: CreateEmployeeInput,
  actorId?: string
) {
  const existingId = await prisma.user.findUnique({
    where: { employeeId: input.employeeId },
  });
  if (existingId) throw new AppError("Employee ID already exists", 400);

  if (input.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingEmail) throw new AppError("Email already in use", 400);
  }

  const user = await prisma.user.create({
    data: {
      employeeId: input.employeeId,
      name: input.name,
      email: input.email || null,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      phone: input.phone || null,
      status: input.status || "Active",
    },
  });

  await logActivity({
    userId: actorId,
    action: "CREATE_EMPLOYEE",
    entity: "User",
    entityId: user.id,
    details: `${user.employeeId} (${user.role})`,
  });

  return toPublicUser(user);
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput,
  actorId?: string
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError("Employee not found", 404);

  if (input.employeeId && input.employeeId !== user.employeeId) {
    const taken = await prisma.user.findUnique({
      where: { employeeId: input.employeeId },
    });
    if (taken) throw new AppError("Employee ID already exists", 400);
  }

  if (input.email && input.email !== user.email) {
    const taken = await prisma.user.findFirst({
      where: { email: input.email, NOT: { id } },
    });
    if (taken) throw new AppError("Email already in use", 400);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.employeeId !== undefined && { employeeId: input.employeeId }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.password !== undefined && {
        passwordHash: await hashPassword(input.password),
      }),
    },
  });

  await logActivity({
    userId: actorId,
    action: "UPDATE_EMPLOYEE",
    entity: "User",
    entityId: id,
    details: updated.employeeId,
  });

  return toPublicUser(updated);
}

export async function updateEmployeeStatus(
  id: string,
  status: "Active" | "Inactive",
  actorId?: string
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError("Employee not found", 404);

  if (actorId && actorId === id && status === "Inactive") {
    throw new AppError("You cannot deactivate your own account", 400);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status },
  });

  await logActivity({
    userId: actorId,
    action: status === "Active" ? "ACTIVATE_EMPLOYEE" : "DEACTIVATE_EMPLOYEE",
    entity: "User",
    entityId: id,
    details: updated.employeeId,
  });

  return toPublicUser(updated);
}

export async function getEmployeeStats() {
  const [Admin, Pharmacist, Cashier, Active, Inactive, total] =
    await Promise.all([
      prisma.user.count({ where: { role: "Admin" } }),
      prisma.user.count({ where: { role: "Pharmacist" } }),
      prisma.user.count({ where: { role: "Cashier" } }),
      prisma.user.count({ where: { status: "Active" } }),
      prisma.user.count({ where: { status: "Inactive" } }),
      prisma.user.count(),
    ]);

  return {
    data: {
      Admin,
      Pharmacist,
      Cashier,
      Active,
      Inactive,
      total,
    },
  };
}
