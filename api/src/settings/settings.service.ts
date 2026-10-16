import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";

export const SETTINGS_DEFAULTS: Record<string, unknown> = {
  "store.name": "RENDI VIRGO",
  "store.tagline": "",
  "store.email": "cs@rendivirgo.com",
  "store.whatsapp": "",
  "store.whatsappSecondary": "",
  "store.currency": "USD",
  "store.languages": ["en", "id"],
  "store.address": "",
  "store.socials": { instagram: "", facebook: "", youtube: "", tiktok: "" },
  "store.productWatermarkEnabled": true,
  "store.productWatermarkLogo": "/brand/rendi-virgo-logo-white.webp",
  "store.productWatermarkOpacity": 0.35,
  "store.productWatermarkSize": 18,
  "store.productWatermarkX": 69,
  "store.productWatermarkY": 86,
  "seo.defaultTitle": "RENDI VIRGO",
  "seo.defaultDescription": "",
  "notifications.orderConfirmation": true,
  "notifications.newMessage": true,
  "notifications.lowStock": true,
  "notifications.lowStockThreshold": 3,
  "payments.paypalEnabled": true,
  "payments.paypalEmail": "",
  "payments.bankTransferEnabled": true,
  "payments.bankName": "PT BANK CENTRAL ASIA",
  "payments.bankAccountName": "RENDI VIRGO",
  "payments.bankAccountNumber": "3770362741",
  "payments.bankSwiftCode": "CENAIDJA",
  "payments.currency": "USD",
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

function legacyWatermarkCoordinates(position: unknown, size: number): { x: number; y: number } {
  const safeSize = Number.isFinite(size) ? Math.min(50, Math.max(8, size)) : 26;
  const markHeight = safeSize / 3;
  if (position === "center") return { x: (100 - safeSize) / 2, y: (100 - markHeight) / 2 };
  if (position === "bottom-left") return { x: 5, y: 100 - markHeight - 5 };
  return { x: 100 - safeSize - 5, y: 100 - markHeight - 5 };
}

export type ShippingSettings = {
  overrideEnabled: boolean;
  overrideAmount: number;
  freeShippingThreshold: number;
};

export type NotificationSettings = {
  orderConfirmation: boolean;
  newMessage: boolean;
  lowStock: boolean;
  lowStockThreshold: number;
};

export type PaymentSettings = {
  paypalEnabled: boolean;
  bankTransferEnabled: boolean;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankSwiftCode: string;
  currency: string;
};

export type OpenRouterSettingsStatus = {
  configured: boolean;
  source: "dashboard" | "environment" | "missing";
  model: string;
};

export type OpenRouterModelOption = {
  id: string;
  name: string;
  contextLength: number | null;
};

type EncryptedSecret = {
  version: 1;
  iv: string;
  authTag: string;
  ciphertext: string;
};

const OPENROUTER_KEY_SETTING = "ai.openrouter.apiKey";
const OPENROUTER_MODEL_SETTING = "ai.openrouter.model";
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4.1-mini";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
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

    if (!stored.has("store.productWatermarkX") || !stored.has("store.productWatermarkY")) {
      const size = Number(stored.get("store.productWatermarkSize") ?? SETTINGS_DEFAULTS["store.productWatermarkSize"]);
      const legacy = legacyWatermarkCoordinates(stored.get("store.productWatermarkPosition"), size);
      if (!stored.has("store.productWatermarkX")) result["store.productWatermarkX"] = legacy.x;
      if (!stored.has("store.productWatermarkY")) result["store.productWatermarkY"] = legacy.y;
    }

    const payments = await this.getPaymentSettings();
    result["payments.paypalEnabled"] = payments.paypalEnabled;

    return result;
  }

  async getNotificationSettings(): Promise<NotificationSettings> {
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
      orderConfirmation: boolean("notifications.orderConfirmation", true),
      newMessage: boolean("notifications.newMessage", true),
      lowStock: boolean("notifications.lowStock", true),
      lowStockThreshold: number("notifications.lowStockThreshold", 3),
    };
  }

  async getPaymentSettings(): Promise<PaymentSettings> {
    const stored = await this.readStored();
    const boolean = (key: string, fallback: boolean): boolean => {
      const value = stored.get(key);
      return typeof value === "boolean" ? value : fallback;
    };
    const text = (key: string, fallback: string): string => {
      const value = stored.get(key);
      return typeof value === "string" ? value.trim() : fallback;
    };

    return {
      paypalEnabled: boolean("payments.paypalEnabled", true),
      bankTransferEnabled: boolean("payments.bankTransferEnabled", true),
      bankName: text("payments.bankName", String(SETTINGS_DEFAULTS["payments.bankName"])),
      bankAccountName: text("payments.bankAccountName", String(SETTINGS_DEFAULTS["payments.bankAccountName"])) || "RENDI VIRGO",
      bankAccountNumber: text("payments.bankAccountNumber", String(SETTINGS_DEFAULTS["payments.bankAccountNumber"])),
      bankSwiftCode: text("payments.bankSwiftCode", String(SETTINGS_DEFAULTS["payments.bankSwiftCode"])),
      currency: text("payments.currency", String(SETTINGS_DEFAULTS["payments.currency"])),
    };
  }

  async getStoreEmail(): Promise<string> {
    const stored = await this.readStored();
    const candidates = ["store.adminEmail", "store.email"];
    for (const key of candidates) {
      const value = stored.get(key);
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return String(SETTINGS_DEFAULTS["store.email"]);
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

    if (!stored.has("store.productWatermarkX") || !stored.has("store.productWatermarkY")) {
      const size = Number(stored.get("store.productWatermarkSize") ?? SETTINGS_DEFAULTS["store.productWatermarkSize"]);
      const legacy = legacyWatermarkCoordinates(stored.get("store.productWatermarkPosition"), size);
      if (!stored.has("store.productWatermarkX")) groups.general["store.productWatermarkX"] = legacy.x;
      if (!stored.has("store.productWatermarkY")) groups.general["store.productWatermarkY"] = legacy.y;
    }

    return groups;
  }

  async getOpenRouterSettingsStatus(): Promise<OpenRouterSettingsStatus> {
    const [storedKey, storedModel] = await Promise.all([
      this.prisma.siteSetting.findUnique({ where: { key: OPENROUTER_KEY_SETTING }, select: { key: true } }),
      this.prisma.siteSetting.findUnique({ where: { key: OPENROUTER_MODEL_SETTING }, select: { value: true } }),
    ]);
    const environmentKey = this.config.get<string>("OPENROUTER_API_KEY")?.trim();
    const source = storedKey ? "dashboard" : environmentKey ? "environment" : "missing";
    const storedModelValue = storedModel?.value;
    const model =
      (typeof storedModelValue === "string" && storedModelValue.trim()) ||
      this.config.get<string>("OPENROUTER_MODEL")?.trim() ||
      DEFAULT_OPENROUTER_MODEL;

    return { configured: source !== "missing", source, model };
  }

  async getOpenRouterCredentials(): Promise<{ apiKey: string | null; model: string }> {
    const [storedKey, status] = await Promise.all([
      this.prisma.siteSetting.findUnique({ where: { key: OPENROUTER_KEY_SETTING }, select: { value: true } }),
      this.getOpenRouterSettingsStatus(),
    ]);

    if (storedKey) return { apiKey: this.decryptSecret(storedKey.value), model: status.model };

    return {
      apiKey: this.config.get<string>("OPENROUTER_API_KEY")?.trim() || null,
      model: status.model,
    };
  }

  async listOpenRouterModels(): Promise<{ models: OpenRouterModelOption[] }> {
    const { apiKey } = await this.getOpenRouterCredentials();
    if (!apiKey) {
      throw new ServiceUnavailableException("Add an OpenRouter API key in Admin Settings before loading the model catalog.");
    }

    let response: Response;
    try {
      response = await fetch(
        "https://openrouter.ai/api/v1/models?output_modalities=text&supported_parameters=structured_outputs",
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(20_000),
        },
      );
    } catch {
      throw new ServiceUnavailableException("Could not reach the OpenRouter model catalog. Try again in a moment.");
    }

    if (response.status === 401) {
      throw new ServiceUnavailableException("OpenRouter rejected the saved API key. Check it in Admin Settings.");
    }
    if (response.status === 403) {
      throw new ServiceUnavailableException("OpenRouter denied access to the model catalog. Check the key permissions.");
    }
    if (response.status === 429) {
      throw new ServiceUnavailableException("OpenRouter is limiting model catalog requests. Try again shortly.");
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(`OpenRouter model catalog request failed (HTTP ${response.status}).`);
    }

    let payload: { data?: Array<Record<string, unknown>> };
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      throw new ServiceUnavailableException("OpenRouter returned an invalid model catalog response.");
    }
    if (!Array.isArray(payload.data)) {
      throw new ServiceUnavailableException("OpenRouter returned an invalid model catalog response.");
    }

    const models = payload.data
      .filter((model) => {
        const parameters = model.supported_parameters;
        return Array.isArray(parameters) && parameters.includes("structured_outputs");
      })
      .flatMap((model): OpenRouterModelOption[] => {
        if (typeof model.id !== "string" || !model.id.trim()) return [];
        const id = model.id.trim();
        const name = typeof model.name === "string" && model.name.trim() ? model.name.trim() : id;
        const contextLength = typeof model.context_length === "number" ? model.context_length : null;
        return [{ id, name, contextLength }];
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    return { models };
  }

  async updateOpenRouterSettings(
    payload: { apiKey?: string; model?: string },
    context: AuditContext,
  ): Promise<OpenRouterSettingsStatus> {
    const apiKey = payload.apiKey?.trim();
    const model = payload.model?.trim();
    if (payload.apiKey !== undefined && !apiKey) {
      throw new BadRequestException("API key cannot be empty. Leave it blank to keep the current key.");
    }
    if (!apiKey && !model) throw new BadRequestException("Provide an API key or model to update.");
    if (apiKey && (apiKey.length < 20 || apiKey.length > 500)) {
      throw new BadRequestException("OpenRouter API key must be between 20 and 500 characters.");
    }
    if (model && (model.length > 160 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{1,159}$/.test(model))) {
      throw new BadRequestException("Enter a valid OpenRouter model ID, such as openai/gpt-4.1-mini.");
    }

    const updates = [];
    if (apiKey) {
      updates.push(
        this.prisma.siteSetting.upsert({
          where: { key: OPENROUTER_KEY_SETTING },
          create: { key: OPENROUTER_KEY_SETTING, value: this.encryptSecret(apiKey) },
          update: { value: this.encryptSecret(apiKey) },
        }),
      );
    }
    if (model) {
      updates.push(
        this.prisma.siteSetting.upsert({
          where: { key: OPENROUTER_MODEL_SETTING },
          create: { key: OPENROUTER_MODEL_SETTING, value: model },
          update: { value: model },
        }),
      );
    }

    await this.prisma.$transaction(updates);
    await this.audit.log({
      adminId: context.adminId,
      action: "settings.openrouter.update",
      entityType: "SiteSetting",
      summary: "Updated OpenRouter configuration",
      metadata: { apiKeyUpdated: Boolean(apiKey), modelUpdated: Boolean(model) },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.getOpenRouterSettingsStatus();
  }

  async clearOpenRouterApiKey(context: AuditContext): Promise<OpenRouterSettingsStatus> {
    const removed = await this.prisma.siteSetting.deleteMany({ where: { key: OPENROUTER_KEY_SETTING } });
    if (removed.count) {
      await this.audit.log({
        adminId: context.adminId,
        action: "settings.openrouter.api_key.remove",
        entityType: "SiteSetting",
        summary: "Removed dashboard OpenRouter API key",
        metadata: { key: OPENROUTER_KEY_SETTING },
        ip: context.ip,
        userAgent: context.userAgent,
      });
    }
    return this.getOpenRouterSettingsStatus();
  }

  private encryptionKey(): Buffer {
    const sessionSecret = this.config.get<string>("SESSION_SECRET")?.trim();
    if (!sessionSecret || sessionSecret.length < 32) {
      throw new ServiceUnavailableException(
        "Set SESSION_SECRET to a stable value of at least 32 characters before storing provider API keys.",
      );
    }
    return createHmac("sha256", sessionSecret).update("rendi-virgo:site-setting-encryption:v1").digest();
  }

  private encryptSecret(value: string): Prisma.InputJsonValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const encrypted: EncryptedSecret = {
      version: 1,
      iv: iv.toString("base64url"),
      authTag: cipher.getAuthTag().toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
    };
    return encrypted;
  }

  private decryptSecret(value: unknown): string {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ServiceUnavailableException("The saved OpenRouter API key is invalid. Re-enter it in Admin Settings.");
    }
    const secret = value as Partial<EncryptedSecret>;
    if (secret.version !== 1 || !secret.iv || !secret.authTag || !secret.ciphertext) {
      throw new ServiceUnavailableException("The saved OpenRouter API key is invalid. Re-enter it in Admin Settings.");
    }
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(secret.iv, "base64url"));
      decipher.setAuthTag(Buffer.from(secret.authTag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(secret.ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new ServiceUnavailableException(
        "The saved OpenRouter API key could not be decrypted. Re-enter it in Admin Settings.",
      );
    }
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
