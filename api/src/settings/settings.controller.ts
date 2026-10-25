import { Body, Controller, Delete, Get, Patch, Put, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { UpdateOpenRouterSettingsDto } from "./dto/openrouter-settings.dto";
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

  @Get("ai/openrouter")
  getOpenRouterSettings() {
    return this.settingsService.getOpenRouterSettingsStatus();
  }

  @Get("ai/openrouter/models")
  getOpenRouterModels() {
    return this.settingsService.listOpenRouterModels();
  }

  @Get("ai/usage")
  getOpenRouterUsage() {
    return this.settingsService.getOpenRouterUsage();
  }

  @Put("ai/openrouter")
  updateOpenRouterSettings(@Body() body: UpdateOpenRouterSettingsDto, @Req() request: AuthenticatedRequest) {
    return this.settingsService.updateOpenRouterSettings(body, auditContextFrom(request));
  }

  @Delete("ai/openrouter/api-key")
  clearOpenRouterApiKey(@Req() request: AuthenticatedRequest) {
    return this.settingsService.clearOpenRouterApiKey(auditContextFrom(request));
  }
}
