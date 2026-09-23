import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { slugify, uniqueSlug } from "../common/utils/slug";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";
import type { AuditContext } from "../common/types/audit-context";

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPublic() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { products: { where: { status: "Published" } } } },
      },
    });
    return categories.map(({ _count, ...category }) => ({ ...category, productCount: _count.products }));
  }

  async listAdmin() {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    return categories.map(({ _count, ...category }) => ({ ...category, productCount: _count.products }));
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category || !category.isActive) throw new NotFoundException("Category not found");
    return category;
  }

  async create(dto: CreateCategoryDto, context: AuditContext) {
    const slug = dto.slug ? slugify(dto.slug) : await uniqueSlug(slugify(dto.name), (candidate) => this.prisma.category.findUnique({ where: { slug: candidate } }));

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        ...(dto.tone ? { tone: dto.tone } : {}),
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        metaTitle: dto.metaTitle ?? null,
        metaDescription: dto.metaDescription ?? null,
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "category.create",
      entityType: "Category",
      entityId: category.id,
      summary: `Created category "${category.name}"`,
      metadata: { slug: category.slug },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto, context: AuditContext) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Category not found");

    const slug = dto.slug && slugify(dto.slug) !== existing.slug
      ? await uniqueSlug(slugify(dto.slug), (candidate) => this.prisma.category.findUnique({ where: { slug: candidate } }))
      : undefined;

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(slug ? { slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.tone !== undefined ? { tone: dto.tone } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.metaTitle !== undefined ? { metaTitle: dto.metaTitle } : {}),
        ...(dto.metaDescription !== undefined ? { metaDescription: dto.metaDescription } : {}),
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "category.update",
      entityType: "Category",
      entityId: category.id,
      summary: `Updated category "${category.name}"`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return category;
  }

  async remove(id: string, context: AuditContext, force = false) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException("Category not found");

    if (category._count.products > 0) {
      if (!force) {
        throw new BadRequestException(`Category still has ${category._count.products} product(s). Move or archive them first.`);
      }
      await this.prisma.product.updateMany({ where: { categoryId: id }, data: { status: "Archived" } });
    }

    await this.prisma.category.delete({ where: { id } });

    await this.audit.log({
      adminId: context.adminId,
      action: "category.delete",
      entityType: "Category",
      entityId: id,
      summary: `Deleted category "${category.name}"${force ? " and archived its products" : ""}`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }
}
