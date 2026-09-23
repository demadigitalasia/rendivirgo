import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { SettingsService } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get("public")
  getPublic() {
    return this.settingsService.getPublicSettings();
  }
}

@Controller("admin/settings")
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get() {
    return this.settingsService.getAdminSettings();
  }

  @Patch()
  update(@Body() body: Record<string, unknown>, @Req() request: AuthenticatedRequest) {
    return this.settingsService.updateSettings(body, auditContextFrom(request));
  }
}
