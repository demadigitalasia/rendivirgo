import { Injectable } from "@nestjs/common";
import { OrderStatus, Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportGranularity, ReportRange } from "./dto/report.dto";
import { ReportRangeQueryDto, SalesReportQueryDto } from "./dto/report.dto";

const PAID_PAYMENT_STATUSES = ["Paid", "PartiallyRefunded"] as const;
const DAY_MS = 86_400_000;
const round2 = (value: number) => Math.round(value * 100) / 100;

type Bucket = { label: string; revenue: number; orders: number };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfWeek = (date: Date) => {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
};
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);
const pad = (value: number) => String(value).padStart(2, "0");
const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const bucketKey = (date: Date, granularity: ReportGranularity) => {
  if (granularity === "month") return monthKey(date);
  if (granularity === "week") return dayKey(startOfWeek(date));
  return dayKey(date);
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------ helpers

  private resolveRange(range: ReportRange): { from: Date; to: Date; granularity: "day" | "month" } {
    const now = new Date();
    if (range === "12m") {
      return { from: addMonths(startOfMonth(now), -11), to: now, granularity: "month" };
    }
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    return { from: addDays(startOfDay(now), -(days - 1)), to: now, granularity: "day" };
  }

  private paidOrderWhere(from: Date, to: Date): Prisma.OrderWhereInput {
    return { placedAt: { gte: from, lte: to }, paymentStatus: { in: [...PAID_PAYMENT_STATUSES] } };
  }

  private parseStart(value: string): Date {
    const date = new Date(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? startOfDay(date) : date;
  }

  private parseEnd(value: string): Date {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setHours(23, 59, 59, 999);
      return date;
    }
    return date;
  }

  private buildBuckets(from: Date, to: Date, granularity: ReportGranularity): Map<string, Bucket> {
    const buckets = new Map<string, Bucket>();
    const push = (date: Date) => {
      const key = bucketKey(date, granularity);
      buckets.set(key, { label: key, revenue: 0, orders: 0 });
    };

    if (granularity === "month") {
      for (let cursor = startOfMonth(from); cursor <= to; cursor = addMonths(cursor, 1)) push(cursor);
    } else if (granularity === "week") {
      for (let cursor = startOfWeek(from); cursor <= to; cursor = addDays(cursor, 7)) push(cursor);
    } else {
      const end = startOfDay(to);
      for (let cursor = startOfDay(from); cursor <= end; cursor = addDays(cursor, 1)) push(cursor);
    }

    return buckets;
  }

  private escapeCsv(value: unknown): string {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  // ------------------------------------------------------------ overview

  async overview(query: ReportRangeQueryDto) {
    const { from, to, granularity } = this.resolveRange(query.range);
    const placedInRange = { gte: from, lte: to };
    const paidInRange = this.paidOrderWhere(from, to);
    const sixtyDaysAgo = new Date(Date.now() - 60 * DAY_MS);

    const [
      paidAggregate,
      paidOrderCount,
      orderCount,
      newCustomers,
      pendingOrders,
      unreadMessages,
      lowStockCount,
      soldUniqueCount,
      salesOrders,
      statusGroups,
      recentOrders,
      topItemGroups,
      lowStockProducts,
      categoryItems,
    ] = await Promise.all([
      this.prisma.order.aggregate({ where: paidInRange, _sum: { total: true, refundedAmount: true } }),
      this.prisma.order.count({ where: paidInRange }),
      this.prisma.order.count({ where: { placedAt: placedInRange } }),
      this.prisma.customer.count({ where: { createdAt: placedInRange } }),
      this.prisma.order.count({ where: { status: { in: ["New", "Processing"] } } }),
      this.prisma.message.count({ where: { status: "New" } }),
      this.prisma.product.count({
        where: { stockModel: "Quantity", status: "Published", stockQuantity: { lte: 3 } },
      }),
      this.prisma.product.count({ where: { stockModel: "Unique", status: "Sold", updatedAt: placedInRange } }),
      this.prisma.order.findMany({
        where: paidInRange,
        select: { placedAt: true, total: true, refundedAmount: true },
      }),
      this.prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.order.findMany({
        orderBy: { placedAt: "desc" },
        take: 8,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          total: true,
          status: true,
          paymentStatus: true,
          placedAt: true,
        },
      }),
      this.prisma.orderItem.groupBy({
        by: ["productId"],
        where: { productId: { not: null }, order: paidInRange },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 8,
      }),
      this.prisma.product.findMany({
        where: {
          OR: [
            { stockModel: "Quantity", status: "Published", stockQuantity: { lte: 3 } },
            { stockModel: "Unique", status: "Published", createdAt: { lt: sixtyDaysAgo } },
          ],
        },
        orderBy: [{ stockQuantity: "asc" }, { createdAt: "asc" }],
        take: 8,
        select: {
          id: true,
          name: true,
          sku: true,
          slug: true,
          stockModel: true,
          stockQuantity: true,
          status: true,
          price: true,
          createdAt: true,
          category: { select: { name: true } },
        },
      }),
      this.prisma.orderItem.findMany({
        where: { productId: { not: null }, order: paidInRange },
        select: {
          quantity: true,
          lineTotal: true,
          product: { select: { category: { select: { id: true, name: true } } } },
        },
      }),
    ]);

    const revenue = round2(Number(paidAggregate._sum.total ?? 0) - Number(paidAggregate._sum.refundedAmount ?? 0));
    const avgOrderValue = paidOrderCount > 0 ? round2(revenue / paidOrderCount) : 0;

    const buckets = this.buildBuckets(from, to, granularity);
    for (const order of salesOrders) {
      const bucket = buckets.get(bucketKey(order.placedAt, granularity));
      if (!bucket) continue;
      bucket.revenue = round2(bucket.revenue + Number(order.total) - Number(order.refundedAmount));
      bucket.orders += 1;
    }
    const salesSeries = [...buckets.values()];

    const statusCounts = new Map(statusGroups.map((group) => [group.status, group._count._all]));
    const statusBreakdown = (Object.values(OrderStatus) as OrderStatus[]).map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    }));

    const topProductIds = topItemGroups
      .map((group) => group.productId)
      .filter((id): id is string => id !== null);
    const topProductDetails = topProductIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, sku: true, slug: true },
        })
      : [];
    const topProductMap = new Map(topProductDetails.map((product) => [product.id, product]));
    const topProducts = topItemGroups.flatMap((group) => {
      if (!group.productId) return [];
      const detail = topProductMap.get(group.productId);
      return [
        {
          productId: group.productId,
          name: detail?.name ?? "Unknown product",
          sku: detail?.sku ?? null,
          slug: detail?.slug ?? null,
          quantity: group._sum.quantity ?? 0,
          revenue: round2(Number(group._sum.lineTotal ?? 0)),
        },
      ];
    });

    const categoryMap = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();
    for (const item of categoryItems) {
      const category = item.product?.category;
      if (!category) continue;
      const entry = categoryMap.get(category.id) ?? { id: category.id, name: category.name, quantity: 0, revenue: 0 };
      entry.quantity += item.quantity;
      entry.revenue += Number(item.lineTotal);
      categoryMap.set(category.id, entry);
    }
    const categoryRevenue = [...categoryMap.values()]
      .map((entry) => ({ ...entry, revenue: round2(entry.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);

    const lowStock = lowStockProducts.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      category: product.category.name,
      stockModel: product.stockModel,
      stockQuantity: product.stockModel === "Unique" ? 1 : product.stockQuantity ?? 0,
      status: product.status,
      price: Number(product.price),
      ageDays: Math.floor((Date.now() - product.createdAt.getTime()) / DAY_MS),
    }));

    return {
      range: query.range,
      from,
      to,
      kpis: {
        revenue,
        orders: orderCount,
        avgOrderValue,
        newCustomers,
        pendingOrders,
        unreadMessages,
        lowStockCount,
        soldUniqueCount,
      },
      salesSeries,
      statusBreakdown,
      recentOrders: recentOrders.map((order) => ({ ...order, total: Number(order.total) })),
      topProducts,
      lowStock,
      categoryRevenue,
    };
  }

  // ------------------------------------------------------------ sales

  async sales(query: SalesReportQueryDto) {
    let from: Date;
    let to: Date;
    let granularity: ReportGranularity;

    if (query.from || query.to) {
      to = query.to ? this.parseEnd(query.to) : new Date();
      from = query.from ? this.parseStart(query.from) : startOfDay(addDays(to, -29));
      granularity = query.groupBy ?? "day";
    } else {
      const resolved = this.resolveRange(query.range);
      from = resolved.from;
      to = resolved.to;
      granularity = query.groupBy ?? resolved.granularity;
    }

    const orders = await this.prisma.order.findMany({
      where: this.paidOrderWhere(from, to),
      select: { placedAt: true, total: true, refundedAmount: true },
    });

    const buckets = this.buildBuckets(from, to, granularity);
    for (const order of orders) {
      const bucket = buckets.get(bucketKey(order.placedAt, granularity));
      if (!bucket) continue;
      bucket.revenue = round2(bucket.revenue + Number(order.total) - Number(order.refundedAmount));
      bucket.orders += 1;
    }

    const series = [...buckets.values()];
    const revenue = round2(series.reduce((sum, bucket) => sum + bucket.revenue, 0));
    const orderCount = series.reduce((sum, bucket) => sum + bucket.orders, 0);

    return {
      from,
      to,
      groupBy: granularity,
      series,
      total: {
        revenue,
        orders: orderCount,
        avgOrderValue: orderCount > 0 ? round2(revenue / orderCount) : 0,
      },
    };
  }

  // ------------------------------------------------------------ products

  async products(query: ReportRangeQueryDto) {
    const { from, to } = this.resolveRange(query.range);
    const paidInRange = this.paidOrderWhere(from, to);

    const [items, sold, available, reserved] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: { productId: { not: null }, order: paidInRange },
        select: {
          quantity: true,
          lineTotal: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              slug: true,
              origin: true,
              stoneType: true,
              categoryId: true,
              category: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.product.count({ where: { status: "Sold" } }),
      this.prisma.product.count({ where: { status: "Published" } }),
      this.prisma.product.count({ where: { status: "Reserved" } }),
    ]);

    const productMap = new Map<string, { productId: string; name: string; sku: string; slug: string; quantity: number; revenue: number }>();
    const categoryMap = new Map<string, { categoryId: string; name: string; quantity: number; revenue: number }>();
    const originMap = new Map<string, { origin: string; quantity: number; revenue: number }>();
    const stoneTypeMap = new Map<string, { stoneType: string; quantity: number; revenue: number }>();

    for (const item of items) {
      const product = item.product;
      if (!product) continue;
      const revenue = Number(item.lineTotal);

      const productEntry = productMap.get(product.id) ?? {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        slug: product.slug,
        quantity: 0,
        revenue: 0,
      };
      productEntry.quantity += item.quantity;
      productEntry.revenue += revenue;
      productMap.set(product.id, productEntry);

      const categoryEntry = categoryMap.get(product.categoryId) ?? {
        categoryId: product.categoryId,
        name: product.category.name,
        quantity: 0,
        revenue: 0,
      };
      categoryEntry.quantity += item.quantity;
      categoryEntry.revenue += revenue;
      categoryMap.set(product.categoryId, categoryEntry);

      const origin = product.origin || "Unknown";
      const originEntry = originMap.get(origin) ?? { origin, quantity: 0, revenue: 0 };
      originEntry.quantity += item.quantity;
      originEntry.revenue += revenue;
      originMap.set(origin, originEntry);

      const stoneType = product.stoneType || "Unknown";
      const stoneTypeEntry = stoneTypeMap.get(stoneType) ?? { stoneType, quantity: 0, revenue: 0 };
      stoneTypeEntry.quantity += item.quantity;
      stoneTypeEntry.revenue += revenue;
      stoneTypeMap.set(stoneType, stoneTypeEntry);
    }

    const withRoundedRevenue = <T extends { revenue: number }>(entry: T) => ({ ...entry, revenue: round2(entry.revenue) });

    const topProducts = [...productMap.values()]
      .map(withRoundedRevenue)
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 20);

    return {
      range: query.range,
      from,
      to,
      topProducts,
      categoryRevenue: [...categoryMap.values()].map(withRoundedRevenue).sort((a, b) => b.revenue - a.revenue),
      originRevenue: [...originMap.values()].map(withRoundedRevenue).sort((a, b) => b.revenue - a.revenue),
      stoneTypeRevenue: [...stoneTypeMap.values()].map(withRoundedRevenue).sort((a, b) => b.revenue - a.revenue),
      soldVsAvailable: { sold, available, reserved },
    };
  }

  // ------------------------------------------------------------ customers

  async customers(query: ReportRangeQueryDto) {
    const { from, to } = this.resolveRange(query.range);
    const paidInRange = this.paidOrderWhere(from, to);

    const [topGroups, newCustomers, repeatGroups, countryGroups] = await Promise.all([
      this.prisma.order.groupBy({
        by: ["customerId"],
        where: { ...paidInRange, customerId: { not: null } },
        _count: { _all: true },
        _sum: { total: true, refundedAmount: true },
        orderBy: { _sum: { total: "desc" } },
        take: 10,
      }),
      this.prisma.customer.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.order.groupBy({
        by: ["customerId"],
        where: { customerId: { not: null } },
        _count: { _all: true },
        having: { customerId: { _count: { gte: 2 } } },
      }),
      this.prisma.customer.groupBy({
        by: ["country"],
        where: { country: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const customerIds = topGroups
      .map((group) => group.customerId)
      .filter((id): id is string => id !== null);
    const customers = customerIds.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, email: true, country: true },
        })
      : [];
    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));

    const topCustomers = topGroups.flatMap((group) => {
      if (!group.customerId) return [];
      const customer = customerMap.get(group.customerId);
      return [
        {
          customerId: group.customerId,
          name: customer?.name ?? "Unknown customer",
          email: customer?.email ?? null,
          country: customer?.country ?? null,
          orderCount: group._count._all,
          totalSpent: round2(Number(group._sum.total ?? 0) - Number(group._sum.refundedAmount ?? 0)),
        },
      ];
    });

    const countries = countryGroups
      .flatMap((group) => (group.country ? [{ country: group.country, count: group._count._all }] : []))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      range: query.range,
      from,
      to,
      topCustomers,
      newVsRepeat: { newCustomers, repeatCustomers: repeatGroups.length },
      countries,
    };
  }

  // ------------------------------------------------------------ csv

  async exportSalesCsv(query: SalesReportQueryDto): Promise<string> {
    const report = await this.sales(query);
    const rows = report.series.map((entry) =>
      [entry.label, entry.revenue, entry.orders].map((value) => this.escapeCsv(value)).join(","),
    );
    return ["bucket,revenue,orders", ...rows].join("\n");
  }

  async exportProductsCsv(query: ReportRangeQueryDto): Promise<string> {
    const report = await this.products(query);
    const rows = report.topProducts.map((product, index) =>
      [index + 1, product.productId, product.name, product.sku, product.quantity, product.revenue]
        .map((value) => this.escapeCsv(value))
        .join(","),
    );
    return ["rank,productId,name,sku,quantity,revenue", ...rows].join("\n");
  }

  // ------------------------------------------------------------ traffic

  traffic() {
    return { integrated: false, note: "Google Analytics belum terhubung", series: [] };
  }
}
