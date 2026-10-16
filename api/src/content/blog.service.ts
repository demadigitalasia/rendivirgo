import { Injectable, NotFoundException } from "@nestjs/common";
import { ContentStatus, Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake, type Paginated } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { slugify, uniqueSlug } from "../common/utils/slug";
import type { StorefrontLanguage } from "../common/utils/storefront-language";
import { PrismaService } from "../prisma/prisma.service";
import { BlogQueryDto, CreateBlogPostDto, UpdateBlogPostDto } from "./dto/content.dto";

export const blogSummarySelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  tags: true,
  author: true,
  readMinutes: true,
  publishedAt: true,
  views: true,
  metaTitle: true,
  metaDescription: true,
  titleId: true,
  excerptId: true,
  bodyId: true,
  tagsId: true,
  metaTitleId: true,
  metaDescriptionId: true,
  idTranslationStatus: true,
} satisfies Prisma.BlogPostSelect;

export type BlogPostSummary = Prisma.BlogPostGetPayload<{ select: typeof blogSummarySelect }>;

@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toPublic<T extends {
    title: string; excerpt: string; tags: string[]; metaTitle: string | null; metaDescription: string | null;
    titleId: string | null; excerptId: string | null; bodyId: string | null; tagsId: string[];
    metaTitleId: string | null; metaDescriptionId: string | null; idTranslationStatus: string; body?: string;
  }>(post: T, language: StorefrontLanguage) {
    const idReady = language === "id" && post.idTranslationStatus === "Ready" && Boolean(post.titleId?.trim()) &&
      (!post.excerpt.trim() || Boolean(post.excerptId?.trim())) &&
      post.tagsId.length === post.tags.length &&
      (post.body === undefined || !post.body.trim() || Boolean(post.bodyId?.trim()));
    const { titleId, excerptId, bodyId, tagsId, metaTitleId, metaDescriptionId, idTranslationStatus, ...publicPost } = post;
    return {
      ...publicPost,
      title: idReady ? titleId! : post.title,
      excerpt: idReady ? excerptId ?? post.excerpt : post.excerpt,
      ...(post.body !== undefined ? { body: idReady ? bodyId ?? post.body : post.body } : {}),
      tags: idReady ? tagsId : post.tags,
      metaTitle: idReady ? metaTitleId : post.metaTitle,
      metaDescription: idReady ? metaDescriptionId : post.metaDescription,
      contentLocale: idReady ? "id" : "en",
    };
  }

  // ------------------------------------------------------------ queries

  private buildWhere(query: BlogQueryDto, publicOnly: boolean, language: StorefrontLanguage = "en"): Prisma.BlogPostWhereInput {
    const where: Prisma.BlogPostWhereInput = {};

    if (publicOnly) {
      where.status = "Published";
      where.publishedAt = { lte: new Date() };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.tag) where.OR = [
      { tags: { has: query.tag } },
      ...(language === "id" ? [{ tagsId: { has: query.tag } }] : []),
    ];

    const search = query.search?.trim();
    if (search) {
      const searchOr: Prisma.BlogPostWhereInput[] = [
        { title: { contains: search, mode: "insensitive" } },
        ...(language === "id" ? [{ titleId: { contains: search, mode: "insensitive" as const } }] : []),
        { excerpt: { contains: search, mode: "insensitive" } },
        ...(language === "id" ? [{ excerptId: { contains: search, mode: "insensitive" as const } }] : []),
        { body: { contains: search, mode: "insensitive" } },
        ...(language === "id" ? [{ bodyId: { contains: search, mode: "insensitive" as const } }] : []),
        { author: { contains: search, mode: "insensitive" } },
      ];
      where.AND = [{ OR: searchOr }];
    }

    return where;
  }

  async listPublic(query: BlogQueryDto, language: StorefrontLanguage = "en") {
    const where = this.buildWhere(query, true, language);

    const [total, posts] = await this.prisma.$transaction([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        select: blogSummarySelect,
        ...skipTake(query.page, query.pageSize),
      }),
    ]);

    return paginated(posts.map((post) => this.toPublic(post, language)), total, query.page, query.pageSize);
  }

  async getPublicBySlug(slug: string, language: StorefrontLanguage = "en") {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, status: "Published", publishedAt: { lte: new Date() } },
    });
    if (!post) throw new NotFoundException("Post not found");

    void this.prisma.blogPost
      .update({ where: { id: post.id }, data: { views: { increment: 1 } } })
      .catch(() => undefined);

    return this.toPublic(post, language);
  }

  async tags(language: StorefrontLanguage = "en"): Promise<string[]> {
    const posts = await this.prisma.blogPost.findMany({
      where: { status: "Published", publishedAt: { lte: new Date() } },
      select: { tags: true, tagsId: true, idTranslationStatus: true },
    });
    return [...new Set(posts.flatMap((post) => language === "id" && post.idTranslationStatus === "Ready" && post.tagsId.length === post.tags.length ? post.tagsId : post.tags))]
      .sort((a, b) => a.localeCompare(b, language === "id" ? "id-ID" : "en-GB"));
  }

  async listAdmin(query: BlogQueryDto) {
    const where = this.buildWhere(query, false);

    const [total, posts] = await this.prisma.$transaction([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        ...skipTake(query.page, query.pageSize),
      }),
    ]);

    return paginated(posts, total, query.page, query.pageSize);
  }

  async getAdminById(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  // ------------------------------------------------------------ mutations

  private resolvePublishedAt(
    input: string | null | undefined,
    status: ContentStatus,
    existing: Date | null,
  ): Date | null {
    if (input !== undefined) {
      return input === null || input === "" ? null : new Date(input);
    }
    if (status === "Published" && !existing) return new Date();
    return existing;
  }

  async create(dto: CreateBlogPostDto, context: AuditContext) {
    const slug = await uniqueSlug(slugify(dto.slug ?? dto.title), (candidate) =>
      this.prisma.blogPost.findUnique({ where: { slug: candidate } }),
    );

    const status = dto.status ?? "Draft";
    const publishedAt = this.resolvePublishedAt(dto.publishedAt, status, null);

    const post = await this.prisma.blogPost.create({
      data: {
        slug,
        title: dto.title,
        excerpt: dto.excerpt ?? "",
        body: dto.body ?? "",
        coverImage: dto.coverImage ?? null,
        tags: dto.tags ?? [],
        status,
        author: dto.author ?? "RENDI VIRGO",
        readMinutes: dto.readMinutes ?? 5,
        metaTitle: dto.metaTitle ?? null,
        metaDescription: dto.metaDescription ?? null,
        titleId: dto.titleId ?? null,
        excerptId: dto.excerptId ?? null,
        bodyId: dto.bodyId ?? null,
        tagsId: dto.tagsId ?? [],
        metaTitleId: dto.metaTitleId ?? null,
        metaDescriptionId: dto.metaDescriptionId ?? null,
        idTranslationStatus: dto.idTranslationStatus ?? "Missing",
        publishedAt,
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "blog.create",
      entityType: "BlogPost",
      entityId: post.id,
      summary: `Created blog post "${post.title}"`,
      metadata: { slug: post.slug, status: post.status },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return post;
  }

  async update(id: string, dto: UpdateBlogPostDto, context: AuditContext) {
    const existing = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Post not found");

    const slug =
      dto.slug && slugify(dto.slug) !== existing.slug
        ? await uniqueSlug(slugify(dto.slug), (candidate) =>
            this.prisma.blogPost.findUnique({ where: { slug: candidate } }),
          )
        : undefined;

    const nextStatus = dto.status ?? existing.status;
    const publishedAt = this.resolvePublishedAt(dto.publishedAt, nextStatus, existing.publishedAt);
    const shouldUpdatePublishedAt =
      dto.publishedAt !== undefined || (nextStatus === "Published" && !existing.publishedAt);

    const post = await this.prisma.blogPost.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(slug ? { slug } : {}),
        ...(dto.excerpt !== undefined ? { excerpt: dto.excerpt } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.coverImage !== undefined ? { coverImage: dto.coverImage } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.author !== undefined ? { author: dto.author } : {}),
        ...(dto.readMinutes !== undefined ? { readMinutes: dto.readMinutes } : {}),
        ...(dto.metaTitle !== undefined ? { metaTitle: dto.metaTitle } : {}),
        ...(dto.metaDescription !== undefined ? { metaDescription: dto.metaDescription } : {}),
        ...(dto.titleId !== undefined ? { titleId: dto.titleId } : {}),
        ...(dto.excerptId !== undefined ? { excerptId: dto.excerptId } : {}),
        ...(dto.bodyId !== undefined ? { bodyId: dto.bodyId } : {}),
        ...(dto.tagsId !== undefined ? { tagsId: dto.tagsId } : {}),
        ...(dto.metaTitleId !== undefined ? { metaTitleId: dto.metaTitleId } : {}),
        ...(dto.metaDescriptionId !== undefined ? { metaDescriptionId: dto.metaDescriptionId } : {}),
        ...(dto.idTranslationStatus !== undefined ? { idTranslationStatus: dto.idTranslationStatus } : {}),
        ...(shouldUpdatePublishedAt ? { publishedAt } : {}),
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "blog.update",
      entityType: "BlogPost",
      entityId: post.id,
      summary: `Updated blog post "${post.title}"`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return post;
  }

  async remove(id: string, context: AuditContext) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException("Post not found");

    await this.prisma.blogPost.delete({ where: { id } });

    await this.audit.log({
      adminId: context.adminId,
      action: "blog.delete",
      entityType: "BlogPost",
      entityId: id,
      summary: `Deleted blog post "${post.title}"`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }
}
