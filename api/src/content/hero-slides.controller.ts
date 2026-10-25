import { Body, Controller, Get, Put, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { SaveHeroSlidesDto } from "./hero-slides.dto";
import { HeroSlidesService } from "./hero-slides.service";

@Controller("hero-slides")
export class HeroSlidesController {
  constructor(private readonly service: HeroSlidesService) {}
  @Public() @Get() get() { return this.service.getPublic(); }
}

@Controller("admin/hero-slides")
export class AdminHeroSlidesController {
  constructor(private readonly service: HeroSlidesService) {}
  @Get() get() { return this.service.getAdmin(); }
  @Put() save(@Body() body: SaveHeroSlidesDto, @Req() request: AuthenticatedRequest) { return this.service.save(body, auditContextFrom(request)); }
}
