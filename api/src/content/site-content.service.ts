import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";

export const SITE_CONTENT_DEFAULTS: Record<string, unknown> = {
  "home.heroTitle": "",
  "home.heroSubtitle": "",
  "home.heroImage": "",
  "home.ownerName": "RENDI VIRGO",
  "home.ownerRole": "",
  "home.ownerBio": "",
  "home.ownerImage": "",
  "home.ownerCtaLabel": "",
  "home.ownerCtaHref": "",
  "shipping.overrideEnabled": false,
  "shipping.overrideAmount": 48,
  "shipping.freeShippingThreshold": 0,
};

const PUBLIC_PREFIXES = ["home.", "shipping."] as const;

@Injectable()
export class SiteContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ queries

  private async readStored(): Promise<Map<string, unknown>> {
    const rows = await this.prisma.siteSetting.findMany();
    return new Map(rows.map((row) => [row.key, row.value]));
  }

  private merge(stored: Map<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...SITE_CONTENT_DEFAULTS };
    for (const key of Object.keys(SITE_CONTENT_DEFAULTS)) {
      if (stored.has(key)) result[key] = stored.get(key);
    }
    return result;
  }

  async getAdmin(): Promise<Record<string, unknown>> {
    return this.merge(await this.readStored());
  }

  async getPublic(): Promise<Record<string, unknown>> {
    const merged = await this.getAdmin();
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(merged)) {
      if (PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix))) result[key] = value;
    }
    return result;
  }

  // ------------------------------------------------------------ mutations

  private toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === null) return Prisma.JsonNull;
    return value as Prisma.InputJsonValue;
  }

  private assertValue(key: string, value: unknown): void {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new BadRequestException(`Value for "${key}" must be a finite number`);
    }
    if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol" || value === undefined) {
      throw new BadRequestException(`Value for "${key}" must be JSON-serializable`);
    }
    try {
      JSON.stringify(value);
    } catch {
      throw new BadRequestException(`Value for "${key}" must be JSON-serializable`);
    }

    if (key === "shipping.overrideEnabled" && typeof value !== "boolean") {
      throw new BadRequestException(`"${key}" must be a boolean`);
    }
    if ((key === "shipping.overrideAmount" || key === "shipping.freeShippingThreshold") && typeof value !== "number") {
      throw new BadRequestException(`"${key}" must be a number`);
    }
    if (key.startsWith("home.") && value !== null && typeof value !== "string") {
      throw new BadRequestException(`"${key}" must be a string`);
    }
  }

  async update(payload: Record<string, unknown>, context: AuditContext): Promise<Record<string, unknown>> {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException("Body must be an object of { key: value } pairs");
    }

    const entries = Object.entries(payload);
    if (!entries.length) throw new BadRequestException("No site content values provided");

    for (const [key, value] of entries) {
      if (!(key in SITE_CONTENT_DEFAULTS)) {
        throw new BadRequestException(`Unknown site content key "${key}"`);
      }
      this.assertValue(key, value);
    }

    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.siteSetting.upsert({
          where: { key },
          create: { key, value: this.toJson(value) },
          update: { value: this.toJson(value) },
        }),
      ),
    );

    await this.audit.log({
      adminId: context.adminId,
      action: "site_content.update",
      entityType: "SiteSetting",
      summary: `Updated ${entries.length} site content setting(s)`,
      metadata: { keys: entries.map(([key]) => key) },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.getAdmin();
  }
}
