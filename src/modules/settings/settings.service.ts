import { z } from "zod";
import { prisma } from "../../db/prisma";
import { logActivity } from "../../utils/helpers";

export const stockAlertSchema = z.object({
  criticalUnits: z.number().int().min(0).optional(),
  lowStockLeadDays: z.number().int().min(0).optional(),
  emailAlerts: z.boolean().optional(),
  autoDraftPO: z.boolean().optional(),
  // FE aliases
  threshold: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});

export const expiryAlertSchema = z.object({
  leadDays: z.number().int().min(0).optional(),
  criticalDays: z.number().int().min(0).optional(),
  autoDiscount: z.boolean().optional(),
  emailNotification: z.boolean().optional(),
  // FE aliases
  daysBeforeExpiry: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});

export const organizationSchema = z.object({
  name: z.string().min(1).optional(),
  license: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
});

function mapStockSettings(s: {
  criticalUnits: number;
  lowStockLeadDays: number;
  emailAlerts: boolean;
  autoDraftPO: boolean;
}) {
  return {
    criticalUnits: s.criticalUnits,
    lowStockLeadDays: s.lowStockLeadDays,
    emailAlerts: s.emailAlerts,
    autoDraftPO: s.autoDraftPO,
    threshold: s.criticalUnits,
    enabled: s.emailAlerts,
  };
}

function mapExpirySettings(s: {
  leadDays: number;
  criticalDays: number;
  autoDiscount: boolean;
  emailNotification: boolean;
}) {
  return {
    leadDays: s.leadDays,
    criticalDays: s.criticalDays,
    autoDiscount: s.autoDiscount,
    emailNotification: s.emailNotification,
    daysBeforeExpiry: s.leadDays,
    enabled: s.emailNotification,
  };
}

function mapOrg(o: {
  id: string;
  name: string;
  license: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
}) {
  return {
    id: o.id,
    name: o.name,
    license: o.license ?? undefined,
    address: o.address ?? undefined,
    phone: o.phone ?? undefined,
    email: o.email ?? undefined,
    logoUrl: o.logoUrl ?? undefined,
  };
}

export async function getStockAlertSettings() {
  const settings = await prisma.stockAlertSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  return mapStockSettings(settings);
}

export async function updateStockAlertSettings(
  raw: unknown,
  userId?: string
) {
  const input = stockAlertSchema.parse(raw ?? {});
  const settings = await prisma.stockAlertSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      criticalUnits: input.criticalUnits ?? input.threshold ?? 20,
      lowStockLeadDays: input.lowStockLeadDays ?? 7,
      emailAlerts: input.emailAlerts ?? input.enabled ?? true,
      autoDraftPO: input.autoDraftPO ?? false,
    },
    update: {
      ...(input.criticalUnits !== undefined && {
        criticalUnits: input.criticalUnits,
      }),
      ...(input.threshold !== undefined && { criticalUnits: input.threshold }),
      ...(input.lowStockLeadDays !== undefined && {
        lowStockLeadDays: input.lowStockLeadDays,
      }),
      ...(input.emailAlerts !== undefined && { emailAlerts: input.emailAlerts }),
      ...(input.enabled !== undefined && { emailAlerts: input.enabled }),
      ...(input.autoDraftPO !== undefined && { autoDraftPO: input.autoDraftPO }),
    },
  });

  await logActivity({
    userId,
    action: "UPDATE_STOCK_ALERT_SETTINGS",
    entity: "StockAlertSettings",
  });

  return mapStockSettings(settings);
}

export async function getExpiryAlertSettings() {
  const settings = await prisma.expiryAlertSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  return mapExpirySettings(settings);
}

export async function updateExpiryAlertSettings(
  raw: unknown,
  userId?: string
) {
  const input = expiryAlertSchema.parse(raw ?? {});
  const settings = await prisma.expiryAlertSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      leadDays: input.leadDays ?? input.daysBeforeExpiry ?? 90,
      criticalDays: input.criticalDays ?? 30,
      autoDiscount: input.autoDiscount ?? false,
      emailNotification:
        input.emailNotification ?? input.enabled ?? true,
    },
    update: {
      ...(input.leadDays !== undefined && { leadDays: input.leadDays }),
      ...(input.daysBeforeExpiry !== undefined && {
        leadDays: input.daysBeforeExpiry,
      }),
      ...(input.criticalDays !== undefined && {
        criticalDays: input.criticalDays,
      }),
      ...(input.autoDiscount !== undefined && {
        autoDiscount: input.autoDiscount,
      }),
      ...(input.emailNotification !== undefined && {
        emailNotification: input.emailNotification,
      }),
      ...(input.enabled !== undefined && {
        emailNotification: input.enabled,
      }),
    },
  });

  await logActivity({
    userId,
    action: "UPDATE_EXPIRY_ALERT_SETTINGS",
    entity: "ExpiryAlertSettings",
  });

  return mapExpirySettings(settings);
}

export async function getOrganization() {
  let org = await prisma.organization.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: "Gammo Pharmacy" },
    });
  }
  return mapOrg(org);
}

export async function updateOrganization(raw: unknown, userId?: string) {
  const input = organizationSchema.parse(raw ?? {});
  const existing = await prisma.organization.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const org = existing
    ? await prisma.organization.update({
        where: { id: existing.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.license !== undefined && { license: input.license }),
          ...(input.address !== undefined && { address: input.address }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(input.email !== undefined && { email: input.email }),
          ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
        },
      })
    : await prisma.organization.create({
        data: {
          name: input.name || "Gammo Pharmacy",
          license: input.license,
          address: input.address,
          phone: input.phone,
          email: input.email,
          logoUrl: input.logoUrl,
        },
      });

  await logActivity({
    userId,
    action: "UPDATE_ORGANIZATION",
    entity: "Organization",
    entityId: org.id,
  });

  return mapOrg(org);
}
