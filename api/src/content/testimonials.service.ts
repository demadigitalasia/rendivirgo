import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTestimonialDto, TestimonialQueryDto, UpdateTestimonialDto } from "./dto/content.dto";

export const testimonialInclude = {
  product: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.TestimonialInclude;

export type TestimonialWithProduct = Prisma.TestimonialGetPayload<{ include: typeof testimonialInclude }>;

@Injectable()
export class TestimonialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ queries

  async listPublic() {
    return this.prisma.testimonial.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: testimonialInclude,
    });
  }

  async listAdmin(query: TestimonialQueryDto) {
    const where: Prisma.TestimonialWhereInput = {};

    if (query.isPublished !== undefined) where.isPublished = query.isPublished;
    if (query.productId) where.productId = query.productId;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { quote: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, testimonials] = await this.prisma.$transaction([
      this.prisma.testimonial.count({ where }),
      this.prisma.testimonial.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: testimonialInclude,
        ...skipTake(query.page, query.pageSize),
      }),
    ]);

    return paginated(testimonials, total, query.page, query.pageSize);
  }

  async getAdminById(id: string) {
    const testimonial = await this.prisma.testimonial.findUnique({ where: { id }, include: testimonialInclude });
    if (!testimonial) throw new NotFoundException("Testimonial not found");
    return testimonial;
  }

  // ------------------------------------------------------------ mutations

  private async assertProduct(productId: string | null | undefined) {
    if (!productId) return;
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new BadRequestException("Product not found");
  }

  async create(dto: CreateTestimonialDto, context: AuditContext) {
    await this.assertProduct(dto.productId);

    const testimonial = await this.prisma.testimonial.create({
      data: {
        customerName: dto.customerName,
        location: dto.location ?? null,
        quote: dto.quote,
        rating: dto.rating ?? 5,
        productId: dto.productId ?? null,
        isPublished: dto.isPublished ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: testimonialInclude,
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "testimonial.create",
      entityType: "Testimonial",
      entityId: testimonial.id,
      summary: `Created testimonial from "${testimonial.customerName}"`,
      metadata: { rating: testimonial.rating, isPublished: testimonial.isPublished },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return testimonial;
  }

  async update(id: string, dto: UpdateTestimonialDto, context: AuditContext) {
    const existing = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Testimonial not found");

    await this.assertProduct(dto.productId);

    const testimonial = await this.prisma.testimonial.update({
      where: { id },
      data: {
        ...(dto.customerName !== undefined ? { customerName: dto.customerName } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.quote !== undefined ? { quote: dto.quote } : {}),
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.productId !== undefined ? { productId: dto.productId } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: testimonialInclude,
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "testimonial.update",
      entityType: "Testimonial",
      entityId: testimonial.id,
      summary: `Updated testimonial from "${testimonial.customerName}"`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return testimonial;
  }

  async remove(id: string, context: AuditContext) {
    const testimonial = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!testimonial) throw new NotFoundException("Testimonial not found");

    await this.prisma.testimonial.delete({ where: { id } });

    await this.audit.log({
      adminId: context.adminId,
      action: "testimonial.delete",
      entityType: "Testimonial",
      entityId: id,
      summary: `Deleted testimonial from "${testimonial.customerName}"`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }
}
