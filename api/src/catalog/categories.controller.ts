import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { CategoriesService } from "./categories.service";
import { CategoryQueryDto, CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  list(@Query() query: CategoryQueryDto) {
    return query.includeInactive ? this.categoriesService.listAdmin() : this.categoriesService.listPublic();
  }

  @Public()
  @Get(":slug")
  detail(@Param("slug") slug: string) {
    return this.categoriesService.findBySlug(slug);
  }
}

@Controller("admin/categories")
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list() {
    return this.categoriesService.listAdmin();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto, @Req() request: AuthenticatedRequest) {
    return this.categoriesService.create(dto, auditContextFrom(request));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCategoryDto, @Req() request: AuthenticatedRequest) {
    return this.categoriesService.update(id, dto, auditContextFrom(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Query("force") force: string | undefined, @Req() request: AuthenticatedRequest) {
    return this.categoriesService.remove(id, auditContextFrom(request), force === "true");
  }
}
