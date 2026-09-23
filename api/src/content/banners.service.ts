import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";
import { BannerQueryDto, CreateBannerDto, PublicBannerQueryDto, UpdateBannerDto } from "./dto/content.dto";

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ queries

  async listPublic(query: PublicBannerQueryDto) {
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        ...(query.placement ? { placement: query.placement } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async listAdmin(query: BannerQueryDto) {
    const where: Prisma.BannerWhereInput = {};

    if (query.placement) where.placement = query.placement;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { subtitle: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, banners] = await this.prisma.$transaction([
      this.prisma.banner.count({ where }),
      this.prisma.banner.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        ...skipTake(query.page, query.pageSize),
      }),
    ]);

    return paginated(banners, total, query.page, query.pageSize);
  }

  async getAdminById(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException("Banner not found");
    return banner;
  }

  // ------------------------------------------------------------ mutations

  async create(dto: CreateBannerDto, context: AuditContext) {
    const banner = await this.prisma.banner.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        imageUrl: dto.imageUrl ?? null,
        ctaLabel: dto.ctaLabel ?? null,
        ctaHref: dto.ctaHref ?? null,
        placement: dto.placement ?? "HomeHero",
        focalX: dto.focalX ?? null,
        focalY: dto.focalY ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "banner.create",
      entityType: "Banner",
      entityId: banner.id,
      summary: `Created banner "${banner.title}"`,
      metadata: { placement: banner.placement, isActive: banner.isActive },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return banner;
  }

  async update(id: string, dto: UpdateBannerDto, context: AuditContext) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Banner not found");

    const banner = await this.prisma.banner.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.ctaLabel !== undefined ? { ctaLabel: dto.ctaLabel } : {}),
        ...(dto.ctaHref !== undefined ? { ctaHref: dto.ctaHref } : {}),
        ...(dto.placement !== undefined ? { placement: dto.placement } : {}),
        ...(dto.focalX !== undefined ? { focalX: dto.focalX } : {}),
        ...(dto.focalY !== undefined ? { focalY: dto.focalY } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "banner.update",
      entityType: "Banner",
      entityId: banner.id,
      summary: `Updated banner "${banner.title}"`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return banner;
  }

  async remove(id: string, context: AuditContext) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException("Banner not found");

    await this.prisma.banner.delete({ where: { id } });

    await this.audit.log({
      adminId: context.adminId,
      action: "banner.delete",
      entityType: "Banner",
      entityId: id,
      summary: `Deleted banner "${banner.title}"`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }
}
