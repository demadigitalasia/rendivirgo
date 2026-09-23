import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { CreatePageDto, PageQueryDto, UpdatePageDto } from "./dto/content.dto";
import { PagesService } from "./pages.service";

@Controller("pages")
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Public()
  @Get()
  list() {
    return this.pagesService.listPublic();
  }

  @Public()
  @Get(":slug")
  detail(@Param("slug") slug: string) {
    return this.pagesService.getPublicBySlug(slug);
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
