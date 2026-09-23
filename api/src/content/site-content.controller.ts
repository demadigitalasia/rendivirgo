import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { SiteContentService } from "./site-content.service";

@Controller()
export class SiteContentController {
  constructor(private readonly siteContentService: SiteContentService) {}

  @Public()
  @Get("site-content")
  getPublic() {
    return this.siteContentService.getPublic();
  }
}

@Controller("admin/site-content")
export class AdminSiteContentController {
  constructor(private readonly siteContentService: SiteContentService) {}

  @Get()
  get() {
    return this.siteContentService.getAdmin();
  }

  @Patch()
  update(@Body() body: Record<string, unknown>, @Req() request: AuthenticatedRequest) {
    return this.siteContentService.update(body, auditContextFrom(request));
  }
}
