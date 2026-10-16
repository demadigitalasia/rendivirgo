import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { BlogService } from "./blog.service";
import { BlogQueryDto, CreateBlogPostDto, UpdateBlogPostDto } from "./dto/content.dto";
import { storefrontLanguage } from "../common/utils/storefront-language";

@Controller("blog")
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Public()
  @Get()
  list(@Query() query: BlogQueryDto, @Headers("x-rv-language") language?: string) {
    return this.blogService.listPublic(query, storefrontLanguage(language));
  }

  @Public()
  @Get("tags")
  tags(@Headers("x-rv-language") language?: string) {
    return this.blogService.tags(storefrontLanguage(language));
  }

  @Public()
  @Get(":slug")
  detail(@Param("slug") slug: string, @Headers("x-rv-language") language?: string) {
    return this.blogService.getPublicBySlug(slug, storefrontLanguage(language));
  }
}

@Controller("admin/blog")
export class AdminBlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  list(@Query() query: BlogQueryDto) {
    return this.blogService.listAdmin(query);
  }

  @Post()
  create(@Body() dto: CreateBlogPostDto, @Req() request: AuthenticatedRequest) {
    return this.blogService.create(dto, auditContextFrom(request));
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.blogService.getAdminById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBlogPostDto, @Req() request: AuthenticatedRequest) {
    return this.blogService.update(id, dto, auditContextFrom(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.blogService.remove(id, auditContextFrom(request));
  }
}
