import { Body, Controller, Delete, Get, Param, Post, Query, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import { NewsletterQueryDto, SubscribeNewsletterDto } from "./dto/newsletter.dto";
import { NewsletterService } from "./newsletter.service";

@Controller("newsletter")
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("subscribe")
  subscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.newsletterService.subscribe(dto);
  }
}

@Controller("admin/newsletter")
export class AdminNewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Get()
  list(@Query() query: NewsletterQueryDto) {
    return this.newsletterService.listAdmin(query);
  }

  @Get("export.csv")
  async exportCsv(@Query() query: NewsletterQueryDto, @Res() response: Response) {
    const csv = await this.newsletterService.exportCsv(query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="rendi-virgo-newsletter-${Date.now()}.csv"`);
    response.send(csv);
  }

  @Delete(":id")
  unsubscribe(@Param("id") id: string) {
    return this.newsletterService.unsubscribe(id);
  }
}
