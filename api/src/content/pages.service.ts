import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { slugify, uniqueSlug } from "../common/utils/slug";
import type { StorefrontLanguage } from "../common/utils/storefront-language";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePageDto, PageQueryDto, UpdatePageDto } from "./dto/content.dto";

export const pageFooterSelect = {
  id: true,
  slug: true,
  title: true,
  titleId: true,
  idTranslationStatus: true,
  sortOrder: true,
  showInFooter: true,
} satisfies Prisma.PageSelect;

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toPublic<T extends {
    title: string; titleId: string | null; body?: string; bodyId?: string | null;
    metaTitle?: string | null; metaTitleId?: string | null; metaDescription?: string | null; metaDescriptionId?: string | null;
    idTranslationStatus: string;
  }>(page: T, language: StorefrontLanguage) {
    const idReady = language === "id" && page.idTranslationStatus === "Ready" && Boolean(page.titleId?.trim()) &&
      (page.body === undefined || !page.body.trim() || Boolean(page.bodyId?.trim()));
    const { titleId, bodyId, metaTitleId, metaDescriptionId, idTranslationStatus, ...publicPage } = page;
    return {
      ...publicPage,
      title: idReady ? titleId! : page.title,
      ...(page.body !== undefined ? { body: idReady ? bodyId ?? page.body : page.body } : {}),
      ...(page.metaTitle !== undefined ? { metaTitle: idReady ? metaTitleId : page.metaTitle } : {}),
      ...(page.metaDescription !== undefined ? { metaDescription: idReady ? metaDescriptionId : page.metaDescription } : {}),
      contentLocale: idReady ? "id" : "en",
    };
  }

  // ------------------------------------------------------------ queries

  async listPublic(language: StorefrontLanguage = "en") {
    const pages = await this.prisma.page.findMany({
      where: { status: "Published" },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: pageFooterSelect,
    });
    return pages.map((page) => this.toPublic(page, language));
  }

  async getPublicBySlug(slug: string, language: StorefrontLanguage = "en") {
    const page = await this.prisma.page.findFirst({ where: { slug, status: "Published" } });
    if (!page) throw new NotFoundException("Page not found");
    return this.toPublic(page, language);
  }

  async listAdmin(query: PageQueryDto) {
    const where: Prisma.PageWhereInput = {};

    if (query.status) where.status = query.status;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, pages] = await this.prisma.$transaction([
      this.prisma.page.count({ where }),
      this.prisma.page.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        ...skipTake(query.page, query.pageSize),
      }),
    ]);

    return paginated(pages, total, query.page, query.pageSize);
  }

  async getAdminById(id: string) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException("Page not found");
    return page;
  }

  // ------------------------------------------------------------ mutations

  async create(dto: CreatePageDto, context: AuditContext) {
    const slug = await uniqueSlug(slugify(dto.slug ?? dto.title), (candidate) =>
      this.prisma.page.findUnique({ where: { slug: candidate } }),
    );

    const page = await this.prisma.page.create({
      data: {
        slug,
        title: dto.title,
        body: dto.body ?? "",
        status: dto.status ?? "Published",
        showInFooter: dto.showInFooter ?? true,
        sortOrder: dto.sortOrder ?? 0,
        metaTitle: dto.metaTitle ?? null,
        metaDescription: dto.metaDescription ?? null,
        titleId: dto.titleId ?? null,
        bodyId: dto.bodyId ?? null,
        metaTitleId: dto.metaTitleId ?? null,
        metaDescriptionId: dto.metaDescriptionId ?? null,
        idTranslationStatus: dto.idTranslationStatus ?? "Missing",
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "page.create",
      entityType: "Page",
      entityId: page.id,
      summary: `Created page "${page.title}"`,
      metadata: { slug: page.slug, status: page.status },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return page;
  }

  async update(id: string, dto: UpdatePageDto, context: AuditContext) {
    const existing = await this.prisma.page.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Page not found");

    const slug =
      dto.slug && slugify(dto.slug) !== existing.slug
        ? await uniqueSlug(slugify(dto.slug), (candidate) =>
            this.prisma.page.findUnique({ where: { slug: candidate } }),
          )
        : undefined;

    const page = await this.prisma.page.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(slug ? { slug } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.showInFooter !== undefined ? { showInFooter: dto.showInFooter } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.metaTitle !== undefined ? { metaTitle: dto.metaTitle } : {}),
        ...(dto.metaDescription !== undefined ? { metaDescription: dto.metaDescription } : {}),
        ...(dto.titleId !== undefined ? { titleId: dto.titleId } : {}),
        ...(dto.bodyId !== undefined ? { bodyId: dto.bodyId } : {}),
        ...(dto.metaTitleId !== undefined ? { metaTitleId: dto.metaTitleId } : {}),
        ...(dto.metaDescriptionId !== undefined ? { metaDescriptionId: dto.metaDescriptionId } : {}),
        ...(dto.idTranslationStatus !== undefined ? { idTranslationStatus: dto.idTranslationStatus } : {}),
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "page.update",
      entityType: "Page",
      entityId: page.id,
      summary: `Updated page "${page.title}"`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return page;
  }

  async remove(id: string, context: AuditContext) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException("Page not found");

    await this.prisma.page.delete({ where: { id } });

    await this.audit.log({
      adminId: context.adminId,
      action: "page.delete",
      entityType: "Page",
      entityId: id,
      summary: `Deleted page "${page.title}"`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }
}
