import { Injectable, NotFoundException } from "@nestjs/common";
import { ContentStatus, Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake, type Paginated } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { slugify, uniqueSlug } from "../common/utils/slug";
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
} satisfies Prisma.BlogPostSelect;

export type BlogPostSummary = Prisma.BlogPostGetPayload<{ select: typeof blogSummarySelect }>;

@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ queries

  private buildWhere(query: BlogQueryDto, publicOnly: boolean): Prisma.BlogPostWhereInput {
    const where: Prisma.BlogPostWhereInput = {};

    if (publicOnly) {
      where.status = "Published";
      where.publishedAt = { lte: new Date() };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.tag) where.tags = { has: query.tag };

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
        { author: { contains: search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  async listPublic(query: BlogQueryDto): Promise<Paginated<BlogPostSummary>> {
    const where = this.buildWhere(query, true);

    const [total, posts] = await this.prisma.$transaction([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        select: blogSummarySelect,
        ...skipTake(query.page, query.pageSize),
      }),
    ]);

    return paginated(posts, total, query.page, query.pageSize);
  }

  async getPublicBySlug(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, status: "Published", publishedAt: { lte: new Date() } },
    });
    if (!post) throw new NotFoundException("Post not found");

    void this.prisma.blogPost
      .update({ where: { id: post.id }, data: { views: { increment: 1 } } })
      .catch(() => undefined);

    return post;
  }

  async tags(): Promise<string[]> {
    const posts = await this.prisma.blogPost.findMany({
      where: { status: "Published", publishedAt: { lte: new Date() } },
      select: { tags: true },
    });
    return [...new Set(posts.flatMap((post) => post.tags))].sort((a, b) => a.localeCompare(b));
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
