import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { CategoriesService } from "./categories.service";
import { storefrontLanguage } from "../common/utils/storefront-language";
import { CreateCategoryDto, GenerateCategoryCopyDto, UpdateCategoryDto } from "./dto/category.dto";
import { ContentCopyService } from "../content/content-copy.service";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  list(@Headers("x-rv-language") language?: string) {
    return this.categoriesService.listPublic(storefrontLanguage(language));
  }

  @Public()
  @Get(":slug")
  detail(@Param("slug") slug: string, @Headers("x-rv-language") language?: string) {
    return this.categoriesService.findBySlug(slug, storefrontLanguage(language));
  }
}

@Controller("admin/categories")
export class AdminCategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly contentCopyService: ContentCopyService,
  ) {}

  @Get()
  list() {
    return this.categoriesService.listAdmin();
  }

  @Post("generate-copy")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  generateCopy(@Body() dto: GenerateCategoryCopyDto, @Req() request: AuthenticatedRequest) {
    return this.contentCopyService.generate({
      kind: "category",
      context: JSON.stringify({ name: dto.name, slug: dto.slug, description: dto.currentDescription }),
      brief: dto.brief,
    }, auditContextFrom(request));
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
