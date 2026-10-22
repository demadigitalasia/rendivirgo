import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import type { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { detectImageType } from "../uploads/image-validation";

const ETSY_API = "https://api.etsy.com/v3";
const CONNECTION_ID = "primary";
const REQUIRED_ETSY_SCOPES = ["listings_r", "listings_w", "shops_r", "shops_w"];
const MAX_ATTEMPTS = 8;
const MAX_LISTING_IMAGES = 20;
const OAUTH_STATE_TTL_MS = 10 * 60_000;

type EtsyConfiguration = {
  keystring: string;
  sharedSecret: string;
  redirectUri: string;
};

type EtsyTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string | string[];
};

type EtsyShopResponse = {
  shop_id?: number | string;
  user_id?: number | string;
  shop_name?: string;
};

type EtsyShopDetailsResponse = EtsyShopResponse & {
  currency_code?: string;
};

type EtsyListingResponse = {
  listing_id?: number | string;
  url?: string;
};

type EtsyListingImageResponse = {
  listing_image_id?: number | string;
};

type EtsyCollection<T> = {
  count?: number;
  results?: T[];
};

type EtsyShippingProfile = {
  shipping_profile_id?: number | string;
  title?: string;
  origin_country_iso?: string;
};

type EtsyReturnPolicy = {
  return_policy_id?: number | string;
  accepts_returns?: boolean;
  accepts_exchanges?: boolean;
  return_deadline?: number | null;
};

type EtsyReadinessProfile = {
  readiness_state_id?: number | string;
  readiness_state?: string;
  min_processing_days?: number;
  max_processing_days?: number;
  processing_days_display_label?: string;
};

type SyncProduct = Prisma.ProductGetPayload<{
  include: { images: true; variants: true };
}>;

class EtsyRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

class EtsySyncError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

@Injectable()
export class EtsyIntegrationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EtsyIntegrationService.name);
  private dispatchTimer?: NodeJS.Timeout;
  private dispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    void this.dispatchSyncQueue();
    this.dispatchTimer = setInterval(() => void this.dispatchSyncQueue(), 15_000);
    this.dispatchTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
  }

  private connectionConfigErrors(): string[] {
    const missing: string[] = [];
    if (!this.config.get<string>("ETSY_API_KEY")?.trim()) missing.push("ETSY_API_KEY");
    if (!this.config.get<string>("ETSY_SHARED_SECRET")?.trim()) missing.push("ETSY_SHARED_SECRET");
    const redirectUri = this.config.get<string>("ETSY_REDIRECT_URI")?.trim();
    if (!redirectUri) {
      missing.push("ETSY_REDIRECT_URI");
    } else {
      try {
        if (new URL(redirectUri).protocol !== "https:") missing.push("ETSY_REDIRECT_URI (must use HTTPS)");
      } catch {
        missing.push("ETSY_REDIRECT_URI (must be an absolute HTTPS URL)");
      }
    }
    return missing;
  }

  private listingConfigErrors(): string[] {
    const required: Array<[string, string | undefined]> = [
      ["ETSY_DEFAULT_TAXONOMY_ID", this.config.get<string>("ETSY_DEFAULT_TAXONOMY_ID")?.trim()],
      ["ETSY_DEFAULT_SHIPPING_PROFILE_ID", this.config.get<string>("ETSY_DEFAULT_SHIPPING_PROFILE_ID")?.trim()],
      ["ETSY_DEFAULT_RETURN_POLICY_ID", this.config.get<string>("ETSY_DEFAULT_RETURN_POLICY_ID")?.trim()],
      ["ETSY_DEFAULT_READINESS_STATE_ID", this.config.get<string>("ETSY_DEFAULT_READINESS_STATE_ID")?.trim()],
      ["ETSY_DEFAULT_WHO_MADE", this.config.get<string>("ETSY_DEFAULT_WHO_MADE")?.trim()],
      ["ETSY_DEFAULT_WHEN_MADE", this.config.get<string>("ETSY_DEFAULT_WHEN_MADE")?.trim()],
      ["ETSY_DEFAULT_IS_SUPPLY", this.config.get<string>("ETSY_DEFAULT_IS_SUPPLY")?.trim()],
    ];
    const errors = required.filter(([, value]) => !value).map(([key]) => key);
    for (const name of ["ETSY_DEFAULT_TAXONOMY_ID", "ETSY_DEFAULT_SHIPPING_PROFILE_ID", "ETSY_DEFAULT_RETURN_POLICY_ID", "ETSY_DEFAULT_READINESS_STATE_ID"]) {
      const value = this.config.get<string>(name)?.trim();
      if (value && (!Number.isSafeInteger(Number(value)) || Number(value) < 1)) errors.push(`${name} (invalid)`);
    }
    const whoMade = this.config.get<string>("ETSY_DEFAULT_WHO_MADE")?.trim();
    if (whoMade && !["i_did", "someone_else", "collective"].includes(whoMade)) errors.push("ETSY_DEFAULT_WHO_MADE (invalid)");
    const whenMade = this.config.get<string>("ETSY_DEFAULT_WHEN_MADE")?.trim();
    if (whenMade && ![
      "made_to_order", "2020_2026", "2010_2019", "2007_2009", "before_2007", "2000_2006",
      "1990s", "1980s", "1970s", "1960s", "1950s", "1940s", "1930s", "1920s", "1910s",
      "1900s", "1800s", "1700s", "before_1700",
    ].includes(whenMade)) errors.push("ETSY_DEFAULT_WHEN_MADE (invalid)");
    const isSupply = this.config.get<string>("ETSY_DEFAULT_IS_SUPPLY")?.trim().toLowerCase();
    if (isSupply && isSupply !== "true" && isSupply !== "false") errors.push("ETSY_DEFAULT_IS_SUPPLY (invalid)");
    return errors;
  }

  private apiCredentialErrors(): string[] {
    const missing: string[] = [];
    if (!this.config.get<string>("ETSY_API_KEY")?.trim()) missing.push("ETSY_API_KEY");
    if (!this.config.get<string>("ETSY_SHARED_SECRET")?.trim()) missing.push("ETSY_SHARED_SECRET");
    return missing;
  }

  private requireConnectionConfig(): EtsyConfiguration {
    const missing = this.connectionConfigErrors();
    if (missing.length) {
      throw new ServiceUnavailableException(`Configure Etsy connection settings on the API server: ${missing.join(", ")}`);
    }
    return {
      keystring: this.config.get<string>("ETSY_API_KEY")!.trim(),
      sharedSecret: this.config.get<string>("ETSY_SHARED_SECRET")!.trim(),
      redirectUri: this.config.get<string>("ETSY_REDIRECT_URI")!.trim(),
    };
  }

  private requireApiCredentials(): Pick<EtsyConfiguration, "keystring" | "sharedSecret"> {
    const missing = this.apiCredentialErrors();
    if (missing.length) {
      throw new ServiceUnavailableException(`Configure Etsy API credentials on the API server: ${missing.join(", ")}`);
    }
    return {
      keystring: this.config.get<string>("ETSY_API_KEY")!.trim(),
      sharedSecret: this.config.get<string>("ETSY_SHARED_SECRET")!.trim(),
    };
  }

  private apiKeyHeader(): string {
    const { keystring, sharedSecret } = this.requireApiCredentials();
    return `${keystring}:${sharedSecret}`;
  }

  private encryptionKey(): Buffer {
    const secret = this.config.get<string>("SESSION_SECRET")?.trim();
    if (!secret || (this.config.get<string>("NODE_ENV") === "production" && secret.length < 32)) {
      throw new ServiceUnavailableException("Etsy token encryption requires a stable SESSION_SECRET of at least 32 characters in production");
    }
    return createHmac("sha256", secret).update("rendi-virgo:etsy-token-encryption:v1").digest();
  }

  private encryptSecret(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
  }

  private decryptSecret(value: string): string {
    try {
      const [version, ivPart, tagPart, ciphertextPart] = value.split(".");
      if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart) throw new Error("Invalid encrypted Etsy token");
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(ivPart, "base64url"));
      decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextPart, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new ServiceUnavailableException("Saved Etsy credentials could not be decrypted. Reconnect the Etsy shop.");
    }
  }

  async getAdminStatus() {
    const [connection, grouped, recentJobs] = await Promise.all([
      this.prisma.etsyShopConnection.findUnique({ where: { id: CONNECTION_ID } }),
      this.prisma.etsySyncJob.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.etsySyncJob.findMany({
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: {
          product: { select: { id: true, name: true, sku: true, etsyListingMapping: true } },
        },
      }),
    ]);

    const counts: Record<string, number> = { Pending: 0, Processing: 0, Synced: 0, Failed: 0 };
    for (const item of grouped) counts[item.status] = item._count._all;

    return {
      configured: this.connectionConfigErrors().length === 0,
      missingConnectionConfig: this.connectionConfigErrors(),
      missingListingConfig: this.listingConfigErrors(),
      connected: Boolean(connection),
      shop: connection
        ? { id: connection.shopId, name: connection.shopName, currencyCode: connection.currencyCode, connectedAt: connection.connectedAt }
        : null,
      sync: counts,
      recentJobs: recentJobs.map((job) => ({
        productId: job.product.id,
        productName: job.product.name,
        sku: job.product.sku,
        status: job.status,
        lastError: job.lastError,
        updatedAt: job.updatedAt,
        listingId: job.product.etsyListingMapping?.remoteState === "creating"
          ? null
          : job.product.etsyListingMapping?.etsyListingId ?? null,
        listingUrl: job.product.etsyListingMapping?.listingUrl ?? null,
      })),
    };
  }

  async getShopProfiles() {
    const { token, shopId } = await this.accessToken();
    const [shipping, returns, readiness] = await Promise.all([
      this.apiRequest<EtsyCollection<EtsyShippingProfile>>(`/shops/${shopId}/shipping-profiles?limit=100`, token),
      this.apiRequest<EtsyCollection<EtsyReturnPolicy>>(`/shops/${shopId}/policies/return`, token),
      this.apiRequest<EtsyCollection<EtsyReadinessProfile>>(`/shops/${shopId}/readiness-state-definitions?limit=100`, token),
    ]);

    return {
      shippingProfiles: (shipping.results ?? []).flatMap((profile) => profile.shipping_profile_id
        ? [{ id: String(profile.shipping_profile_id), title: profile.title?.trim() || "Shipping profile", originCountry: profile.origin_country_iso ?? null }]
        : []),
      returnPolicies: (returns.results ?? []).flatMap((policy) => policy.return_policy_id
        ? [{
          id: String(policy.return_policy_id),
          acceptsReturns: Boolean(policy.accepts_returns),
          acceptsExchanges: Boolean(policy.accepts_exchanges),
          returnDeadline: policy.return_deadline ?? null,
        }]
        : []),
      readinessProfiles: (readiness.results ?? []).flatMap((profile) => profile.readiness_state_id
        ? [{
          id: String(profile.readiness_state_id),
          state: profile.readiness_state ?? "unknown",
          minProcessingDays: profile.min_processing_days ?? null,
          maxProcessingDays: profile.max_processing_days ?? null,
          label: profile.processing_days_display_label ?? null,
        }]
        : []),
    };
  }

  async createReadinessProfile(input: {
    readinessState: "ready_to_ship" | "made_to_order";
    minProcessingTime: number;
    maxProcessingTime: number;
    processingTimeUnit: "days" | "weeks";
  }) {
    if (input.maxProcessingTime < input.minProcessingTime) {
      throw new BadRequestException("Maximum processing time must be at least the minimum processing time");
    }
    const { token, shopId } = await this.accessToken();
    const body = new URLSearchParams({
      readiness_state: input.readinessState,
      min_processing_time: String(input.minProcessingTime),
      max_processing_time: String(input.maxProcessingTime),
      processing_time_unit: input.processingTimeUnit,
    });
    const profile = await this.apiRequest<EtsyReadinessProfile>(`/shops/${shopId}/readiness-state-definitions`, token, {
      method: "POST",
      body: body.toString(),
      contentType: "application/x-www-form-urlencoded",
    });
    if (!profile.readiness_state_id) throw new ServiceUnavailableException("Etsy created a profile without returning its ID");
    return {
      id: String(profile.readiness_state_id),
      state: profile.readiness_state ?? input.readinessState,
      minProcessingDays: profile.min_processing_days ?? null,
      maxProcessingDays: profile.max_processing_days ?? null,
      label: profile.processing_days_display_label ?? null,
    };
  }

  async listDraftSyncCandidates() {
    const products = await this.prisma.product.findMany({
      where: { status: "Draft", variants: { none: {} }, etsyListingMapping: { is: null } },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      take: 100,
      select: {
        id: true,
        name: true,
        sku: true,
        currency: true,
        price: true,
        images: { take: 1, orderBy: { sortOrder: "asc" }, select: { id: true } },
      },
    });
    return products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      currency: product.currency,
      price: Number(product.price),
      hasImage: product.images.length > 0,
    }));
  }

  async queueDraftProductSync(productId: string, context: { adminId?: string | null; ip?: string | null; userAgent?: string | null }) {
    if (!(await this.prisma.etsyShopConnection.findUnique({ where: { id: CONNECTION_ID }, select: { id: true } }))) {
      throw new BadRequestException("Connect an Etsy shop before syncing a product");
    }
    const missing = this.listingConfigErrors();
    if (missing.length) throw new BadRequestException(`Configure Etsy listing defaults before syncing: ${missing.join(", ")}`);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: { select: { id: true } } },
    });
    if (!product) throw new BadRequestException("Product was not found");
    if (product.status !== "Draft") throw new BadRequestException("Initial Etsy sync is limited to local Draft products so it cannot publish a listing");
    if (product.variants.length) throw new BadRequestException("Choose a single-item product without variants for the initial Etsy draft");
    if (await this.prisma.etsyListingMapping.findUnique({ where: { productId }, select: { id: true } })) {
      throw new BadRequestException("This product is already linked to Etsy; edit the product to sync its changes");
    }

    await this.prisma.etsySyncJob.upsert({
      where: { productId },
      create: { productId, status: "Pending", revision: 1, availableAt: new Date() },
      update: {
        status: "Pending",
        revision: { increment: 1 },
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
    await this.audit.log({
      adminId: context.adminId,
      action: "integration.etsy.draft_sync_queued",
      entityType: "Product",
      entityId: productId,
      summary: `Queued Etsy draft sync for ${product.name}`,
      metadata: { sku: product.sku },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    void this.dispatchSyncQueue();
    return { queued: 1 };
  }

  async startOAuth(adminSessionId: string | undefined) {
    if (!adminSessionId) throw new BadRequestException("An active admin session is required to connect Etsy");
    const { keystring, redirectUri } = this.requireConnectionConfig();
    const state = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const now = new Date();

    await this.prisma.etsyOAuthState.deleteMany({ where: { expiresAt: { lte: now } } });
    await this.prisma.etsyOAuthState.create({
      data: {
        stateHash: createHash("sha256").update(state).digest("hex"),
        codeVerifierEncrypted: this.encryptSecret(codeVerifier),
        adminSessionId,
        expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS),
      },
    });

    const authorization = new URL("https://www.etsy.com/oauth/connect");
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("client_id", keystring);
    authorization.searchParams.set("redirect_uri", redirectUri);
    authorization.searchParams.set("scope", REQUIRED_ETSY_SCOPES.join(" "));
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("code_challenge", codeChallenge);
    authorization.searchParams.set("code_challenge_method", "S256");
    return { authorizationUrl: authorization.toString() };
  }

  settingsRedirect(result: "connected" | "error"): string {
    const appOrigin = this.config.get<string>("APP_ORIGIN")?.split(",")[0]?.trim();
    let origin = "http://localhost:3000";
    try {
      if (appOrigin) {
        const parsed = new URL(appOrigin);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") origin = parsed.origin;
      }
    } catch {
      // Fall back to the local admin origin if the API origin is malformed.
    }
    const redirect = new URL("/admin/settings", origin);
    redirect.searchParams.set("tab", "etsy");
    redirect.searchParams.set("etsy", result);
    return redirect.toString();
  }

  async completeOAuth(input: {
    code?: string;
    state?: string;
    error?: string;
    context: { adminId?: string | null; ip?: string | null; userAgent?: string | null };
  }): Promise<void> {
    if (!input.state) throw new BadRequestException("Etsy authorization state is missing");
    const stateHash = createHash("sha256").update(input.state).digest("hex");
    const now = new Date();
    const pending = await this.prisma.etsyOAuthState.findFirst({
      where: { stateHash, expiresAt: { gt: now } },
    });
    if (!pending) throw new BadRequestException("Etsy authorization state is invalid or expired");
    const initiatingSession = await this.prisma.adminSession.findFirst({
      where: { id: pending.adminSessionId, revokedAt: null, expiresAt: { gt: now } },
      select: { adminId: true },
    });
    if (!initiatingSession) throw new BadRequestException("The admin session that started Etsy authorization is no longer active");
    const consumed = await this.prisma.etsyOAuthState.deleteMany({ where: { id: pending.id, stateHash } });
    if (consumed.count !== 1) throw new BadRequestException("Etsy authorization state has already been used");
    const codeVerifier = this.decryptSecret(pending.codeVerifierEncrypted);
    if (input.error) throw new BadRequestException("Etsy authorization was declined");
    if (!input.code) throw new BadRequestException("Etsy did not return an authorization code");

    const { keystring, sharedSecret, redirectUri } = this.requireConnectionConfig();
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: keystring,
      redirect_uri: redirectUri,
      code: input.code,
      code_verifier: codeVerifier,
    });
    const token = await this.requestToken(tokenParams);
    const accessToken = this.requireAccessToken(token);
    const grantedScopes = Array.isArray(token.scope) ? token.scope : (token.scope ?? "").split(/\s+/).filter(Boolean);
    if (!REQUIRED_ETSY_SCOPES.every((scope) => grantedScopes.includes(scope))) {
      throw new BadRequestException("The Etsy authorization did not grant all requested listing and shop scopes. Reconnect and approve them.");
    }

    const userId = accessToken.split(".", 1)[0];
    if (!/^\d+$/.test(userId)) throw new BadRequestException("Etsy returned an invalid user identifier");
    const shop = await this.requestJson<EtsyShopResponse>(`/application/users/${userId}/shops`, {
      headers: { "x-api-key": `${keystring}:${sharedSecret}` },
    });
    if (!shop.shop_id || !shop.shop_name) throw new BadRequestException("No Etsy shop was found for the authorized account");
    const shopDetails = await this.requestJson<EtsyShopDetailsResponse>(`/application/shops/${shop.shop_id}`, {
      headers: { "x-api-key": `${keystring}:${sharedSecret}` },
    });
    const currencyCode = shopDetails.currency_code?.trim().toUpperCase();
    if (!currencyCode || !/^[A-Z]{3}$/.test(currencyCode)) {
      throw new BadRequestException("Etsy did not return a valid shop currency");
    }

    const expiresIn = Number(token.expires_in ?? 3600);
    if (!Number.isFinite(expiresIn) || expiresIn <= 0) throw new BadRequestException("Etsy returned an invalid token lifetime");
    await this.prisma.etsyShopConnection.upsert({
      where: { id: CONNECTION_ID },
      create: {
        id: CONNECTION_ID,
        shopId: String(shop.shop_id),
        userId,
        shopName: shop.shop_name,
        currencyCode,
        accessTokenEncrypted: this.encryptSecret(accessToken),
        refreshTokenEncrypted: this.encryptSecret(this.requireRefreshToken(token)),
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      },
      update: {
        shopId: String(shop.shop_id),
        userId,
        shopName: shop.shop_name,
        currencyCode,
        accessTokenEncrypted: this.encryptSecret(accessToken),
        refreshTokenEncrypted: this.encryptSecret(this.requireRefreshToken(token)),
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        refreshLockedAt: null,
        connectedAt: new Date(),
      },
    });

    await this.audit.log({
      adminId: input.context.adminId ?? initiatingSession.adminId,
      action: "integration.etsy.connected",
      entityType: "EtsyShopConnection",
      entityId: CONNECTION_ID,
      summary: `Connected Etsy shop ${shop.shop_name}`,
      metadata: { shopId: String(shop.shop_id), scopes: grantedScopes },
      ip: input.context.ip,
      userAgent: input.context.userAgent,
    });
  }

  async disconnect(context: { adminId?: string | null; ip?: string | null; userAgent?: string | null }) {
    const connection = await this.prisma.etsyShopConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!connection) return { ok: true, disconnected: false };
    await this.prisma.etsyShopConnection.delete({ where: { id: CONNECTION_ID } });
    await this.prisma.etsyOAuthState.deleteMany({});
    await this.prisma.etsySyncJob.updateMany({
      where: { status: { in: ["Pending", "Processing"] } },
      data: { status: "Failed", lockedAt: null, lastError: "Etsy shop disconnected" },
    });
    await this.audit.log({
      adminId: context.adminId,
      action: "integration.etsy.disconnected",
      entityType: "EtsyShopConnection",
      entityId: CONNECTION_ID,
      summary: `Disconnected Etsy shop ${connection.shopName}`,
      metadata: { shopId: connection.shopId },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return { ok: true, disconnected: true };
  }

  async retryFailed() {
    if (!(await this.prisma.etsyShopConnection.findUnique({ where: { id: CONNECTION_ID }, select: { id: true } }))) {
      throw new BadRequestException("Connect an Etsy shop before retrying listing sync jobs");
    }
    const missing = this.listingConfigErrors();
    if (missing.length) throw new BadRequestException(`Configure Etsy listing defaults before retrying: ${missing.join(", ")}`);

    const result = await this.prisma.etsySyncJob.updateMany({
      where: {
        status: "Failed",
        product: {
          OR: [
            { etsyListingMapping: { isNot: null } },
            { status: "Draft" },
          ],
        },
      },
      data: {
        status: "Pending",
        revision: { increment: 1 },
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
    void this.dispatchSyncQueue();
    return { queued: result.count };
  }

  async enqueueProductSync(productId: string, tx?: Prisma.TransactionClient): Promise<void> {
    if (!(await this.prisma.etsyShopConnection.findUnique({ where: { id: CONNECTION_ID }, select: { id: true } }))) return;
    if (this.listingConfigErrors().length) return;
    const db = tx ?? this.prisma;
    if (!(await db.etsyListingMapping.findUnique({ where: { productId }, select: { id: true } }))) return;
    await db.etsySyncJob.upsert({
      where: { productId },
      create: { productId, status: "Pending", revision: 1, availableAt: new Date() },
      update: {
        status: "Pending",
        revision: { increment: 1 },
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
  }

  async enqueueProductsSync(productIds: string[], tx?: Prisma.TransactionClient): Promise<void> {
    if (!productIds.length) return;
    if (!(await this.prisma.etsyShopConnection.findUnique({ where: { id: CONNECTION_ID }, select: { id: true } }))) return;
    if (this.listingConfigErrors().length) return;
    const db = tx ?? this.prisma;
    const uniqueIds = [...new Set(productIds)];
    const mappedProducts = await db.etsyListingMapping.findMany({
      where: { productId: { in: uniqueIds } },
      select: { productId: true },
    });
    const mappedProductIds = mappedProducts.map((mapping) => mapping.productId);
    if (!mappedProductIds.length) return;
    await db.etsySyncJob.updateMany({
      where: { productId: { in: mappedProductIds } },
      data: {
        status: "Pending",
        revision: { increment: 1 },
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
    await db.etsySyncJob.createMany({
      data: mappedProductIds.map((productId) => ({ productId, status: "Pending" as const, revision: 1 })),
      skipDuplicates: true,
    });
  }

  private async requestToken(params: URLSearchParams): Promise<EtsyTokenResponse> {
    return this.requestJson<EtsyTokenResponse>("/public/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-api-key": this.apiKeyHeader(),
      },
      body: params.toString(),
    });
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${ETSY_API}${path}`, { ...init, cache: "no-store" });
    } catch {
      throw new EtsyRequestError("Could not reach the Etsy API", true);
    }
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    if (!response.ok) {
      const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
      const message = typeof record.error === "string"
        ? record.error
        : typeof record.message === "string"
          ? record.message
          : `Etsy API returned HTTP ${response.status}`;
      throw new EtsyRequestError(message.slice(0, 700), response.status === 429 || response.status >= 500);
    }
    return body as T;
  }

  private async apiRequest<T>(
    path: string,
    accessToken: string | undefined,
    options: { method?: string; body?: string | FormData; contentType?: string } = {},
  ): Promise<T> {
    const headers = new Headers({ "x-api-key": this.apiKeyHeader() });
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    if (options.contentType) headers.set("Content-Type", options.contentType);
    return this.requestJson<T>(`/application${path}`, {
      method: options.method ?? "GET",
      headers,
      ...(options.body ? { body: options.body } : {}),
    });
  }

  private requireAccessToken(token: EtsyTokenResponse): string {
    if (!token.access_token || token.token_type?.toLowerCase() !== "bearer") {
      throw new BadRequestException("Etsy returned an invalid access token");
    }
    return token.access_token;
  }

  private requireRefreshToken(token: EtsyTokenResponse): string {
    if (!token.refresh_token) throw new BadRequestException("Etsy did not return a refresh token");
    return token.refresh_token;
  }

  private async accessToken(): Promise<{ token: string; shopId: string; currencyCode: string }> {
    const connection = await this.prisma.etsyShopConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!connection) throw new EtsySyncError("Connect an Etsy shop in Settings before syncing listings");
    if (connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
      return { token: this.decryptSecret(connection.accessTokenEncrypted), shopId: connection.shopId, currencyCode: connection.currencyCode };
    }

    const lockAt = new Date();
    const staleLock = new Date(Date.now() - 2 * 60_000);
    const claim = await this.prisma.etsyShopConnection.updateMany({
      where: {
        id: CONNECTION_ID,
        OR: [{ refreshLockedAt: null }, { refreshLockedAt: { lt: staleLock } }],
      },
      data: { refreshLockedAt: lockAt },
    });
    if (!claim.count) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 400));
        const refreshed = await this.prisma.etsyShopConnection.findUnique({ where: { id: CONNECTION_ID } });
        if (!refreshed) throw new EtsySyncError("The Etsy shop was disconnected during token refresh");
        if (refreshed.tokenExpiresAt.getTime() > Date.now() + 60_000) {
          return { token: this.decryptSecret(refreshed.accessTokenEncrypted), shopId: refreshed.shopId, currencyCode: refreshed.currencyCode };
        }
      }
      throw new EtsyRequestError("Etsy access token refresh is already in progress", true);
    }

    try {
      const current = await this.prisma.etsyShopConnection.findUniqueOrThrow({ where: { id: CONNECTION_ID } });
      const { keystring } = this.requireApiCredentials();
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: keystring,
        refresh_token: this.decryptSecret(current.refreshTokenEncrypted),
      });
      const token = await this.requestToken(params);
      const access = this.requireAccessToken(token);
      const expiresIn = Number(token.expires_in ?? 3600);
      const updated = await this.prisma.etsyShopConnection.update({
        where: { id: CONNECTION_ID },
        data: {
          accessTokenEncrypted: this.encryptSecret(access),
          ...(token.refresh_token ? { refreshTokenEncrypted: this.encryptSecret(token.refresh_token) } : {}),
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
          refreshLockedAt: null,
        },
      });
      return { token: access, shopId: updated.shopId, currencyCode: updated.currencyCode };
    } catch (error) {
      await this.prisma.etsyShopConnection.updateMany({
        where: { id: CONNECTION_ID, refreshLockedAt: lockAt },
        data: { refreshLockedAt: null },
      });
      throw error;
    }
  }

  private parsePositiveSetting(name: string): number {
    const value = this.config.get<string>(name)?.trim();
    const numeric = Number(value);
    if (!value || !Number.isSafeInteger(numeric) || numeric < 1) {
      throw new EtsySyncError(`Configure ${name} on the API server with a valid positive Etsy ID`);
    }
    return numeric;
  }

  private listingDefaults() {
    const whoMade = this.config.get<string>("ETSY_DEFAULT_WHO_MADE")?.trim();
    const whenMade = this.config.get<string>("ETSY_DEFAULT_WHEN_MADE")?.trim();
    const isSupplyRaw = this.config.get<string>("ETSY_DEFAULT_IS_SUPPLY")?.trim().toLowerCase();
    const whoMadeValues = ["i_did", "someone_else", "collective"];
    const whenMadeValues = [
      "made_to_order", "2020_2026", "2010_2019", "2007_2009", "before_2007", "2000_2006",
      "1990s", "1980s", "1970s", "1960s", "1950s", "1940s", "1930s", "1920s", "1910s",
      "1900s", "1800s", "1700s", "before_1700",
    ];
    if (!whoMade || !whoMadeValues.includes(whoMade)) {
      throw new EtsySyncError("ETSY_DEFAULT_WHO_MADE must be i_did, someone_else, or collective");
    }
    if (!whenMade || !whenMadeValues.includes(whenMade)) {
      throw new EtsySyncError("ETSY_DEFAULT_WHEN_MADE must match an Etsy when_made value");
    }
    if (isSupplyRaw !== "true" && isSupplyRaw !== "false") {
      throw new EtsySyncError("ETSY_DEFAULT_IS_SUPPLY must be true or false");
    }
    return {
      taxonomyId: this.parsePositiveSetting("ETSY_DEFAULT_TAXONOMY_ID"),
      shippingProfileId: this.parsePositiveSetting("ETSY_DEFAULT_SHIPPING_PROFILE_ID"),
      returnPolicyId: this.parsePositiveSetting("ETSY_DEFAULT_RETURN_POLICY_ID"),
      readinessStateId: this.parsePositiveSetting("ETSY_DEFAULT_READINESS_STATE_ID"),
      whoMade,
      whenMade,
      isSupply: isSupplyRaw === "true",
    };
  }

  private validateProductForEtsy(product: SyncProduct): void {
    if (product.variants.length) {
      throw new EtsySyncError("This product has variants. Etsy variant mapping is not configured yet; use a single-offering product for now.");
    }
    if (Number(product.price) <= 0) throw new EtsySyncError("Etsy requires a product price greater than zero");
    if (product.name.length > 140) throw new EtsySyncError("Etsy listing titles may be at most 140 characters");
    if (/[^\p{L}\p{Nd}\p{P}\p{Sm}\p{Zs}™©®]/u.test(product.name)) {
      throw new EtsySyncError("Etsy listing titles cannot contain emoji or unsupported symbols");
    }
    for (const symbol of ["%", ":", "&", "+"]) {
      if ([...product.name].filter((character) => character === symbol).length > 1) {
        throw new EtsySyncError(`Etsy listing titles may use ${symbol} only once`);
      }
    }
  }

  private currentQuantity(product: SyncProduct): number {
    if (product.stockModel === "Unique") return product.status === "Published" ? 1 : 0;
    return Math.max(0, product.stockQuantity ?? 0);
  }

  private async localImageFile(url: string): Promise<{ buffer: Buffer; mime: string; filename: string }> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new EtsySyncError("Etsy photo sync supports images uploaded to this store only");
    }
    const publicApi = this.config.get<string>("PUBLIC_API_URL")?.trim() ?? "http://localhost:4000";
    let expectedOrigin = "";
    try {
      expectedOrigin = new URL(publicApi).origin;
    } catch {
      throw new EtsySyncError("PUBLIC_API_URL must be a valid URL to sync Etsy listing photos");
    }
    if (parsed.origin !== expectedOrigin || !parsed.pathname.startsWith("/uploads/")) {
      throw new EtsySyncError("Etsy photo sync supports images uploaded to this store only");
    }
    let relativePath: string;
    try {
      relativePath = decodeURIComponent(parsed.pathname.slice("/uploads/".length));
    } catch {
      throw new EtsySyncError("The product photo URL is invalid");
    }
    const uploadDir = resolve(process.cwd(), this.config.get<string>("UPLOAD_DIR") ?? "uploads");
    const imagePath = resolve(uploadDir, relativePath);
    if (imagePath === uploadDir || !imagePath.startsWith(uploadDir + sep)) {
      throw new EtsySyncError("The product photo path is invalid");
    }
    let buffer: Buffer;
    try {
      buffer = await readFile(imagePath);
    } catch {
      throw new EtsySyncError("A product photo is missing from the API upload storage; upload it again and retry Etsy sync");
    }
    if (buffer.length > 8 * 1024 * 1024) throw new EtsySyncError("Etsy listing photos must be 8 MB or smaller");
    const detected = detectImageType(buffer);
    if (!detected) throw new EtsySyncError("A product photo is not a supported raster image");
    return { buffer, mime: detected.mime, filename: basename(imagePath) };
  }

  private async uploadImage(shopId: string, listingId: string, token: string, url: string, rank: number): Promise<string> {
    const image = await this.localImageFile(url);
    const form = new FormData();
    const arrayBuffer = image.buffer.buffer.slice(
      image.buffer.byteOffset,
      image.buffer.byteOffset + image.buffer.byteLength,
    ) as ArrayBuffer;
    form.append("image", new Blob([arrayBuffer], { type: image.mime }), image.filename);
    form.append("rank", String(rank));
    const response = await this.apiRequest<EtsyListingImageResponse>(
      `/shops/${shopId}/listings/${listingId}/images`,
      token,
      { method: "POST", body: form },
    );
    if (!response.listing_image_id) throw new EtsyRequestError("Etsy did not return an uploaded image ID", true);
    return String(response.listing_image_id);
  }

  private async updateRemoteState(
    shopId: string,
    listingId: string,
    token: string,
    state: "active" | "inactive",
  ): Promise<void> {
    const form = new URLSearchParams({ state });
    await this.apiRequest(`/shops/${shopId}/listings/${listingId}`, token, {
      method: "PATCH",
      body: form.toString(),
      contentType: "application/x-www-form-urlencoded",
    });
    await this.prisma.etsyListingMapping.updateMany({ where: { etsyListingId: listingId }, data: { remoteState: state } });
  }

  private async synchronizeProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: { orderBy: { sortOrder: "asc" } }, variants: { orderBy: { sortOrder: "asc" } } },
    });
    if (!product) return;
    let mapping = await this.prisma.etsyListingMapping.findUnique({ where: { productId } });
    if (!mapping && ["Reserved", "Sold", "Archived"].includes(product.status)) return;
    if (!mapping && product.status !== "Draft") {
      throw new EtsySyncError("Create the initial Etsy listing from a local Draft product in Etsy settings. Published products without an Etsy listing are not created automatically.");
    }
    if (mapping?.remoteState === "creating") {
      throw new EtsySyncError(
        "An Etsy listing creation may have reached Etsy, but its listing ID was not confirmed. Check the shop's draft listings and reconcile the mapping before retrying to avoid creating a duplicate.",
      );
    }

    this.validateProductForEtsy(product);
    const defaults = this.listingDefaults();
    const { token, shopId, currencyCode } = await this.accessToken();
    if (product.currency.trim().toUpperCase() !== currencyCode) {
      throw new EtsySyncError(`Product currency ${product.currency} does not match Etsy shop currency ${currencyCode}`);
    }
    const quantity = this.currentQuantity(product);
    const imageUrls = product.images.map((image) => image.url).slice(0, MAX_LISTING_IMAGES);
    if (product.images.length > MAX_LISTING_IMAGES) {
      throw new EtsySyncError(`Etsy supports up to ${MAX_LISTING_IMAGES} listing photos; remove extra product photos before syncing`);
    }
    const imageFingerprint = createHash("sha256").update(JSON.stringify(imageUrls)).digest("hex");

    if (!mapping) {
      const createBody = new URLSearchParams({
        quantity: String(Math.max(1, quantity)),
        title: product.name,
        description: product.description || product.name,
        price: String(Number(product.price)),
        who_made: defaults.whoMade,
        when_made: defaults.whenMade,
        is_supply: String(defaults.isSupply),
        taxonomy_id: String(defaults.taxonomyId),
        shipping_profile_id: String(defaults.shippingProfileId),
        return_policy_id: String(defaults.returnPolicyId),
        readiness_state_id: String(defaults.readinessStateId),
      });
      // Reserve this product before making the non-idempotent Etsy POST. If the
      // response is lost after Etsy creates the listing, retries must stop for
      // manual reconciliation instead of silently creating another listing.
      const reservationId = `pending:${productId}`;
      mapping = await this.prisma.etsyListingMapping.create({
        data: { productId, etsyListingId: reservationId, remoteState: "creating" },
      });
      let created: EtsyListingResponse;
      try {
        created = await this.apiRequest<EtsyListingResponse>(`/shops/${shopId}/listings`, token, {
          method: "POST",
          body: createBody.toString(),
          contentType: "application/x-www-form-urlencoded",
        });
      } catch (error) {
        // A definitive client rejection means Etsy did not create the listing;
        // release the reservation so corrected product data can be retried.
        // Network errors, rate limits, and server errors remain reserved because
        // the remote side effect may already have happened.
        if (error instanceof EtsyRequestError && !error.retryable) {
          await this.prisma.etsyListingMapping.deleteMany({ where: { productId, etsyListingId: reservationId } });
        }
        throw error;
      }
      if (!created.listing_id) throw new EtsyRequestError("Etsy did not return a listing ID; reconcile the shop draft before retrying", true);
      mapping = await this.prisma.etsyListingMapping.update({
        where: { productId },
        data: {
          etsyListingId: String(created.listing_id),
          listingUrl: created.url ?? null,
          remoteState: "draft",
        },
      });
    }

    const listingId = mapping.etsyListingId;
    const contentBody = new URLSearchParams({
      title: product.name,
      description: product.description || product.name,
      who_made: defaults.whoMade,
      when_made: defaults.whenMade,
      is_supply: String(defaults.isSupply),
      taxonomy_id: String(defaults.taxonomyId),
      shipping_profile_id: String(defaults.shippingProfileId),
      return_policy_id: String(defaults.returnPolicyId),
    });
    await this.apiRequest(`/shops/${shopId}/listings/${listingId}`, token, {
      method: "PATCH",
      body: contentBody.toString(),
      contentType: "application/x-www-form-urlencoded",
    });

    if (mapping.imageFingerprint !== imageFingerprint) {
      if (mapping.remoteState === "active") {
        await this.updateRemoteState(shopId, listingId, token, "inactive");
        mapping.remoteState = "inactive";
      }
      for (const imageId of mapping.imageIds) {
        await this.apiRequest(`/shops/${shopId}/listings/${listingId}/images/${imageId}`, token, { method: "DELETE" });
      }
      await this.prisma.etsyListingMapping.update({
        where: { productId },
        data: { imageIds: [], imageFingerprint: "" },
      });
      for (const [index, imageUrl] of imageUrls.entries()) {
        const imageId = await this.uploadImage(shopId, listingId, token, imageUrl, index + 1);
        const imageIds = [...(await this.prisma.etsyListingMapping.findUniqueOrThrow({ where: { productId }, select: { imageIds: true } })).imageIds, imageId];
        await this.prisma.etsyListingMapping.update({ where: { productId }, data: { imageIds } });
      }
      mapping = await this.prisma.etsyListingMapping.update({
        where: { productId },
        data: { imageFingerprint },
      });
    }

    const inventory = {
      products: [{
        sku: product.sku,
        offerings: [{
          price: Number(product.price),
          quantity: Math.max(1, quantity),
          is_enabled: true,
          readiness_state_id: defaults.readinessStateId,
        }],
        property_values: [],
      }],
      price_on_property: [],
      quantity_on_property: [],
      sku_on_property: [],
      readiness_state_on_property: [],
    };
    await this.apiRequest(`/listings/${listingId}/inventory`, token, {
      method: "PUT",
      body: JSON.stringify(inventory),
      contentType: "application/json",
    });

    const shouldBeActive = product.status === "Published" && quantity > 0;
    if (shouldBeActive && imageUrls.length === 0) {
      throw new EtsySyncError("This product is marked Published, but Etsy requires at least one photo before it can go live");
    }
    if (shouldBeActive && mapping.remoteState !== "active") {
      await this.updateRemoteState(shopId, listingId, token, "active");
      mapping.remoteState = "active";
    } else if (!shouldBeActive && mapping.remoteState === "active") {
      await this.updateRemoteState(shopId, listingId, token, "inactive");
      mapping.remoteState = "inactive";
    }

    await this.prisma.etsyListingMapping.update({
      where: { productId },
      data: { lastSyncedAt: new Date(), lastError: null },
    });
  }

  private async dispatchSyncQueue(): Promise<void> {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      if (!(await this.prisma.etsyShopConnection.findUnique({ where: { id: CONNECTION_ID }, select: { id: true } }))) return;
      if (this.listingConfigErrors().length) return;
      const now = new Date();
      const staleLock = new Date(now.getTime() - 5 * 60_000);
      const jobs = await this.prisma.etsySyncJob.findMany({
        where: {
          OR: [
            { status: "Pending", availableAt: { lte: now } },
            { status: "Processing", lockedAt: { lte: staleLock } },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 10,
        select: { productId: true, status: true, lockedAt: true, attempts: true, revision: true },
      });

      for (const job of jobs) {
        const lockAt = new Date();
        const claim = await this.prisma.etsySyncJob.updateMany({
          where: job.status === "Pending"
            ? { productId: job.productId, status: "Pending", availableAt: { lte: now }, revision: job.revision }
            : { productId: job.productId, status: "Processing", lockedAt: job.lockedAt, revision: job.revision },
          data: { status: "Processing", lockedAt: lockAt, attempts: { increment: 1 } },
        });
        if (claim.count !== 1) continue;

        try {
          await this.synchronizeProduct(job.productId);
          await this.prisma.etsySyncJob.updateMany({
            where: { productId: job.productId, status: "Processing", lockedAt: lockAt, revision: job.revision },
            data: { status: "Synced", lockedAt: null, attempts: 0, lastError: null },
          });
        } catch (error) {
          const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
          const retryable = error instanceof EtsyRequestError ? error.retryable : false;
          const attempt = job.attempts + 1;
          const retry = retryable && attempt < MAX_ATTEMPTS;
          const backoffMs = Math.min(60 * 60_000, 2 ** Math.min(attempt, 10) * 1000);
          await this.prisma.etsySyncJob.updateMany({
            where: { productId: job.productId, status: "Processing", lockedAt: lockAt, revision: job.revision },
            data: {
              status: retry ? "Pending" : "Failed",
              availableAt: retry ? new Date(Date.now() + backoffMs) : now,
              lockedAt: null,
              lastError: message,
            },
          });
          await this.prisma.etsyListingMapping.updateMany({ where: { productId: job.productId }, data: { lastError: message } });
          if (retry) this.logger.warn(`Etsy product sync ${job.productId} failed; retry ${attempt} is scheduled`);
          else this.logger.error(`Etsy product sync ${job.productId} needs attention: ${message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Etsy sync queue failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.dispatching = false;
    }
  }
}
