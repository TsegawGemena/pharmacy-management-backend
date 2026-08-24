import { z } from "zod";
import { AppError } from "../../middleware/errorHandler";
import { prisma } from "../../db/prisma";
import { comparePassword, hashPassword } from "../../utils/password";
import { signToken } from "../../utils/jwt";

const roleEnum = z.enum(["Admin", "Pharmacist", "Cashier"]);

export const loginSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  password: z.string().min(1, "Password is required"),
  /** Optional UI selection — verified against DB role, never trusted alone */
  selectedRole: roleEnum.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters"),
});

export const forgotPasswordSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  email: z.string().email("Valid email is required").optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export function toPublicUser(user: {
  id: string;
  employeeId: string;
  name: string;
  email: string | null;
  role: string;
  phone?: string | null;
  status?: string;
  avatarUrl?: string | null;
  dateJoined?: Date;
}) {
  return {
    id: user.id,
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.phone !== undefined && { phone: user.phone }),
    ...(user.status !== undefined && { status: user.status }),
    ...(user.avatarUrl !== undefined && { avatarUrl: user.avatarUrl }),
    ...(user.dateJoined !== undefined && {
      dateJoined: user.dateJoined.toISOString(),
    }),
  };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { employeeId: input.employeeId },
  });

  if (!user || user.status !== "Active") {
    throw new AppError("Invalid employee ID or password", 401);
  }

  const ok = await comparePassword(input.password, user.passwordHash);
  if (!ok) {
    throw new AppError("Invalid employee ID or password", 401);
  }

  // Critical: never trust frontend-selected role — verify against DB
  if (input.selectedRole && input.selectedRole !== user.role) {
    throw new AppError(
      `Access denied: this account is ${user.role}, not ${input.selectedRole}`,
      403
    );
  }

  const token = signToken({
    userId: user.id,
    employeeId: user.employeeId,
    role: user.role,
  });

  return {
    message: "Login successful",
    token,
    user: toPublicUser(user),
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  return toPublicUser(user);
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const ok = await comparePassword(input.currentPassword, user.passwordHash);
  if (!ok) {
    throw new AppError("Current password is incorrect", 400);
  }

  if (input.currentPassword === input.newPassword) {
    throw new AppError(
      "New password must be different from current password",
      400
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });

  return { message: "Password changed successfully" };
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const user = await prisma.user.findUnique({
    where: { employeeId: input.employeeId },
  });

  if (!user || user.status !== "Active") {
    return {
      message:
        "If an account exists with that employee ID, password reset instructions will be sent.",
    };
  }

  if (input.email && user.email && user.email !== input.email) {
    return {
      message:
        "If an account exists with that employee ID, password reset instructions will be sent.",
    };
  }

  return {
    message:
      "If an account exists with that employee ID, password reset instructions will be sent.",
  };
}
