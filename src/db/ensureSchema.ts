import { prisma } from "./prisma";

/**
 * Apply idempotent schema patches expected by the current Prisma client
 * when a migration has not been deployed yet.
 */
export async function ensureSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'Units';
  `);
}
