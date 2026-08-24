import { prisma } from "../../db/prisma";
import { decimalStr, toNumber } from "../../utils/helpers";

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysFromNow(days: number): Date {
  const d = startOfDay();
  d.setDate(d.getDate() + days);
  return d;
}

async function getAlertSettings() {
  const [stock, expiry] = await Promise.all([
    prisma.stockAlertSettings.findUnique({ where: { id: "default" } }),
    prisma.expiryAlertSettings.findUnique({ where: { id: "default" } }),
  ]);
  return {
    criticalUnits: stock?.criticalUnits ?? 20,
    leadDays: expiry?.leadDays ?? 90,
  };
}

async function estimateCostForItems(
  items: { productId: string | null; price: unknown; qty: number }[]
) {
  let cost = 0;
  for (const item of items) {
    if (!item.productId) {
      cost += toNumber(item.price as number) * item.qty * 0.6;
      continue;
    }
    const batch = await prisma.inventoryBatch.findFirst({
      where: { productId: item.productId },
      orderBy: { createdAt: "desc" },
    });
    const unitCost = batch
      ? toNumber(batch.unitPrice)
      : toNumber(item.price as number) * 0.6;
    cost += unitCost * item.qty;
  }
  return cost;
}

export async function getDashboard() {
  const { criticalUnits, leadDays } = await getAlertSettings();
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const expiryUntil = daysFromNow(leadDays);

  const [
    todaySalesAgg,
    totalProducts,
    lowStockBatches,
    expiringBatches,
    recentSales,
    employeeStats,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: today, lt: tomorrow } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.product.count({ where: { status: "Active" } }),
    prisma.inventoryBatch.findMany({
      include: { product: { select: { name: true, category: true, sku: true } } },
    }),
    prisma.inventoryBatch.findMany({
      where: {
        expiryDate: { gte: today, lte: expiryUntil },
        quantity: { gt: 0 },
      },
      include: { product: { select: { name: true, category: true } } },
      orderBy: { expiryDate: "asc" },
      take: 10,
    }),
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { items: true },
    }),
    Promise.all([
      prisma.user.count({ where: { role: "Admin" } }),
      prisma.user.count({ where: { role: "Pharmacist" } }),
      prisma.user.count({ where: { role: "Cashier" } }),
    ]),
  ]);

  const lowStock = lowStockBatches.filter(
    (b) => b.quantity <= criticalUnits || b.quantity <= b.minStock
  );

  const [Admin, Pharmacist, Cashier] = employeeStats;

  return {
    data: {
      stats: {
        todaySales: toNumber(todaySalesAgg._sum.total ?? 0),
        totalProducts,
        lowStockCount: lowStock.length,
        expiringSoonCount: expiringBatches.length,
      },
      personnel: { Admin, Pharmacist, Cashier },
      salesOverview: {
        todayCount: todaySalesAgg._count,
        todayTotal: toNumber(todaySalesAgg._sum.total ?? 0),
      },
      recentSales: recentSales.map((s) => ({
        id: s.invoiceNumber,
        customerName: s.customerName,
        total: decimalStr(s.total),
        paymentMethod: s.paymentMethod,
        date: s.createdAt.toISOString(),
        itemCount: s.items.length,
      })),
      expiryAlerts: expiringBatches.map((b) => ({
        id: b.id,
        name: b.product.name,
        category: b.product.category,
        batchNo: b.batchNo,
        stock: b.quantity,
        expiryDate: dateStr(b.expiryDate),
      })),
      lowStockAlerts: lowStock.slice(0, 10).map((b) => ({
        id: b.id,
        name: b.product.name,
        sku: b.product.sku,
        batchNo: b.batchNo,
        stock: b.quantity,
        minStock: b.minStock,
        alertLevel: b.quantity <= criticalUnits ? "Critical" : "Low Stock",
      })),
    },
  };
}

function rangeWindow(range: string): { from: Date; to: Date } {
  const to = new Date();
  const from = startOfDay();
  if (range === "today") {
    return { from, to };
  }
  if (range === "month") {
    from.setDate(from.getDate() - 30);
    return { from, to };
  }
  from.setDate(from.getDate() - 7);
  return { from, to };
}

export async function getSalesReport(range: string) {
  const { from, to } = rangeWindow(range);
  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });

  const byDay = new Map<string, { date: string; label: string; total: number; revenue: number; count: number }>();
  const productStats = new Map<
    string,
    { name: string; unitsSold: number; revenue: number }
  >();

  let totalCost = 0;
  for (const s of sales) {
    const key = dateStr(s.createdAt);
    const cur = byDay.get(key) || {
      date: key,
      label: key,
      total: 0,
      revenue: 0,
      count: 0,
    };
    const amount = toNumber(s.total);
    cur.total += amount;
    cur.revenue += amount;
    cur.count += 1;
    byDay.set(key, cur);

    totalCost += await estimateCostForItems(s.items);

    for (const item of s.items) {
      const p = productStats.get(item.name) || {
        name: item.name,
        unitsSold: 0,
        revenue: 0,
      };
      p.unitsSold += item.qty;
      p.revenue += toNumber(item.price) * item.qty;
      productStats.set(item.name, p);
    }
  }

  const totalRevenue = sales.reduce((sum, s) => sum + toNumber(s.total), 0);
  const netProfit = totalRevenue - totalCost;
  const avgTransaction =
    sales.length > 0 ? totalRevenue / sales.length : 0;

  const topProducts = [...productStats.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      unitsSold: p.unitsSold,
      sold: p.unitsSold,
      revenue: Number(p.revenue.toFixed(2)),
      growth: 0,
    }));

  const lowBatches = await prisma.inventoryBatch.findMany({
    where: { quantity: { gt: 0 } },
    include: { product: true },
    orderBy: { quantity: "asc" },
    take: 5,
  });

  const lowTurnover = lowBatches.map((b) => ({
    name: b.product.name,
    stockQty: b.quantity,
    value: Number((b.quantity * toNumber(b.unitPrice)).toFixed(2)),
    status: b.quantity <= b.minStock ? "Critical" : "Slow",
  }));

  return {
    data: {
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      totalSales: sales.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      avgTransaction: Number(avgTransaction.toFixed(2)),
      inventoryTurnover: Number((totalRevenue / Math.max(totalCost, 1)).toFixed(2)),
      revenueChange: 0,
      profitMargin:
        totalRevenue > 0
          ? Number(((netProfit / totalRevenue) * 100).toFixed(2))
          : 0,
      topProducts,
      lowTurnover,
      series: [...byDay.values()].map((d) => ({
        ...d,
        total: Number(d.total.toFixed(2)),
        revenue: Number(d.revenue.toFixed(2)),
      })),
      points: [...byDay.values()].map((d) => ({
        label: d.label,
        value: Number(d.total.toFixed(2)),
      })),
      sales: sales.map((s) => ({
        id: s.invoiceNumber,
        date: s.createdAt.toISOString(),
        customerName: s.customerName,
        total: decimalStr(s.total),
        vat: decimalStr(s.vat),
        paymentMethod: s.paymentMethod,
      })),
    },
  };
}

export async function getRevenueProfit() {
  const sales = await prisma.sale.findMany({
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  let revenue = 0;
  let cost = 0;
  const byWeek = new Map<
    string,
    { label: string; week: string; revenue: number; profit: number; total: number; netProfit: number }
  >();

  for (const sale of sales) {
    const saleRevenue = toNumber(sale.total);
    const saleCost = await estimateCostForItems(sale.items);
    revenue += saleRevenue;
    cost += saleCost;

    const d = new Date(sale.createdAt);
    const weekStart = startOfDay(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const key = dateStr(weekStart);
    const cur = byWeek.get(key) || {
      label: key,
      week: key,
      revenue: 0,
      profit: 0,
      total: 0,
      netProfit: 0,
    };
    cur.revenue += saleRevenue;
    cur.total += saleRevenue;
    cur.profit += saleRevenue - saleCost;
    cur.netProfit += saleRevenue - saleCost;
    byWeek.set(key, cur);
  }

  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const series = [...byWeek.values()].map((w) => ({
    ...w,
    revenue: Number(w.revenue.toFixed(2)),
    profit: Number(w.profit.toFixed(2)),
    total: Number(w.total.toFixed(2)),
    netProfit: Number(w.netProfit.toFixed(2)),
  }));

  // Payment mix from invoices
  const invoices = await prisma.invoice.findMany();
  const paymentMix = new Map<string, number>();
  for (const inv of invoices) {
    paymentMix.set(
      inv.paymentMethod,
      (paymentMix.get(inv.paymentMethod) || 0) + toNumber(inv.amount)
    );
  }

  return {
    data: {
      revenue: Number(revenue.toFixed(2)),
      cost: Number(cost.toFixed(2)),
      profit: Number(profit.toFixed(2)),
      marginPercent: Number(margin.toFixed(2)),
      currency: "ETB",
      series,
      weeks: series,
      points: series,
      paymentMix: [...paymentMix.entries()].map(([method, amount]) => ({
        paymentMethod: method,
        amount: Number(amount.toFixed(2)),
      })),
    },
  };
}

export async function getByCategory() {
  const items = await prisma.saleItem.findMany({
    include: {
      product: { select: { category: true } },
    },
  });

  const byCat = new Map<
    string,
    { category: string; name: string; revenue: number; value: number; units: number; sales: number }
  >();

  let totalRevenue = 0;
  for (const item of items) {
    const category = item.product?.category || "Uncategorized";
    const amount = toNumber(item.price) * item.qty;
    totalRevenue += amount;
    const cur = byCat.get(category) || {
      category,
      name: category,
      revenue: 0,
      value: 0,
      units: 0,
      sales: 0,
    };
    cur.revenue += amount;
    cur.value += amount;
    cur.units += item.qty;
    cur.sales += 1;
    byCat.set(category, cur);
  }

  const categories = [...byCat.values()]
    .map((c) => ({
      ...c,
      revenue: Number(c.revenue.toFixed(2)),
      value: Number(c.value.toFixed(2)),
      percentage:
        totalRevenue > 0
          ? Number(((c.revenue / totalRevenue) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    data: {
      categories,
    },
  };
}

export async function getExpiryReport() {
  const { leadDays } = await getAlertSettings();
  const today = startOfDay();
  const until = daysFromNow(leadDays);

  const batches = await prisma.inventoryBatch.findMany({
    where: { quantity: { gt: 0 } },
    include: { product: { select: { name: true, category: true, sku: true } } },
    orderBy: { expiryDate: "asc" },
  });

  const expired = batches.filter((b) => b.expiryDate < today);
  const expiringSoon = batches.filter(
    (b) => b.expiryDate >= today && b.expiryDate <= until
  );
  const ok = batches.filter((b) => b.expiryDate > until);

  const mapRow = (b: (typeof batches)[0]) => ({
    id: b.id,
    name: b.product.name,
    sku: b.product.sku,
    category: b.product.category,
    batchNo: b.batchNo,
    stock: b.quantity,
    expiryDate: dateStr(b.expiryDate),
    unitPrice: decimalStr(b.unitPrice),
  });

  return {
    data: {
      leadDays,
      counts: {
        expired: expired.length,
        expiringSoon: expiringSoon.length,
        ok: ok.length,
      },
      expired: expired.map(mapRow),
      expiringSoon: expiringSoon.map(mapRow),
    },
  };
}
