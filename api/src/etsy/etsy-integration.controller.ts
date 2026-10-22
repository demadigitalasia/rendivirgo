import { Body, Controller, Delete, Get, HttpException, Logger, Param, Post, Query, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { EtsyIntegrationService } from "./etsy-integration.service";
import { CreateReadinessProfileDto } from "./dto/create-readiness-profile.dto";

function queryValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

@Controller("admin/integrations/etsy")
export class EtsyIntegrationController {
  private readonly logger = new Logger(EtsyIntegrationController.name);

  constructor(private readonly etsy: EtsyIntegrationService) {}

  @Get()
  status() {
    return this.etsy.getAdminStatus();
  }

  @Get("shop-profiles")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  shopProfiles() {
    return this.etsy.getShopProfiles();
  }

  @Post("shop-profiles/readiness")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  createReadinessProfile(@Body() dto: CreateReadinessProfileDto) {
    return this.etsy.createReadinessProfile(dto);
  }

  @Get("sync-candidates")
  syncCandidates() {
    return this.etsy.listDraftSyncCandidates();
  }

  @Post("sync/:productId")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  syncDraftProduct(@Param("productId") productId: string, @Req() request: AuthenticatedRequest) {
    return this.etsy.queueDraftProductSync(productId, auditContextFrom(request));
  }

  @Post("connect")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  connect(@Req() request: AuthenticatedRequest) {
    return this.etsy.startOAuth(request.adminSession?.id);
  }

  @Public()
  @Get("oauth/callback")
  async oauthCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    try {
      await this.etsy.completeOAuth({
        code: queryValue(code),
        state: queryValue(state),
        error: queryValue(error),
        context: auditContextFrom(request),
      });
      response.redirect(302, this.etsy.settingsRedirect("connected"));
    } catch (error) {
      const requestId = (request as AuthenticatedRequest & { id?: string }).id
        ?.replace(/[^a-zA-Z0-9._-]/g, "")
        .slice(0, 80);
      const requestContext = requestId ? ` rid=${requestId}` : "";

      if (error instanceof HttpException) {
        const response = error.getResponse();
        const message = typeof response === "string"
          ? response
          : response && typeof response === "object" && "message" in response
            ? (response as { message?: unknown }).message
            : undefined;
        const safeMessage = typeof message === "string"
          ? message.replace(/[\r\n\t]+/g, " ").slice(0, 240)
          : "Request rejected";
        this.logger.warn(`Etsy OAuth callback failed (${error.name}: ${safeMessage})${requestContext}`);
      } else {
        const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
        const operation = ["token exchange", "shop lookup", "shop details"].includes(String(details.operation))
          ? String(details.operation)
          : undefined;
        const statusCode = typeof details.statusCode === "number" && Number.isInteger(details.statusCode)
          ? ` HTTP ${details.statusCode}`
          : "";
        const errorName = error instanceof Error ? error.name : "UnknownError";
        this.logger.warn(
          `Etsy OAuth callback failed (${errorName}${operation ? ` during ${operation}` : ""}${statusCode})${requestContext}`,
        );
      }
      response.redirect(302, this.etsy.settingsRedirect("error"));
    }
  }

  @Post("retry")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  retry() {
    return this.etsy.retryFailed();
  }

  @Delete()
  disconnect(@Req() request: AuthenticatedRequest) {
    return this.etsy.disconnect(auditContextFrom(request));
  }
}
