import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";

export const SETTINGS_DEFAULTS: Record<string, unknown> = {
  "store.name": "RENDI VIRGO",
  "store.tagline": "",
  "store.email": "cs@rendivirgo.com",
  "store.whatsapp": "",
  "store.currency": "USD",
  "store.languages": ["en", "id"],
  "store.address": "",
  "store.socials": { instagram: "", facebook: "", youtube: "", tiktok: "" },
  "seo.defaultTitle": "RENDI VIRGO",
  "seo.defaultDescription": "",
  "notifications.orderEmails": true,
  "notifications.messageEmails": true,
  "notifications.lowStockAlerts": true,
  "notifications.lowStockThreshold": 3,
  "payments.paypalEnabled": true,
  "payments.bankTransferEnabled": false,
  "payments.manualEnabled": false,
  "payments.bankInstructions": "",
};

export const SHIPPING_SETTINGS_DEFAULTS = {
  overrideEnabled: false,
  overrideAmount: 48,
  freeShippingThreshold: 0,
};

export const SETTINGS_GROUPS = {
  general: ["store.", "general."],
  seo: ["seo."],
  notifications: ["notifications."],
  payments: ["payments."],
} as const;

export type SettingsGroup = keyof typeof SETTINGS_GROUPS;
export type GroupedSettings = Record<SettingsGroup, Record<string, unknown>>;

export type ShippingSettings = {
  overrideEnabled: boolean;
  overrideAmount: number;
  freeShippingThreshold: number;
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ queries

  private async readStored(): Promise<Map<string, unknown>> {
    const rows = await this.prisma.siteSetting.findMany();
    return new Map(rows.map((row) => [row.key, row.value]));
  }

  private isKnownGroupKey(key: string): boolean {
    return Object.values(SETTINGS_GROUPS).some((prefixes) =>
      prefixes.some((prefix) => key.startsWith(prefix)),
    );
  }

  async getPublicSettings(): Promise<Record<string, unknown>> {
    const stored = await this.readStored();
    const result: Record<string, unknown> = {};

    for (const [key, fallback] of Object.entries(SETTINGS_DEFAULTS)) {
      if (!key.startsWith("store.") && !key.startsWith("seo.")) continue;
      result[key] = stored.has(key) ? stored.get(key) : fallback;
    }

    return result;
  }

  async getAdminSettings(): Promise<GroupedSettings> {
    const stored = await this.readStored();
    const merged: Record<string, unknown> = {};

    for (const [key, fallback] of Object.entries(SETTINGS_DEFAULTS)) {
      merged[key] = stored.has(key) ? stored.get(key) : fallback;
    }
    for (const [key, value] of stored) {
      if (!(key in merged) && this.isKnownGroupKey(key)) merged[key] = value;
    }

    const groups: GroupedSettings = { general: {}, seo: {}, notifications: {}, payments: {} };
    for (const [key, value] of Object.entries(merged)) {
      const group = (Object.keys(groups) as SettingsGroup[]).find((candidate) =>
        SETTINGS_GROUPS[candidate].some((prefix) => key.startsWith(prefix)),
      );
      if (group) groups[group][key] = value;
    }

    return groups;
  }

  async getShippingSettings(): Promise<ShippingSettings> {
    const stored = await this.readStored();

    const boolean = (key: string, fallback: boolean): boolean => {
      const value = stored.get(key);
      return typeof value === "boolean" ? value : fallback;
    };
    const number = (key: string, fallback: number): number => {
      const value = stored.get(key);
      return typeof value === "number" && Number.isFinite(value) ? value : fallback;
    };

    return {
      overrideEnabled: boolean("shipping.overrideEnabled", SHIPPING_SETTINGS_DEFAULTS.overrideEnabled),
      overrideAmount: number("shipping.overrideAmount", SHIPPING_SETTINGS_DEFAULTS.overrideAmount),
      freeShippingThreshold: number(
        "shipping.freeShippingThreshold",
        SHIPPING_SETTINGS_DEFAULTS.freeShippingThreshold,
      ),
    };
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
  }

  async updateSettings(payload: Record<string, unknown>, context: AuditContext): Promise<GroupedSettings> {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException("Body must be an object of { key: value } pairs");
    }

    const entries = Object.entries(payload);
    if (!entries.length) throw new BadRequestException("No settings provided");

    for (const [key, value] of entries) {
      if (!key.includes(".")) {
        throw new BadRequestException(`Setting key "${key}" must use dotted notation (e.g. "store.name")`);
      }
      if (!this.isKnownGroupKey(key)) {
        throw new BadRequestException(`Unknown settings group for key "${key}"`);
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
      action: "settings.update",
      entityType: "SiteSetting",
      summary: `Updated ${entries.length} setting(s)`,
      metadata: { keys: entries.map(([key]) => key) },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.getAdminSettings();
  }
}
