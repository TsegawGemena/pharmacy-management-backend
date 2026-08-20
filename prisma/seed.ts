/**
 * Seed demo users matching the frontend login page.
 * Run: npm run prisma:seed
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Pharmacy@123", 10);

  await prisma.user.upsert({
    where: { employeeId: "EMP-001" },
    update: {},
    create: {
      employeeId: "EMP-001",
      name: "Abebe Kebede",
      email: "abebe@gammo.et",
      passwordHash,
      role: Role.Admin,
      phone: "+251 911 000 001",
    },
  });

  await prisma.user.upsert({
    where: { employeeId: "EMP-002" },
    update: {},
    create: {
      employeeId: "EMP-002",
      name: "Sara Alemu",
      email: "sara@gammo.et",
      passwordHash,
      role: Role.Pharmacist,
      phone: "+251 911 000 002",
    },
  });

  console.log("Seeded users: EMP-001 (Admin), EMP-002 (Pharmacist)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
