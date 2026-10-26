import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";
import { ContentCopyService, type SearchConsoleInsight } from "../content/content-copy.service";

const CONNECTION_ID = "primary";
const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const OAUTH_STATE_TTL_MS = 10 * 60_000;
const GOOGLE_SEARCH_CONSOLE_API = "https://www.googleapis.com/webmasters/v3";

type OAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};

type SiteEntry = { siteUrl?: string; permissionLevel?: string };
type AnalyticsRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

export type SearchConsoleMetricRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsolePeriod = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQueries: SearchConsoleMetricRow[];
  topPages: SearchConsoleMetricRow[];
};

export type SearchConsoleReport = {
  siteUrl: string;
  currentRange: { startDate: string; endDate: string };
  previousRange: { startDate: string; endDate: string };
  current: SearchConsolePeriod;
  previous: SearchConsolePeriod;
  generatedAt: string;
  note: string;
};

@Injectable()
export class GoogleSearchConsoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly copy: ContentCopyService,
  ) {}

  private configErrors(): string[] {
    const missing: string[] = [];
    if (!this.config.get<string>("GOOGLE_SEARCH_CONSOLE_CLIENT_ID")?.trim()) missing.push("GOOGLE_SEARCH_CONSOLE_CLIENT_ID");
    if (!this.config.get<string>("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET")?.trim()) missing.push("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET");
    const redirectUri = this.config.get<string>("GOOGLE_SEARCH_CONSOLE_REDIRECT_URI")?.trim();
    if (!redirectUri) missing.push("GOOGLE_SEARCH_CONSOLE_REDIRECT_URI");
    else {
      try {
        const parsed = new URL(redirectUri);
        if (this.config.get<string>("NODE_ENV") === "production" && parsed.protocol !== "https:") {
          missing.push("GOOGLE_SEARCH_CONSOLE_REDIRECT_URI (must use HTTPS in production)");
        }
      } catch {
        missing.push("GOOGLE_SEARCH_CONSOLE_REDIRECT_URI (must be an absolute URL)");
      }
    }
    const secret = this.config.get<string>("SESSION_SECRET")?.trim();
    if (!secret || (this.config.get<string>("NODE_ENV") === "production" && secret.length < 32)) {
      missing.push("SESSION_SECRET (stable secret, at least 32 characters in production)");
    }
    return missing;
  }

  private requireConfig() {
    const missing = this.configErrors();
    if (missing.length) {
      throw new ServiceUnavailableException(`Configure Google Search Console on the API server: ${missing.join(", ")}`);
    }
    return {
      clientId: this.config.get<string>("GOOGLE_SEARCH_CONSOLE_CLIENT_ID")!.trim(),
      clientSecret: this.config.get<string>("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET")!.trim(),
      redirectUri: this.config.get<string>("GOOGLE_SEARCH_CONSOLE_REDIRECT_URI")!.trim(),
    };
  }

  private encryptionKey(): Buffer {
    const secret = this.config.get<string>("SESSION_SECRET")?.trim();
    if (!secret || (this.config.get<string>("NODE_ENV") === "production" && secret.length < 32)) {
      throw new ServiceUnavailableException("Google Search Console token encryption requires a stable SESSION_SECRET of at least 32 characters in production");
    }
    return createHmac("sha256", secret).update("rendi-virgo:google-search-console-token:v1").digest();
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
      if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart) throw new Error("Invalid token format");
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(ivPart, "base64url"));
      decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextPart, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new ServiceUnavailableException("The saved Google Search Console token could not be decrypted. Reconnect Search Console.");
    }
  }

  async getAdminStatus() {
    const connection = await this.prisma.googleSearchConsoleConnection.findUnique({ where: { id: CONNECTION_ID } });
    return {
      configured: this.configErrors().length === 0,
      missingConfig: this.configErrors(),
      connected: Boolean(connection),
      siteUrl: connection?.siteUrl ?? null,
      connectedAt: connection?.connectedAt.toISOString() ?? null,
      lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
      report: connection?.lastReport as SearchConsoleReport | null,
    };
  }

  async startOAuth(adminSessionId: string | undefined) {
    if (!adminSessionId) throw new BadRequestException("An active admin session is required to connect Search Console");
    const { clientId, redirectUri } = this.requireConfig();
    const state = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const now = new Date();

    await this.prisma.googleSearchConsoleOAuthState.deleteMany({ where: { expiresAt: { lte: now } } });
    await this.prisma.googleSearchConsoleOAuthState.create({
      data: {
        stateHash: createHash("sha256").update(state).digest("hex"),
        codeVerifierEncrypted: this.encryptSecret(codeVerifier),
        adminSessionId,
        expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS),
      },
    });

    const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("client_id", clientId);
    authorization.searchParams.set("redirect_uri", redirectUri);
    authorization.searchParams.set("scope", SEARCH_CONSOLE_SCOPE);
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("access_type", "offline");
    authorization.searchParams.set("prompt", "consent");
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
      // Keep the local fallback if APP_ORIGIN is malformed.
    }
    const redirect = new URL("/admin/seo", origin);
    redirect.searchParams.set("gsc", result);
    return redirect.toString();
  }

  async completeOAuth(input: {
    code?: string;
    state?: string;
    error?: string;
    context: AuditContext;
  }): Promise<void> {
    if (!input.state) throw new BadRequestException("Google authorization state is missing");
    const stateHash = createHash("sha256").update(input.state).digest("hex");
    const now = new Date();
    const pending = await this.prisma.googleSearchConsoleOAuthState.findFirst({ where: { stateHash, expiresAt: { gt: now } } });
    if (!pending) throw new BadRequestException("Google authorization state is invalid or expired");
    const initiatingSession = await this.prisma.adminSession.findFirst({
      where: { id: pending.adminSessionId, revokedAt: null, expiresAt: { gt: now } },
      select: { adminId: true },
    });
    if (!initiatingSession) throw new BadRequestException("The admin session that started Search Console authorization is no longer active");
    const consumed = await this.prisma.googleSearchConsoleOAuthState.deleteMany({ where: { id: pending.id, stateHash } });
    if (consumed.count !== 1) throw new BadRequestException("Google authorization state has already been used");
    if (input.error) throw new BadRequestException("Google Search Console authorization was declined");
    if (!input.code) throw new BadRequestException("Google did not return an authorization code");

    const { clientId, clientSecret, redirectUri } = this.requireConfig();
    const tokenResponse = await this.fetchToken(new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: this.decryptSecret(pending.codeVerifierEncrypted),
    }));
    const scopes = tokenResponse.scope?.split(/\s+/).filter(Boolean) ?? [];
    if (!scopes.includes(SEARCH_CONSOLE_SCOPE) || scopes.some((scope) => scope === "https://www.googleapis.com/auth/webmasters")) {
      throw new BadRequestException("Google did not grant the requested read-only Search Console access. Reconnect and approve the requested permission.");
    }
    if (!tokenResponse.refresh_token) {
      throw new BadRequestException("Google did not return a refresh token. Reconnect and approve persistent read-only access.");
    }

    await this.prisma.googleSearchConsoleConnection.upsert({
      where: { id: CONNECTION_ID },
      create: { id: CONNECTION_ID, refreshTokenEncrypted: this.encryptSecret(tokenResponse.refresh_token) },
      update: {
        refreshTokenEncrypted: this.encryptSecret(tokenResponse.refresh_token),
        siteUrl: null,
        lastReport: undefined,
        lastSyncedAt: null,
        connectedAt: new Date(),
      },
    });
    await this.audit.log({
      adminId: input.context.adminId ?? initiatingSession.adminId,
      action: "integration.search_console.connected",
      entityType: "GoogleSearchConsoleConnection",
      entityId: CONNECTION_ID,
      summary: "Connected Google Search Console with read-only access",
      metadata: { scopes },
      ip: input.context.ip,
      userAgent: input.context.userAgent,
    });
  }

  async listSites() {
    const connection = await this.requireConnection();
    const accessToken = await this.accessToken(connection);
    const payload = await this.googleJson<{ siteEntry?: SiteEntry[] }>(`${GOOGLE_SEARCH_CONSOLE_API}/sites`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }, "list Search Console properties");
    return (payload.siteEntry ?? [])
      .filter((site): site is SiteEntry & { siteUrl: string } => typeof site.siteUrl === "string" && Boolean(site.siteUrl.trim()))
      .filter((site) => isRendiVirgoProperty(site.siteUrl))
      .map((site) => ({ siteUrl: site.siteUrl, permissionLevel: site.permissionLevel ?? "unknown" }))
      .sort((a, b) => a.siteUrl.localeCompare(b.siteUrl));
  }

  async selectSite(siteUrl: string, context: AuditContext) {
    const normalized = siteUrl.trim();
    if (!normalized || normalized.length > 2048) throw new BadRequestException("Choose a valid Search Console property");
    const sites = await this.listSites();
    if (!sites.some((site) => site.siteUrl === normalized)) {
      throw new BadRequestException("The connected Google account does not have access to that Search Console property");
    }
    await this.prisma.googleSearchConsoleConnection.update({
      where: { id: CONNECTION_ID },
      data: { siteUrl: normalized, lastReport: undefined, lastSyncedAt: null },
    });
    await this.audit.log({
      adminId: context.adminId,
      action: "integration.search_console.property_selected",
      entityType: "GoogleSearchConsoleConnection",
      entityId: CONNECTION_ID,
      summary: "Selected a Search Console property for the admin SEO dashboard",
      metadata: { siteUrl: normalized },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return this.getAdminStatus();
  }

  async syncReport(context: AuditContext) {
    const connection = await this.requireConnection();
    if (!connection.siteUrl) throw new BadRequestException("Choose a Search Console property before refreshing its report");
    const accessToken = await this.accessToken(connection);
    const reportDate = new Date();
    const endDate = dateOffset(-3, reportDate);
    const startDate = dateOffset(-30, reportDate);
    const previousEndDate = dateOffset(-31, reportDate);
    const previousStartDate = dateOffset(-58, reportDate);
    const [current, previous] = await Promise.all([
      this.readPeriod(accessToken, connection.siteUrl, startDate, endDate),
      this.readPeriod(accessToken, connection.siteUrl, previousStartDate, previousEndDate),
    ]);
    const report: SearchConsoleReport = {
      siteUrl: connection.siteUrl,
      currentRange: { startDate, endDate },
      previousRange: { startDate: previousStartDate, endDate: previousEndDate },
      current,
      previous,
      generatedAt: new Date().toISOString(),
      note: "Search Console can omit low-volume or anonymized queries. The most recent three days are excluded because Google data may still be incomplete. Page and property totals use different aggregation; the page table sorts impressions within the API's top 25 click-ranked URLs.",
    };
    await this.prisma.googleSearchConsoleConnection.update({
      where: { id: CONNECTION_ID },
      data: { lastReport: report as unknown as Prisma.InputJsonValue, lastSyncedAt: new Date() },
    });
    await this.audit.log({
      adminId: context.adminId,
      action: "integration.search_console.report_synced",
      entityType: "GoogleSearchConsoleConnection",
      entityId: CONNECTION_ID,
      summary: "Refreshed Search Console performance data",
      metadata: { siteUrl: connection.siteUrl, startDate, endDate },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return report;
  }

  async generateInsights(context: AuditContext): Promise<{ generatedAt: string; insights: SearchConsoleInsight[] }> {
    const connection = await this.requireConnection();
    if (!connection.siteUrl || !connection.lastReport) {
      throw new BadRequestException("Refresh a Search Console report before generating AI recommendations");
    }
    const report = connection.lastReport as unknown as SearchConsoleReport;
    if (report.siteUrl !== connection.siteUrl) throw new ServiceUnavailableException("The saved Search Console report does not match the selected property. Refresh the report.");
    const insights = await this.copy.generateSearchConsoleInsights(report, context);
    const pageUrls = new Set(Array.isArray(report.current?.topPages)
      ? report.current.topPages.map((page) => page.key).filter((url): url is string => typeof url === "string")
      : []);
    const safe = insights.map((insight) => ({ ...insight, pageUrl: insight.pageUrl && pageUrls.has(insight.pageUrl) ? insight.pageUrl : null }));
    return { generatedAt: new Date().toISOString(), insights: safe };
  }

  async disconnect(context: AuditContext) {
    const connection = await this.prisma.googleSearchConsoleConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!connection) return { ok: true, disconnected: false, googleRevoked: true };
    let googleRevoked = false;
    try {
      const token = this.decryptSecret(connection.refreshTokenEncrypted);
      const response = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(10_000),
      });
      googleRevoked = response.ok;
    } catch {
      googleRevoked = false;
    }
    await this.prisma.$transaction([
      this.prisma.googleSearchConsoleConnection.deleteMany({ where: { id: CONNECTION_ID } }),
      this.prisma.googleSearchConsoleOAuthState.deleteMany({}),
    ]);
    await this.audit.log({
      adminId: context.adminId,
      action: "integration.search_console.disconnected",
      entityType: "GoogleSearchConsoleConnection",
      entityId: CONNECTION_ID,
      summary: "Disconnected Google Search Console",
      metadata: { googleRevoked },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return { ok: true, disconnected: true, googleRevoked };
  }

  private async requireConnection() {
    const connection = await this.prisma.googleSearchConsoleConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!connection) throw new BadRequestException("Connect a Google account with Search Console access first");
    return connection;
  }

  private async accessToken(connection: { refreshTokenEncrypted: string }): Promise<string> {
    const { clientId, clientSecret } = this.requireConfig();
    const response = await this.fetchToken(new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.decryptSecret(connection.refreshTokenEncrypted),
      client_id: clientId,
      client_secret: clientSecret,
    }));
    if (!response.access_token) throw new ServiceUnavailableException("Google did not return an access token. Reconnect Search Console.");
    if (response.refresh_token) {
      await this.prisma.googleSearchConsoleConnection.update({
        where: { id: CONNECTION_ID },
        data: { refreshTokenEncrypted: this.encryptSecret(response.refresh_token) },
      });
    }
    return response.access_token;
  }

  private async fetchToken(params: URLSearchParams): Promise<OAuthTokenResponse> {
    let response: Response;
    try {
      response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException("Google authorization could not be reached. Please try again.");
    }
    if (!response.ok) throw new BadGatewayException("Google authorization failed. Reconnect Search Console and try again.");
    try { return await response.json() as OAuthTokenResponse; }
    catch { throw new BadGatewayException("Google returned an invalid authorization response."); }
  }

  private async googleJson<T>(url: string, init: RequestInit, operation: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    } catch {
      throw new BadGatewayException(`Google Search Console could not ${operation}. Try again shortly.`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ServiceUnavailableException("Google denied access to this Search Console property. Reconnect or check the Google account’s property permissions.");
    }
    if (response.status === 429) throw new ServiceUnavailableException("Google Search Console is temporarily limiting requests. Wait before refreshing again.");
    if (!response.ok) throw new BadGatewayException(`Google Search Console could not ${operation} (HTTP ${response.status}).`);
    try { return await response.json() as T; }
    catch { throw new BadGatewayException("Google Search Console returned invalid data."); }
  }

  private async queryAnalytics(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string,
    dimensions: string[],
  ): Promise<AnalyticsRow[]> {
    const body: Record<string, unknown> = { startDate, endDate, rowLimit: 25, type: "web" };
    if (dimensions.length) body.dimensions = dimensions;
    const payload = await this.googleJson<{ rows?: AnalyticsRow[] }>(
      `${GOOGLE_SEARCH_CONSOLE_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      "read search performance data",
    );
    return Array.isArray(payload.rows) ? payload.rows : [];
  }

  private async readPeriod(accessToken: string, siteUrl: string, startDate: string, endDate: string): Promise<SearchConsolePeriod> {
    const totalRows = await this.queryAnalytics(accessToken, siteUrl, startDate, endDate, []);
    const queryRows = await this.queryAnalytics(accessToken, siteUrl, startDate, endDate, ["query"]);
    const pageRows = await this.queryAnalytics(accessToken, siteUrl, startDate, endDate, ["page"]);
    const total = normalizeAnalyticsRow(totalRows[0], "All searches");
    const topQueries = queryRows.flatMap((row) => {
      const query = sanitizeQuery(row.keys?.[0]);
      return query ? [normalizeAnalyticsRow(row, query)] : [];
    });
    const topPages = pageRows.flatMap((row) => {
      const page = safePageUrlForProperty(siteUrl, row.keys?.[0]);
      return page ? [normalizeAnalyticsRow(row, page)] : [];
    }).sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
    return {
      clicks: total.clicks,
      impressions: total.impressions,
      ctr: total.ctr,
      position: total.position,
      topQueries,
      topPages,
    };
  }
}

function dateOffset(days: number, reference: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const part = (type: "year" | "month" | "day") => parts.find(item => item.type === type)?.value ?? "0";
  const date = new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day")) + days));
  return date.toISOString().slice(0, 10);
}

function normalizeAnalyticsRow(row: AnalyticsRow | undefined, key: string): SearchConsoleMetricRow {
  const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
  return {
    key: key.slice(0, 2048),
    clicks: finite(row?.clicks),
    impressions: finite(row?.impressions),
    ctr: finite(row?.ctr),
    position: finite(row?.position),
  };
}

function isRendiVirgoProperty(siteUrl: string): boolean {
  if (siteUrl.toLowerCase() === "sc-domain:rendivirgo.com") return true;
  try {
    const url = new URL(siteUrl);
    return ["http:", "https:"].includes(url.protocol)
      && ["rendivirgo.com", "www.rendivirgo.com"].includes(url.hostname.toLowerCase())
      && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function safePageUrlForProperty(siteUrl: string, value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const page = new URL(value);
    if (!["http:", "https:"].includes(page.protocol) || page.username || page.password || page.search || page.hash) return null;
    if (!["rendivirgo.com", "www.rendivirgo.com"].includes(page.hostname.toLowerCase())) return null;

    if (!siteUrl.toLowerCase().startsWith("sc-domain:")) {
      const property = new URL(siteUrl);
      const propertyPath = property.pathname.endsWith("/") ? property.pathname : `${property.pathname}/`;
      const pagePath = page.pathname.endsWith("/") ? page.pathname : `${page.pathname}/`;
      if (page.origin !== property.origin || !pagePath.startsWith(propertyPath)) return null;
    }
    return page.toString();
  } catch {
    return null;
  }
}

function sanitizeQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const query = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 160);
  if (!query || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(query)) return null;
  if (/(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)/.test(query)) return null;
  return query;
}
