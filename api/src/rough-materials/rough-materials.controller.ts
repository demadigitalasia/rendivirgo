import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { RoughQuoteDto, SaveRoughMaterialDto } from "./rough-materials.dto";
import { RoughMaterialsService } from "./rough-materials.service";

@Public()
@Controller("rough-materials")
export class RoughMaterialsController {
  constructor(private readonly materials: RoughMaterialsService) {}
  @Get()
  catalog() { return this.materials.catalog(); }
  @Post("quote")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  quote(@Body() dto: RoughQuoteDto) { return this.materials.quote(dto); }
}

@Controller("admin/rough-materials")
export class AdminRoughMaterialsController {
  constructor(private readonly materials: RoughMaterialsService) {}
  @Get()
  list() { return this.materials.listAdmin(); }
  @Post()
  create(@Body() dto: SaveRoughMaterialDto, @Req() request: AuthenticatedRequest) { return this.materials.save(null, dto, auditContextFrom(request)); }
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: SaveRoughMaterialDto, @Req() request: AuthenticatedRequest) { return this.materials.save(id, dto, auditContextFrom(request)); }
}
