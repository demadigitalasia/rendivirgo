import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ShippingClass } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateShippingProfileDto,
  CreateShippingRateDto,
  ShippingQuoteDto,
  ShippingRateQueryDto,
  UpdateShippingProfileDto,
  UpdateShippingRateDto,
} from "./dto/settings.dto";
import { SettingsService } from "./settings.service";

export type ShippingQuoteBreakdown = {
  base: number;
  handling: number;
  fragile: number;
  oversized: number;
  total: number;
};

export type ShippingQuoteOption = {
  id: string;
  name: string;
  carrier: string | null;
  price: number;
  breakdown: ShippingQuoteBreakdown;
};

export type ShippingQuoteSource = "CarrierAPI" | "AdminOverride" | "FreeShipping";

export type ShippingQuote = {
  options: ShippingQuoteOption[];
  source: ShippingQuoteSource;
  overrideApplied: boolean;
};

const round = (value: number): number => Math.round(value * 100) / 100;

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ quote

  async quote(dto: ShippingQuoteDto): Promise<ShippingQuote> {
    const settings = await this.settings.getShippingSettings();

    if (settings.overrideEnabled) {
      const price = round(settings.overrideAmount);
      return {
        options: [
          {
            id: "admin-override",
            name: "Admin override",
            carrier: null,
            price,
            breakdown: { base: price, handling: 0, fragile: 0, oversized: 0, total: price },
          },
        ],
        source: "AdminOverride",
        overrideApplied: true,
      };
    }

    const subtotal = dto.subtotal ?? 0;
    if (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold) {
      return {
        options: [
          {
            id: "free-shipping",
            name: "Free shipping",
            carrier: null,
            price: 0,
            breakdown: { base: 0, handling: 0, fragile: 0, oversized: 0, total: 0 },
          },
        ],
        source: "FreeShipping",
        overrideApplied: false,
      };
    }

    const destination = dto.countryCode?.trim() ?? "";
    const regionFilter: Prisma.ShippingRateWhereInput = destination
      ? {
          OR: [
            { region: { equals: "Worldwide", mode: "insensitive" } },
            { region: { equals: destination, mode: "insensitive" } },
          ],
        }
      : { region: { equals: "Worldwide", mode: "insensitive" } };

    const rates = await this.prisma.shippingRate.findMany({
      where: {
        isActive: true,
        minWeightGram: { lte: dto.weightGram },
        AND: [{ OR: [{ maxWeightGram: null }, { maxWeightGram: { gte: dto.weightGram } }] }, regionFilter],
      },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    });

    const sorted = destination
      ? [...rates].sort((a, b) => {
          const aSpecific = a.region.toLowerCase() === destination.toLowerCase() ? 0 : 1;
          const bSpecific = b.region.toLowerCase() === destination.toLowerCase() ? 0 : 1;
          return aSpecific - bSpecific;
        })
      : rates;

    return {
      options: sorted.map((rate) => this.toOption(rate, dto.shippingClass ?? "Standard")),
      source: "CarrierAPI",
      overrideApplied: false,
    };
  }

  private toOption(rate: { id: string; name: string; carrier: string | null; price: Prisma.Decimal; handlingFee: Prisma.Decimal; fragileFee: Prisma.Decimal; oversizedFee: Prisma.Decimal }, shippingClass: ShippingClass): ShippingQuoteOption {
    const base = round(Number(rate.price));
    const handling = round(Number(rate.handlingFee));
    const fragile = shippingClass === "Fragile" ? round(Number(rate.fragileFee)) : 0;
    const oversized = shippingClass === "Oversized" ? round(Number(rate.oversizedFee)) : 0;
    const total = round(base + handling + fragile + oversized);

    return {
      id: rate.id,
      name: rate.name,
      carrier: rate.carrier,
      price: total,
      breakdown: { base, handling, fragile, oversized, total },
    };
  }

  // ------------------------------------------------------------ rates (admin)

  private toApiRate(rate: {
    id: string;
    name: string;
    carrier: string | null;
    region: string;
    minWeightGram: number;
    maxWeightGram: number | null;
    price: Prisma.Decimal;
    handlingFee: Prisma.Decimal;
    insuranceFee: Prisma.Decimal;
    fragileFee: Prisma.Decimal;
    oversizedFee: Prisma.Decimal;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: rate.id,
      name: rate.name,
      carrier: rate.carrier,
      region: rate.region,
      minWeightGram: rate.minWeightGram,
      maxWeightGram: rate.maxWeightGram,
      price: Number(rate.price),
      handlingFee: Number(rate.handlingFee),
      insuranceFee: Number(rate.insuranceFee),
      fragileFee: Number(rate.fragileFee),
      oversizedFee: Number(rate.oversizedFee),
      isActive: rate.isActive,
      sortOrder: rate.sortOrder,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    };
  }

  async listRates(query: ShippingRateQueryDto) {
    const where: Prisma.ShippingRateWhereInput = {};

    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.region) where.region = { equals: query.region, mode: "insensitive" };

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { carrier: { contains: search, mode: "insensitive" } },
        { region: { contains: search, mode: "insensitive" } },
      ];
    }

    const rates = await this.prisma.shippingRate.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    });

    return rates.map((rate) => this.toApiRate(rate));
  }

  private assertWeightRange(minWeightGram: number, maxWeightGram: number | null | undefined) {
    if (maxWeightGram !== null && maxWeightGram !== undefined && maxWeightGram < minWeightGram) {
      throw new BadRequestException("maxWeightGram must be greater than or equal to minWeightGram");
    }
  }

  async createRate(dto: CreateShippingRateDto, context: AuditContext) {
    const minWeightGram = dto.minWeightGram ?? 0;
    this.assertWeightRange(minWeightGram, dto.maxWeightGram);

    const rate = await this.prisma.shippingRate.create({
      data: {
        name: dto.name,
        carrier: dto.carrier ?? null,
        region: dto.region ?? "Worldwide",
        minWeightGram,
        maxWeightGram: dto.maxWeightGram ?? null,
        price: new Prisma.Decimal(dto.price),
        handlingFee: new Prisma.Decimal(dto.handlingFee ?? 0),
        insuranceFee: new Prisma.Decimal(dto.insuranceFee ?? 0),
        fragileFee: new Prisma.Decimal(dto.fragileFee ?? 0),
        oversizedFee: new Prisma.Decimal(dto.oversizedFee ?? 0),
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_rate.create",
      entityType: "ShippingRate",
      entityId: rate.id,
      summary: `Created shipping rate "${rate.name}"`,
      metadata: { region: rate.region, price: Number(rate.price) },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiRate(rate);
  }

  async updateRate(id: string, dto: UpdateShippingRateDto, context: AuditContext) {
    const existing = await this.prisma.shippingRate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Shipping rate not found");

    const minWeightGram = dto.minWeightGram ?? existing.minWeightGram;
    const maxWeightGram = dto.maxWeightGram !== undefined ? dto.maxWeightGram : existing.maxWeightGram;
    this.assertWeightRange(minWeightGram, maxWeightGram);

    const rate = await this.prisma.shippingRate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.carrier !== undefined ? { carrier: dto.carrier } : {}),
        ...(dto.region !== undefined ? { region: dto.region } : {}),
        ...(dto.minWeightGram !== undefined ? { minWeightGram: dto.minWeightGram } : {}),
        ...(dto.maxWeightGram !== undefined ? { maxWeightGram: dto.maxWeightGram } : {}),
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
        ...(dto.handlingFee !== undefined ? { handlingFee: new Prisma.Decimal(dto.handlingFee) } : {}),
        ...(dto.insuranceFee !== undefined ? { insuranceFee: new Prisma.Decimal(dto.insuranceFee) } : {}),
        ...(dto.fragileFee !== undefined ? { fragileFee: new Prisma.Decimal(dto.fragileFee) } : {}),
        ...(dto.oversizedFee !== undefined ? { oversizedFee: new Prisma.Decimal(dto.oversizedFee) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_rate.update",
      entityType: "ShippingRate",
      entityId: rate.id,
      summary: `Updated shipping rate "${rate.name}"`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiRate(rate);
  }

  async toggleRate(id: string, context: AuditContext) {
    const existing = await this.prisma.shippingRate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Shipping rate not found");

    const rate = await this.prisma.shippingRate.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_rate.toggle",
      entityType: "ShippingRate",
      entityId: rate.id,
      summary: `Shipping rate "${rate.name}" ${rate.isActive ? "activated" : "deactivated"}`,
      metadata: { isActive: rate.isActive },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiRate(rate);
  }

  async removeRate(id: string, context: AuditContext) {
    const rate = await this.prisma.shippingRate.findUnique({ where: { id } });
    if (!rate) throw new NotFoundException("Shipping rate not found");

    await this.prisma.shippingRate.delete({ where: { id } });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_rate.delete",
      entityType: "ShippingRate",
      entityId: id,
      summary: `Deleted shipping rate "${rate.name}"`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }

  // ------------------------------------------------------------ profiles (admin)

  private toApiProfile(profile: {
    id: string;
    name: string;
    packageWeightGram: number;
    packageLengthMm: number | null;
    packageWidthMm: number | null;
    packageHeightMm: number | null;
    shippingClass: ShippingClass;
    calculationMethod: string;
    packageModel: string;
    handlingFee: Prisma.Decimal;
    insuranceFee: Prisma.Decimal;
    fragileFee: Prisma.Decimal;
    oversizedFee: Prisma.Decimal;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: profile.id,
      name: profile.name,
      packageWeightGram: profile.packageWeightGram,
      packageLengthMm: profile.packageLengthMm,
      packageWidthMm: profile.packageWidthMm,
      packageHeightMm: profile.packageHeightMm,
      shippingClass: profile.shippingClass,
      calculationMethod: profile.calculationMethod,
      packageModel: profile.packageModel,
      handlingFee: Number(profile.handlingFee),
      insuranceFee: Number(profile.insuranceFee),
      fragileFee: Number(profile.fragileFee),
      oversizedFee: Number(profile.oversizedFee),
      isDefault: profile.isDefault,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  async listProfiles() {
    const profiles = await this.prisma.shippingProfile.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return profiles.map((profile) => this.toApiProfile(profile));
  }

  async createProfile(dto: CreateShippingProfileDto, context: AuditContext) {
    const profile = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.shippingProfile.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.shippingProfile.create({
        data: {
          name: dto.name,
          packageWeightGram: dto.packageWeightGram,
          packageLengthMm: dto.packageLengthMm ?? null,
          packageWidthMm: dto.packageWidthMm ?? null,
          packageHeightMm: dto.packageHeightMm ?? null,
          shippingClass: dto.shippingClass ?? "Standard",
          calculationMethod: dto.calculationMethod ?? "CarrierAPI",
          packageModel: dto.packageModel ?? "SinglePackageTotalWeight",
          handlingFee: new Prisma.Decimal(dto.handlingFee ?? 0),
          insuranceFee: new Prisma.Decimal(dto.insuranceFee ?? 0),
          fragileFee: new Prisma.Decimal(dto.fragileFee ?? 0),
          oversizedFee: new Prisma.Decimal(dto.oversizedFee ?? 0),
          isDefault: dto.isDefault ?? false,
        },
      });
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_profile.create",
      entityType: "ShippingProfile",
      entityId: profile.id,
      summary: `Created shipping profile "${profile.name}"`,
      metadata: { isDefault: profile.isDefault, shippingClass: profile.shippingClass },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiProfile(profile);
  }

  async updateProfile(id: string, dto: UpdateShippingProfileDto, context: AuditContext) {
    const existing = await this.prisma.shippingProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Shipping profile not found");

    const profile = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.shippingProfile.updateMany({
          where: { id: { not: id }, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.shippingProfile.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.packageWeightGram !== undefined ? { packageWeightGram: dto.packageWeightGram } : {}),
          ...(dto.packageLengthMm !== undefined ? { packageLengthMm: dto.packageLengthMm } : {}),
          ...(dto.packageWidthMm !== undefined ? { packageWidthMm: dto.packageWidthMm } : {}),
          ...(dto.packageHeightMm !== undefined ? { packageHeightMm: dto.packageHeightMm } : {}),
          ...(dto.shippingClass !== undefined ? { shippingClass: dto.shippingClass } : {}),
          ...(dto.calculationMethod !== undefined ? { calculationMethod: dto.calculationMethod } : {}),
          ...(dto.packageModel !== undefined ? { packageModel: dto.packageModel } : {}),
          ...(dto.handlingFee !== undefined ? { handlingFee: new Prisma.Decimal(dto.handlingFee) } : {}),
          ...(dto.insuranceFee !== undefined ? { insuranceFee: new Prisma.Decimal(dto.insuranceFee) } : {}),
          ...(dto.fragileFee !== undefined ? { fragileFee: new Prisma.Decimal(dto.fragileFee) } : {}),
          ...(dto.oversizedFee !== undefined ? { oversizedFee: new Prisma.Decimal(dto.oversizedFee) } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        },
      });
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_profile.update",
      entityType: "ShippingProfile",
      entityId: profile.id,
      summary: `Updated shipping profile "${profile.name}"`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiProfile(profile);
  }

  async removeProfile(id: string, context: AuditContext) {
    const profile = await this.prisma.shippingProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException("Shipping profile not found");

    await this.prisma.shippingProfile.delete({ where: { id } });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_profile.delete",
      entityType: "ShippingProfile",
      entityId: id,
      summary: `Deleted shipping profile "${profile.name}"`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }
}
