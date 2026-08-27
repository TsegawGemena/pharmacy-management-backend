import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";

export type StockNotificationType =
  | "RESTOCK"
  | "ADD_STOCK"
  | "ADJUSTMENT"
  | "UPDATE_STOCK";

export interface CreateStockNotificationInput {
  type: StockNotificationType;
  title: string;
  message: string;
  productId?: string | null;
  productName: string;
  quantityChange?: number | null;
  quantityBefore?: number | null;
  quantityAfter?: number | null;
  batchNo?: string | null;
  actorId?: string | null;
}

/**
 * Prisma client accessors for stock notifications.
 * Cast until `npx prisma generate` is run after the stock_notifications migration.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function mapNotification(
  row: {
    id: string;
    type: string;
    title: string;
    message: string;
    productId: string | null;
    productName: string;
    quantityChange: number | null;
    quantityBefore: number | null;
    quantityAfter: number | null;
    batchNo: string | null;
    actorId: string | null;
    actorName: string | null;
    createdAt: Date;
  },
  read: boolean
) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    productId: row.productId,
    productName: row.productName,
    quantityChange: row.quantityChange,
    quantityBefore: row.quantityBefore,
    quantityAfter: row.quantityAfter,
    batchNo: row.batchNo,
    actorId: row.actorId,
    actorName: row.actorName,
    createdAt: row.createdAt.toISOString(),
    read,
  };
}

/** Create a shared stock-change notification (never for sales). */
export async function createStockNotification(
  input: CreateStockNotificationInput
) {
  try {
    let actorName: string | null = null;
    if (input.actorId) {
      const user = await prisma.user.findUnique({
        where: { id: input.actorId },
        select: { name: true },
      });
      actorName = user?.name ?? null;
    }

    return await db.stockNotification.create({
      data: {
        type: input.type,
        title: input.title,
        message: input.message,
        productId: input.productId ?? null,
        productName: input.productName,
        quantityChange: input.quantityChange ?? null,
        quantityBefore: input.quantityBefore ?? null,
        quantityAfter: input.quantityAfter ?? null,
        batchNo: input.batchNo ?? null,
        actorId: input.actorId ?? null,
        actorName,
      },
    });
  } catch (err) {
    console.error("Failed to create stock notification", err);
    return null;
  }
}

export async function listNotifications(userId: string) {
  const rows = await db.stockNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      reads: { where: { userId }, select: { id: true } },
    },
  });

  return {
    data: rows.map(
      (row: {
        id: string;
        type: string;
        title: string;
        message: string;
        productId: string | null;
        productName: string;
        quantityChange: number | null;
        quantityBefore: number | null;
        quantityAfter: number | null;
        batchNo: string | null;
        actorId: string | null;
        actorName: string | null;
        createdAt: Date;
        reads: { id: string }[];
      }) => mapNotification(row, row.reads.length > 0)
    ),
  };
}

export async function getUnreadCount(userId: string) {
  const total = await db.stockNotification.count();
  const read = await db.stockNotificationRead.count({
    where: { userId },
  });
  return { unread: Math.max(0, total - read) };
}

export async function markNotificationRead(
  notificationId: string,
  userId: string
) {
  const exists = await db.stockNotification.findUnique({
    where: { id: notificationId },
  });
  if (!exists) throw new AppError("Notification not found", 404);

  await db.stockNotificationRead.upsert({
    where: {
      notificationId_userId: { notificationId, userId },
    },
    create: { notificationId, userId },
    update: { readAt: new Date() },
  });

  return { message: "Marked as read" };
}

export async function markAllNotificationsRead(userId: string) {
  const unread = await db.stockNotification.findMany({
    where: {
      reads: { none: { userId } },
    },
    select: { id: true },
  });

  if (unread.length > 0) {
    await db.stockNotificationRead.createMany({
      data: unread.map((n: { id: string }) => ({
        notificationId: n.id,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  return { message: "All notifications marked as read", count: unread.length };
}
