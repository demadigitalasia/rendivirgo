import { Body, Controller, Delete, Get, HttpException, Logger, Post, Query, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsString, MaxLength, MinLength } from "class-validator";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { GoogleSearchConsoleService } from "./google-search-console.service";

class SelectSearchConsoleSiteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  siteUrl: string;
}

@Controller("admin/integrations/search-console")
export class GoogleSearchConsoleController {
  private readonly logger = new Logger(GoogleSearchConsoleController.name);

  constructor(private readonly searchConsole: GoogleSearchConsoleService) {}

  @Get()
  status() {
    return this.searchConsole.getAdminStatus();
  }

  @Get("sites")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  sites() {
    return this.searchConsole.listSites();
  }

  @Post("connect")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  connect(@Req() request: AuthenticatedRequest) {
    return this.searchConsole.startOAuth(request.adminSession?.id);
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
      await this.searchConsole.completeOAuth({ code, state, error, context: auditContextFrom(request) });
      response.redirect(302, this.searchConsole.settingsRedirect("connected"));
    } catch (caught) {
      if (caught instanceof HttpException) {
        this.logger.warn(`Search Console OAuth callback rejected (${caught.name})`);
      } else {
        this.logger.warn(`Search Console OAuth callback failed (${caught instanceof Error ? caught.name : "UnknownError"})`);
      }
      response.redirect(302, this.searchConsole.settingsRedirect("error"));
    }
  }

  @Post("site")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  selectSite(@Body() body: SelectSearchConsoleSiteDto, @Req() request: AuthenticatedRequest) {
    return this.searchConsole.selectSite(body.siteUrl, auditContextFrom(request));
  }

  @Post("sync")
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  sync(@Req() request: AuthenticatedRequest) {
    return this.searchConsole.syncReport(auditContextFrom(request));
  }

  @Post("insights")
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  insights(@Req() request: AuthenticatedRequest) {
    return this.searchConsole.generateInsights(auditContextFrom(request));
  }

  @Delete()
  disconnect(@Req() request: AuthenticatedRequest) {
    return this.searchConsole.disconnect(auditContextFrom(request));
  }
}
