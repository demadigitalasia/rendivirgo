import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { slugify, uniqueSlug } from "../common/utils/slug";
import { PrismaService } from "../prisma/prisma.service";
import { CreateConditionDto, UpdateConditionDto } from "./dto/condition.dto";

@Injectable()
export class ConditionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listPublic() {
    return this.prisma.conditionOption.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async listAdmin() {
    const options = await this.prisma.conditionOption.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const counts = await this.prisma.product.groupBy({ by: ["condition"], _count: { _all: true } });
    const countByName = new Map(counts.map((item) => [item.condition, item._count._all]));
    return options.map((item) => ({ ...item, productCount: countByName.get(item.name) ?? 0 }));
  }

  async create(dto: CreateConditionDto, context: AuditContext) {
    const name = dto.name.trim();
    const slug = dto.slug
      ? await uniqueSlug(slugify(dto.slug), (candidate) => this.prisma.conditionOption.findUnique({ where: { slug: candidate } }))
      : await uniqueSlug(slugify(name), (candidate) => this.prisma.conditionOption.findUnique({ where: { slug: candidate } }));
    const option = await this.prisma.conditionOption.create({
      data: {
        name,
        slug,
        note: dto.note?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({
      adminId: context.adminId,
      action: "condition.create",
      entityType: "ConditionOption",
      entityId: option.id,
      summary: `Created condition "${option.name}"`,
      metadata: { slug: option.slug },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return option;
  }

  async update(id: string, dto: UpdateConditionDto, context: AuditContext) {
    const existing = await this.prisma.conditionOption.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Condition not found");
    const name = dto.name?.trim();
    const slug = dto.slug && slugify(dto.slug) !== existing.slug
      ? await uniqueSlug(slugify(dto.slug), (candidate) => this.prisma.conditionOption.findUnique({ where: { slug: candidate } }))
      : undefined;
    const option = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.conditionOption.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(slug ? { slug } : {}),
          ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      if (name && name !== existing.name) {
        await tx.product.updateMany({ where: { condition: existing.name }, data: { condition: name } });
      }
      return updated;
    });
    await this.audit.log({
      adminId: context.adminId,
      action: "condition.update",
      entityType: "ConditionOption",
      entityId: option.id,
      summary: `Updated condition "${option.name}"`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return option;
  }

  async remove(id: string, context: AuditContext) {
    const option = await this.prisma.conditionOption.findUnique({ where: { id } });
    if (!option) throw new NotFoundException("Condition not found");
    const productCount = await this.prisma.product.count({ where: { condition: option.name } });
    if (productCount) {
      throw new BadRequestException(`Condition is used by ${productCount} product(s). Deactivate it to keep existing product records intact.`);
    }
    await this.prisma.conditionOption.delete({ where: { id } });
    await this.audit.log({
      adminId: context.adminId,
      action: "condition.delete",
      entityType: "ConditionOption",
      entityId: id,
      summary: `Deleted condition "${option.name}"`,
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return { ok: true };
  }
}
