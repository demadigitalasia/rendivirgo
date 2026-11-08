import { Body, Controller, Delete, Get, Param, Post, Req } from "@nestjs/common";
import type { AuthenticatedAdmin, AuthenticatedRequest } from "../common/types/authenticated-request";
import { CurrentAdmin } from "../common/decorators/current-admin.decorator";
import { AuditService } from "../audit/audit.service";
import { ApiKeysService } from "./api-keys.service";
import { CreateApiKeyDto } from "./dto/api-keys.dto";

@Controller("admin/api-keys")
export class ApiKeysController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.apiKeysService.listKeys(admin.id);
  }

  @Post()
  async create(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: CreateApiKeyDto, @Req() request: AuthenticatedRequest) {
    const { apiKey, token } = await this.apiKeysService.createKey(admin.id, dto);
    await this.auditService.log({
      adminId: admin.id,
      action: "apikey.created",
      entityType: "AdminApiKey",
      entityId: apiKey.id,
      summary: `API key "${apiKey.name}" created with scopes: ${apiKey.scopes.join(", ")}`,
      ip: request.ip ?? null,
      userAgent: (request.headers["user-agent"] as string | undefined) ?? null,
    });
    return { apiKey, token };
  }

  @Delete(":id")
  async revoke(@CurrentAdmin() admin: AuthenticatedAdmin, @Param("id") id: string, @Req() request: AuthenticatedRequest) {
    await this.apiKeysService.revokeKey(admin.id, id);
    await this.auditService.log({
      adminId: admin.id,
      action: "apikey.revoked",
      entityType: "AdminApiKey",
      entityId: id,
      summary: "API key revoked",
      ip: request.ip ?? null,
      userAgent: (request.headers["user-agent"] as string | undefined) ?? null,
    });
    return { ok: true };
  }
}
