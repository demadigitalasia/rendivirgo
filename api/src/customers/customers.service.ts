import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import type { Customer } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerQueryDto, UpdateCustomerDto } from "./dto/customer.dto";

type CustomerStats = {
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
};

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ mapping

  private toApiCustomer(customer: Customer, stats?: CustomerStats) {
    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      tags: customer.tags,
      notes: customer.notes,
      acceptsMarketing: customer.acceptsMarketing,
      address: {
        line1: customer.addressLine1,
        line2: customer.addressLine2,
        city: customer.city,
        state: customer.state,
        postalCode: customer.postalCode,
        country: customer.country,
        countryCode: customer.countryCode,
      },
      orderCount: stats?.orderCount ?? 0,
      totalSpent: stats?.totalSpent ?? 0,
      lastOrderAt: stats?.lastOrderAt ?? null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  // ------------------------------------------------------------ queries

  private buildWhere(query: CustomerQueryDto): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = {};

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (query.tag?.trim()) {
      where.tags = { has: query.tag.trim() };
    }

    return where;
  }

  private async orderStats(customerIds: string[]): Promise<Map<string, CustomerStats>> {
    const stats = new Map<string, CustomerStats>();
    if (!customerIds.length) return stats;

    const [allOrders, paidOrders] = await this.prisma.$transaction([
      this.prisma.order.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds } },
        _count: { _all: true },
        _max: { placedAt: true },
      }),
      this.prisma.order.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds }, paymentStatus: { in: ["Paid", "PartiallyRefunded"] } },
        _sum: { total: true, refundedAmount: true },
      }),
    ]);

    for (const row of allOrders) {
      if (!row.customerId) continue;
      stats.set(row.customerId, { orderCount: row._count._all, totalSpent: 0, lastOrderAt: row._max.placedAt ?? null });
    }

    for (const row of paidOrders) {
      if (!row.customerId) continue;
      const entry = stats.get(row.customerId) ?? { orderCount: 0, totalSpent: 0, lastOrderAt: null };
      entry.totalSpent = Number(row._sum.total ?? 0) - Number(row._sum.refundedAmount ?? 0);
      stats.set(row.customerId, entry);
    }

    return stats;
  }

  async list(query: CustomerQueryDto) {
    const where = this.buildWhere(query);

    const [total, customers] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...skipTake(query.page, query.pageSize),
      }),
    ]);

    const stats = await this.orderStats(customers.map((customer) => customer.id));

    return paginated(
      customers.map((customer) => this.toApiCustomer(customer, stats.get(customer.id))),
      total,
      query.page,
      query.pageSize,
    );
  }

  async detail(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException("Customer not found");

    const orders = await this.prisma.order.findMany({
      where: { customerId: id },
      orderBy: { placedAt: "desc" },
      include: { _count: { select: { items: true } } },
    });

    const stats = await this.orderStats([id]);

    return {
      ...this.toApiCustomer(customer, stats.get(id)),
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        currency: order.currency,
        total: order.total,
        refundedAmount: order.refundedAmount,
        itemCount: order._count.items,
        placedAt: order.placedAt,
      })),
    };
  }

  // ------------------------------------------------------------ mutations

  async update(id: string, dto: UpdateCustomerDto, context: AuditContext) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Customer not found");

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.acceptsMarketing !== undefined ? { acceptsMarketing: dto.acceptsMarketing } : {}),
        ...(dto.addressLine1 !== undefined ? { addressLine1: dto.addressLine1 } : {}),
        ...(dto.addressLine2 !== undefined ? { addressLine2: dto.addressLine2 } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.countryCode !== undefined ? { countryCode: dto.countryCode } : {}),
      },
    });

    const stats = await this.orderStats([id]);

    await this.audit.log({
      adminId: context.adminId,
      action: "customer.update",
      entityType: "Customer",
      entityId: customer.id,
      summary: `Updated customer "${customer.name}" (${customer.email})`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiCustomer(customer, stats.get(id));
  }

  async remove(id: string, context: AuditContext) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException("Customer not found");

    await this.prisma.customer.delete({ where: { id } });

    await this.audit.log({
      adminId: context.adminId,
      action: "customer.delete",
      entityType: "Customer",
      entityId: id,
      summary: `Deleted customer "${customer.name}" (${customer.email})`,
      metadata: { email: customer.email },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }

  // ------------------------------------------------------------ csv

  async exportCsv(query: CustomerQueryDto): Promise<string> {
    const where = this.buildWhere(query);
    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const stats = await this.orderStats(customers.map((customer) => customer.id));

    const escape = (value: unknown) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const columns = ["name", "email", "phone", "country", "city", "orderCount", "totalSpent", "tags", "createdAt"];

    const rows = customers.map((customer) => {
      const entry = stats.get(customer.id);
      return [
        customer.name,
        customer.email,
        customer.phone ?? "",
        customer.country ?? "",
        customer.city ?? "",
        entry?.orderCount ?? 0,
        (entry?.totalSpent ?? 0).toFixed(2),
        customer.tags.join("|"),
        customer.createdAt.toISOString(),
      ]
        .map(escape)
        .join(",");
    });

    return [columns.join(","), ...rows].join("\n");
  }
}
