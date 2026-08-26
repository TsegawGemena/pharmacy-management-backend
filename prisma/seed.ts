/**
 * Seed demo users + sample pharmacy data.
 * Run: npm run prisma:seed
 */
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db/prisma";

async function main() {
  const passwordHash = await bcrypt.hash("Pharmacy@123", 10);

  await prisma.user.upsert({
    where: { employeeId: "EMP-001" },
    update: { passwordHash, role: Role.Admin },
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
    update: { passwordHash, role: Role.Pharmacist },
    create: {
      employeeId: "EMP-002",
      name: "Sara Alemu",
      email: "sara@gammo.et",
      passwordHash,
      role: Role.Pharmacist,
      phone: "+251 911 000 002",
    },
  });

  await prisma.user.upsert({
    where: { employeeId: "EMP-003" },
    update: { passwordHash, role: Role.Cashier },
    create: {
      employeeId: "EMP-003",
      name: "Daniel Bekele",
      email: "daniel@gammo.et",
      passwordHash,
      role: Role.Cashier,
      phone: "+251 911 000 003",
    },
  });

  await prisma.stockAlertSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  await prisma.expiryAlertSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  const orgCount = await prisma.organization.count();
  if (orgCount === 0) {
    await prisma.organization.create({
      data: {
        name: "Gammo Pharmacy",
        license: "EFDA-ETH-001",
        address: "Addis Ababa, Ethiopia",
        phone: "+251 111 000 000",
        email: "info@gammo.et",
      },
    });
  }


  const categoryNames = ["Antibiotics", "Analgesics", "Pain Relief", "Vitamins"];
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const amox = await prisma.product.upsert({
    where: { sku: "AMX-001" },
    update: {},
    create: {
      name: "Amoxicillin 500mg Caps",
      category: "Antibiotics",
      sku: "AMX-001",
      price: 120,
      status: "Active",
    },
  });

  const para = await prisma.product.upsert({
    where: { sku: "PAR-500" },
    update: {},
    create: {
      name: "Paracetamol 500mg Tabs",
      category: "Analgesics",
      sku: "PAR-500",
      price: 45,
      status: "Active",
    },
  });

  const ibu = await prisma.product.upsert({
    where: { sku: "IBU-400" },
    update: {},
    create: {
      name: "Ibuprofen 400mg Tabs",
      category: "Pain Relief",
      sku: "IBU-400",
      price: 80,
      status: "Active",
    },
  });

  const expiryFar = new Date();
  expiryFar.setMonth(expiryFar.getMonth() + 18);
  const expirySoon = new Date();
  expirySoon.setDate(expirySoon.getDate() + 20);

  await prisma.inventoryBatch.upsert({
    where: { productId_batchNo: { productId: amox.id, batchNo: "BX-7821" } },
    update: { quantity: 450 },
    create: {
      productId: amox.id,
      batchNo: "BX-7821",
      quantity: 450,
      minStock: 100,
      maxStock: 500,
      expiryDate: expiryFar,
      purchasePrice: 100,
      sellingPrice: 120,
      priceEffectiveFrom: new Date(),
      location: "Shelf A-1",
    },
  });

  await prisma.inventoryBatch.upsert({
    where: { productId_batchNo: { productId: para.id, batchNo: "BX-1001" } },
    update: { quantity: 200 },
    create: {
      productId: para.id,
      batchNo: "BX-1001",
      quantity: 200,
      minStock: 50,
      maxStock: 400,
      expiryDate: expiryFar,
      purchasePrice: 30,
      sellingPrice: 45,
      priceEffectiveFrom: new Date(),
      location: "Shelf B-2",
    },
  });

  await prisma.inventoryBatch.upsert({
    where: { productId_batchNo: { productId: ibu.id, batchNo: "BX-2200" } },
    update: { quantity: 12 },
    create: {
      productId: ibu.id,
      batchNo: "BX-2200",
      quantity: 12,
      minStock: 50,
      maxStock: 300,
      expiryDate: expirySoon,
      purchasePrice: 60,
      sellingPrice: 80,
      priceEffectiveFrom: new Date(),
      location: "Shelf C-1",
    },
  });

  await prisma.supplier.upsert({
    where: { code: "SUP-001" },
    update: {},
    create: {
      code: "SUP-001",
      name: "PharmaCorp East Africa",
      category: "Medications",
      contactName: "Sarah Jenkins",
      email: "s.jenkins@pharmacorp.com",
      phone: "+251 911 234 567",
      address: "Addis Ababa",
      rating: 5,
      status: "Active",
    },
  });

  console.log("Seeded:");
  console.log("  Users: EMP-001 (Admin), EMP-002 (Pharmacist), EMP-003 (Cashier)");
  console.log("  Password: Pharmacy@123");
  console.log("  Sample products, inventory, supplier, org settings");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
