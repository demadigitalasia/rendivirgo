import { Body, Controller, Get, Headers, Patch, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { storefrontLanguage } from "../common/utils/storefront-language";
import { NavigationService } from "./navigation.service";

@Controller("navigation")
export class StorefrontNavigationController {
  constructor(private readonly navigation: NavigationService) {}

  @Public()
  @Get()
  getPublic(@Headers("x-rv-language") language?: string) {
    return this.navigation.getPublic(storefrontLanguage(language));
  }
}

@Controller("admin/navigation")
export class AdminNavigationController {
  constructor(private readonly navigation: NavigationService) {}

  @Get()
  get() {
    return this.navigation.getAdmin();
  }

  @Patch()
  update(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.navigation.update(body, auditContextFrom(request));
  }
}
