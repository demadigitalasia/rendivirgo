import { Controller, Delete, Get, Post, Query, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { EtsyIntegrationService } from "./etsy-integration.service";

function queryValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

@Controller("admin/integrations/etsy")
export class EtsyIntegrationController {
  constructor(private readonly etsy: EtsyIntegrationService) {}

  @Get()
  status() {
    return this.etsy.getAdminStatus();
  }

  @Post("connect")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  connect(@Req() request: AuthenticatedRequest) {
    return this.etsy.startOAuth(request.adminSession?.id);
  }

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
        adminSessionId: request.adminSession?.id,
        context: auditContextFrom(request),
      });
      response.redirect(302, this.etsy.settingsRedirect("connected"));
    } catch {
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
