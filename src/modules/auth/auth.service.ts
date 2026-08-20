import { z } from "zod";
import { AppError } from "../../middleware/errorHandler";
import { prisma } from "../../db/prisma";
import { comparePassword } from "../../utils/password";
import { signToken } from "../../utils/jwt";

export const loginSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

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

  const token = signToken({
    userId: user.id,
    employeeId: user.employeeId,
    role: user.role,
  });

  return {
    message: "Login successful",
    token,
    user: {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  return {
    id: user.id,
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    status: user.status,
    avatarUrl: user.avatarUrl,
    dateJoined: user.dateJoined,
  };
}
