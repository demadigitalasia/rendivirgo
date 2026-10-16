import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { slugify, uniqueSlug } from "../common/utils/slug";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";
import type { AuditContext } from "../common/types/audit-context";
import type { StorefrontLanguage } from "../common/utils/storefront-language";

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toPublic(category: Prisma.CategoryGetPayload<object>, language: StorefrontLanguage) {
    const idReady = language === "id" && category.idTranslationStatus === "Ready" && Boolean(category.nameId?.trim()) &&
      (!category.description?.trim() || Boolean(category.descriptionId?.trim()));
    const { nameId, descriptionId, metaTitleId, metaDescriptionId, idTranslationStatus, ...publicCategory } = category;
    return {
      ...publicCategory,
      name: idReady ? nameId! : category.name,
      description: idReady ? descriptionId ?? category.description : category.description,
      metaTitle: idReady ? metaTitleId : category.metaTitle,
      metaDescription: idReady ? metaDescriptionId : category.metaDescription,
      contentLocale: idReady ? "id" : "en",
    };
  }

  async listPublic(language: StorefrontLanguage = "en") {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { products: { where: { status: "Published" } } } },
      },
    });
    return categories.map(({ _count, ...category }) => ({ ...this.toPublic(category, language), productCount: _count.products }));
  }

  async listAdmin() {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    return categories.map(({ _count, ...category }) => ({ ...category, productCount: _count.products }));
  }

  async findBySlug(slug: string, language: StorefrontLanguage = "en") {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category || !category.isActive) throw new NotFoundException("Category not found");
    return this.toPublic(category, language);
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
        nameId: dto.nameId ?? null,
        descriptionId: dto.descriptionId ?? null,
        metaTitleId: dto.metaTitleId ?? null,
        metaDescriptionId: dto.metaDescriptionId ?? null,
        idTranslationStatus: dto.idTranslationStatus ?? "Missing",
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
        ...(dto.nameId !== undefined ? { nameId: dto.nameId } : {}),
        ...(dto.descriptionId !== undefined ? { descriptionId: dto.descriptionId } : {}),
        ...(dto.metaTitleId !== undefined ? { metaTitleId: dto.metaTitleId } : {}),
        ...(dto.metaDescriptionId !== undefined ? { metaDescriptionId: dto.metaDescriptionId } : {}),
        ...(dto.idTranslationStatus !== undefined ? { idTranslationStatus: dto.idTranslationStatus } : {}),
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
