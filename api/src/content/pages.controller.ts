import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { CreatePageDto, PageQueryDto, UpdatePageDto } from "./dto/content.dto";
import { PagesService } from "./pages.service";
import { storefrontLanguage } from "../common/utils/storefront-language";

@Controller("pages")
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Public()
  @Get()
  list(@Headers("x-rv-language") language?: string) {
    return this.pagesService.listPublic(storefrontLanguage(language));
  }

  @Public()
  @Get(":slug")
  detail(@Param("slug") slug: string, @Headers("x-rv-language") language?: string) {
    return this.pagesService.getPublicBySlug(slug, storefrontLanguage(language));
  }
}

@Controller("admin/pages")
export class AdminPagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  list(@Query() query: PageQueryDto) {
    return this.pagesService.listAdmin(query);
  }

  @Post()
  create(@Body() dto: CreatePageDto, @Req() request: AuthenticatedRequest) {
    return this.pagesService.create(dto, auditContextFrom(request));
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.pagesService.getAdminById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePageDto, @Req() request: AuthenticatedRequest) {
    return this.pagesService.update(id, dto, auditContextFrom(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.pagesService.remove(id, auditContextFrom(request));
  }
}
