import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake, type Paginated } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { EmailService } from "../email/email.service";
import { renderNewReviewAdminEmail } from "../email/email.templates";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { CreateReviewDto, ReviewQueryDto } from "./dto/review.dto";

const reviewSelect = {
  id: true,
  name: true,
  rating: true,
  title: true,
  body: true,
  verifiedPurchase: true,
  createdAt: true,
} satisfies Prisma.ProductReviewSelect;

export type PublicReview = Prisma.ProductReviewGetPayload<{ select: typeof reviewSelect }>;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  private async findPublishedProduct(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: "Published" },
      select: { id: true, name: true },
    });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  // ------------------------------------------------------------ public

  async listPublic(
    slug: string,
    page = 1,
    pageSize = 10,
  ): Promise<Paginated<PublicReview> & { summary: { rating: number; count: number } }> {
    const product = await this.findPublishedProduct(slug);

    const [total, reviews, aggregate, count] = await this.prisma.$transaction([
      this.prisma.productReview.count({ where: { productId: product.id, status: "Published" } }),
      this.prisma.productReview.findMany({
        where: { productId: product.id, status: "Published" },
        orderBy: [{ createdAt: "desc" }],
        select: reviewSelect,
        ...skipTake(page, pageSize),
      }),
      this.prisma.productReview.aggregate({
        where: { productId: product.id, status: "Published" },
        _avg: { rating: true },
      }),
      this.prisma.productReview.count({ where: { productId: product.id, status: "Published" } }),
    ]);

    const rating = aggregate._avg.rating ? Math.round(aggregate._avg.rating * 10) / 10 : 0;

    return {
      ...paginated(reviews, total, page, pageSize),
      summary: { rating, count },
    };
  }

  async createForProduct(slug: string, dto: CreateReviewDto) {
    const product = await this.findPublishedProduct(slug);
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.productReview.findFirst({
      where: { productId: product.id, email, status: { not: "Rejected" } },
      select: { id: true },
    });
    if (existing) throw new BadRequestException("You have already submitted a review for this piece");

    const paidOrder = await this.prisma.order.findFirst({
      where: {
        email,
        paymentStatus: { in: ["Paid", "PartiallyRefunded", "Refunded"] },
        items: { some: { productId: product.id } },
      },
      orderBy: { placedAt: "desc" },
      select: { id: true },
    });

    const review = await this.prisma.productReview.create({
      data: {
        productId: product.id,
        orderId: paidOrder?.id ?? null,
        name: dto.name.trim(),
        email,
        rating: dto.rating,
        title: dto.title?.trim() || null,
        body: dto.body.trim(),
        status: "Pending",
        verifiedPurchase: Boolean(paidOrder),
      },
    });

    await this.prisma.notification.create({
      data: {
        type: "Review",
        title: `New review for ${product.name}`,
        body: `${review.rating}/5 from ${review.name}${review.verifiedPurchase ? " (verified purchase)" : ""}`,
        href: "/admin/reviews",
        entityType: "ProductReview",
        entityId: review.id,
      },
    });

    const storeEmail = await this.settings.getStoreEmail();
    await this.email.send({
      to: storeEmail,
      replyTo: email,
      subject: `New review pending — ${product.name} (${review.rating}/5)`,
      html: renderNewReviewAdminEmail({
        productName: product.name,
        name: review.name,
        rating: review.rating,
        title: review.title,
        body: review.body,
        verifiedPurchase: review.verifiedPurchase,
      }),
    });

    return { ok: true, pending: true };
  }

  // ------------------------------------------------------------ admin

  private buildAdminWhere(query: ReviewQueryDto): Prisma.ProductReviewWhereInput {
    const where: Prisma.ProductReviewWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.productId) where.productId = query.productId;
    if (query.rating) where.rating = query.rating;
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
        { product: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    return where;
  }

  async listAdmin(query: ReviewQueryDto) {
    const where = this.buildAdminWhere(query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [total, reviews, pendingCount] = await this.prisma.$transaction([
      this.prisma.productReview.count({ where }),
      this.prisma.productReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { product: { select: { id: true, name: true, slug: true } } },
        ...skipTake(page, pageSize),
      }),
      this.prisma.productReview.count({ where: { status: "Pending" } }),
    ]);

    return {
      ...paginated(
        reviews.map((review) => ({
          id: review.id,
          product: review.product,
          name: review.name,
          email: review.email,
          rating: review.rating,
          title: review.title,
          body: review.body,
          status: review.status,
          verifiedPurchase: review.verifiedPurchase,
          createdAt: review.createdAt,
        })),
        total,
        page,
        pageSize,
      ),
      pendingCount,
    };
  }

  async updateStatus(id: string, status: string, context: AuditContext) {
    const review = await this.prisma.productReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException("Review not found");

    const updated = await this.prisma.productReview.update({ where: { id }, data: { status: status as never } });
    await this.audit.log({
      adminId: context.adminId,
      action: "review.update_status",
      entityType: "ProductReview",
      entityId: id,
      summary: `Review by ${review.name} set to ${status}`,
      metadata: { from: review.status, to: status },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true, id: updated.id, status: updated.status };
  }

  async remove(id: string, context: AuditContext) {
    const review = await this.prisma.productReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException("Review not found");

    await this.prisma.productReview.delete({ where: { id } });
    await this.audit.log({
      adminId: context.adminId,
      action: "review.delete",
      entityType: "ProductReview",
      entityId: id,
      summary: `Deleted review by ${review.name}`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }
}
