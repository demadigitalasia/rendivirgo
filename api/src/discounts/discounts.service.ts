import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDiscountDto, DiscountQueryDto, UpdateDiscountDto, ValidateDiscountDto } from "./dto/discount.dto";

export const discountInclude = { category: true } satisfies Prisma.DiscountInclude;
export type DiscountWithCategory = Prisma.DiscountGetPayload<{ include: typeof discountInclude }>;

const round2 = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ mapping

  toApiDiscount(discount: DiscountWithCategory, orderCount = 0) {
    return {
      id: discount.id,
      code: discount.code,
      description: discount.description,
      type: discount.type,
      value: Number(discount.value),
      minSubtotal: Number(discount.minSubtotal),
      maxUses: discount.maxUses,
      usedCount: discount.usedCount,
      perCustomerLimit: discount.perCustomerLimit,
      startsAt: discount.startsAt,
      endsAt: discount.endsAt,
      isActive: discount.isActive,
      categoryId: discount.categoryId,
      category: discount.category
        ? { id: discount.category.id, slug: discount.category.slug, name: discount.category.name }
        : null,
      orderCount,
      createdAt: discount.createdAt,
      updatedAt: discount.updatedAt,
    };
  }

  // ------------------------------------------------------------ public validation

  private invalid(code: string, type: string | null, message: string) {
    return { valid: false, code, type, discountAmount: 0, freeShipping: false, message };
  }

  async validate(dto: ValidateDiscountDto) {
    const code = dto.code.trim().toUpperCase();
    const discount = await this.prisma.discount.findFirst({
      where: { code: { equals: code, mode: "insensitive" } },
    });

    if (!discount) return this.invalid(code, null, "Discount code not found");
    if (!discount.isActive) return this.invalid(discount.code, discount.type, "This discount code is not active");

    const now = new Date();
    if (discount.startsAt && discount.startsAt > now) {
      return this.invalid(discount.code, discount.type, "This discount code is not active yet");
    }
    if (discount.endsAt && discount.endsAt < now) {
      return this.invalid(discount.code, discount.type, "This discount code has expired");
    }
    if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
      return this.invalid(discount.code, discount.type, "This discount code has reached its usage limit");
    }

    let base = dto.subtotal;
    if (discount.categoryId) {
      if (!dto.items?.length) {
        throw new BadRequestException(
          "This discount applies to a specific category. Send the cart items (productId, quantity, lineTotal) to validate it.",
        );
      }

      const productIds = [...new Set(dto.items.map((item) => item.productId))];
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, categoryId: true },
      });
      const eligibleIds = new Set(
        products.filter((product) => product.categoryId === discount.categoryId).map((product) => product.id),
      );
      base = dto.items
        .filter((item) => eligibleIds.has(item.productId))
        .reduce((sum, item) => sum + item.lineTotal, 0);

      if (base <= 0) {
        return this.invalid(discount.code, discount.type, "This discount does not apply to any item in the cart");
      }
    }

    const minSubtotal = Number(discount.minSubtotal);
    if (base < minSubtotal) {
      return this.invalid(
        discount.code,
        discount.type,
        `A minimum subtotal of ${minSubtotal.toFixed(2)} is required for this code`,
      );
    }

    const value = Number(discount.value);
    let discountAmount = 0;
    let freeShipping = false;

    switch (discount.type) {
      case "Percentage":
        discountAmount = round2((base * value) / 100);
        break;
      case "Fixed":
        discountAmount = round2(value);
        break;
      case "FreeShipping":
        freeShipping = true;
        break;
    }

    discountAmount = Math.min(discountAmount, round2(base));

    return {
      valid: true,
      code: discount.code,
      type: discount.type,
      discountAmount,
      freeShipping,
      message: "Discount code applied",
    };
  }

  // ------------------------------------------------------------ admin queries

  async listAdmin(query: DiscountQueryDto) {
    const where: Prisma.DiscountWhereInput = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, discounts] = await Promise.all([
      this.prisma.discount.count({ where }),
      this.prisma.discount.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: discountInclude,
        ...skipTake(query.page, query.pageSize),
      }),
    ]);

    const ids = discounts.map((discount) => discount.id);
    const orderCounts = ids.length
      ? await this.prisma.order.groupBy({
          by: ["discountId"],
          where: { discountId: { in: ids } },
          _count: { _all: true },
        })
      : [];
    const orderCountMap = new Map(orderCounts.map((entry) => [entry.discountId, entry._count._all]));

    return paginated(
      discounts.map((discount) => this.toApiDiscount(discount, orderCountMap.get(discount.id) ?? 0)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async getAdminById(id: string) {
    const discount = await this.prisma.discount.findUnique({ where: { id }, include: discountInclude });
    if (!discount) throw new NotFoundException("Discount not found");
    const orderCount = await this.prisma.order.count({ where: { discountId: id } });
    return this.toApiDiscount(discount, orderCount);
  }

  // ------------------------------------------------------------ admin mutations

  private async assertCodeAvailable(code: string, excludeId?: string) {
    const existing = await this.prisma.discount.findFirst({
      where: {
        code: { equals: code, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) throw new BadRequestException(`Discount code "${code}" is already used`);
  }

  private async assertCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new BadRequestException("Category not found");
  }

  async create(dto: CreateDiscountDto, context: AuditContext) {
    const code = dto.code.trim().toUpperCase();
    await this.assertCodeAvailable(code);
    if (dto.categoryId) await this.assertCategory(dto.categoryId);

    const discount = await this.prisma.discount.create({
      data: {
        code,
        description: dto.description ?? null,
        type: dto.type,
        value: new Prisma.Decimal(dto.value),
        minSubtotal: new Prisma.Decimal(dto.minSubtotal ?? 0),
        maxUses: dto.maxUses ?? null,
        perCustomerLimit: dto.perCustomerLimit ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isActive: dto.isActive ?? true,
        categoryId: dto.categoryId ?? null,
      },
      include: discountInclude,
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "discount.create",
      entityType: "Discount",
      entityId: discount.id,
      summary: `Created discount "${discount.code}" (${discount.type})`,
      metadata: { code: discount.code, type: discount.type, value: Number(discount.value) },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiDiscount(discount);
  }

  async update(id: string, dto: UpdateDiscountDto, context: AuditContext) {
    const existing = await this.prisma.discount.findUnique({ where: { id }, include: discountInclude });
    if (!existing) throw new NotFoundException("Discount not found");

    const code = dto.code !== undefined ? dto.code.trim().toUpperCase() : undefined;
    if (code && code !== existing.code) await this.assertCodeAvailable(code, id);
    if (dto.categoryId) await this.assertCategory(dto.categoryId);

    const discount = await this.prisma.discount.update({
      where: { id },
      data: {
        ...(code !== undefined ? { code } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.value !== undefined ? { value: new Prisma.Decimal(dto.value) } : {}),
        ...(dto.minSubtotal !== undefined ? { minSubtotal: new Prisma.Decimal(dto.minSubtotal) } : {}),
        ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses } : {}),
        ...(dto.perCustomerLimit !== undefined ? { perCustomerLimit: dto.perCustomerLimit } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId ?? null } : {}),
      },
      include: discountInclude,
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "discount.update",
      entityType: "Discount",
      entityId: discount.id,
      summary: `Updated discount "${discount.code}"`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiDiscount(discount);
  }

  async remove(id: string, context: AuditContext) {
    const existing = await this.prisma.discount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Discount not found");

    await this.prisma.discount.delete({ where: { id } });

    await this.audit.log({
      adminId: context.adminId,
      action: "discount.delete",
      entityType: "Discount",
      entityId: id,
      summary: `Deleted discount "${existing.code}"`,
      metadata: { code: existing.code },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }

  async toggle(id: string, context: AuditContext) {
    const existing = await this.prisma.discount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Discount not found");

    const discount = await this.prisma.discount.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: discountInclude,
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "discount.toggle",
      entityType: "Discount",
      entityId: discount.id,
      summary: `${discount.isActive ? "Activated" : "Deactivated"} discount "${discount.code}"`,
      metadata: { isActive: discount.isActive },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiDiscount(discount);
  }
}
