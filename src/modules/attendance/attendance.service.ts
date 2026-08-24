import { AppError } from "../../middleware/errorHandler";
import { prisma } from "../../db/prisma";
import { logActivity, paginatedMeta, parsePage } from "../../utils/helpers";

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function hoursBetween(a: Date, b: Date): number {
  return Number(((b.getTime() - a.getTime()) / 3_600_000).toFixed(2));
}

export async function listAttendance(userId: string) {
  const rows = await prisma.attendance.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 60,
  });

  const data = rows.map((r) => {
    const hours =
      r.clockIn && r.clockOut ? hoursBetween(r.clockIn, r.clockOut) : undefined;
    let status = "Absent";
    if (r.clockIn && r.clockOut) status = "Completed";
    else if (r.clockIn) status = "Clocked In";

    return {
      id: r.id,
      date: dateStr(r.date),
      clockIn: r.clockIn?.toISOString(),
      clockOut: r.clockOut?.toISOString(),
      hours,
      status,
    };
  });

  return data;
}

export async function clockIn(userId: string) {
  const today = startOfToday();
  const existing = await prisma.attendance.findFirst({
    where: { userId, date: today },
  });

  if (existing?.clockIn && !existing.clockOut) {
    throw new AppError("Already clocked in", 400);
  }

  const now = new Date();
  let record;
  if (existing) {
    record = await prisma.attendance.update({
      where: { id: existing.id },
      data: { clockIn: now, clockOut: null },
    });
  } else {
    record = await prisma.attendance.create({
      data: { userId, date: today, clockIn: now },
    });
  }

  await logActivity({
    userId,
    action: "CLOCK_IN",
    entity: "Attendance",
    entityId: record.id,
  });

  return {
    message: "Clocked in successfully",
    id: record.id,
    date: dateStr(record.date),
    clockIn: record.clockIn?.toISOString(),
  };
}

export async function clockOut(userId: string) {
  const today = startOfToday();
  const existing = await prisma.attendance.findFirst({
    where: { userId, date: today },
  });

  if (!existing?.clockIn) {
    throw new AppError("Not clocked in today", 400);
  }
  if (existing.clockOut) {
    throw new AppError("Already clocked out", 400);
  }

  const now = new Date();
  const record = await prisma.attendance.update({
    where: { id: existing.id },
    data: { clockOut: now },
  });

  await logActivity({
    userId,
    action: "CLOCK_OUT",
    entity: "Attendance",
    entityId: record.id,
  });

  return {
    message: "Clocked out successfully",
    id: record.id,
    date: dateStr(record.date),
    clockIn: record.clockIn?.toISOString(),
    clockOut: record.clockOut?.toISOString(),
    hours: hoursBetween(record.clockIn!, record.clockOut!),
  };
}

export async function listActivity(query: Record<string, unknown> = {}) {
  const { page, limit, skip } = parsePage(query);

  const [total, rows] = await Promise.all([
    prisma.activityLog.count(),
    prisma.activityLog.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, employeeId: true } } },
    }),
  ]);

  return {
    data: rows.map((r) => ({
      id: r.id,
      action: r.action,
      timestamp: r.createdAt.toISOString(),
      details: r.details ?? undefined,
      entity: r.entity ?? undefined,
      entityId: r.entityId ?? undefined,
      user: r.user
        ? { name: r.user.name, employeeId: r.user.employeeId }
        : undefined,
    })),
    meta: paginatedMeta(total, page, limit),
  };
}
