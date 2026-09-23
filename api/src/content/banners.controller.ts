import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { BannersService } from "./banners.service";
import { BannerQueryDto, CreateBannerDto, PublicBannerQueryDto, UpdateBannerDto } from "./dto/content.dto";

@Controller("banners")
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Public()
  @Get()
  list(@Query() query: PublicBannerQueryDto) {
    return this.bannersService.listPublic(query);
  }
}

@Controller("admin/banners")
export class AdminBannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  list(@Query() query: BannerQueryDto) {
    return this.bannersService.listAdmin(query);
  }

  @Post()
  create(@Body() dto: CreateBannerDto, @Req() request: AuthenticatedRequest) {
    return this.bannersService.create(dto, auditContextFrom(request));
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.bannersService.getAdminById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBannerDto, @Req() request: AuthenticatedRequest) {
    return this.bannersService.update(id, dto, auditContextFrom(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.bannersService.remove(id, auditContextFrom(request));
  }
}
