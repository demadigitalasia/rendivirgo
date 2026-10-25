import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { BlogService } from "./blog.service";
import { BlogQueryDto, CreateBlogPostDto, GenerateBlogCopyDto, UpdateBlogPostDto } from "./dto/content.dto";
import { storefrontLanguage } from "../common/utils/storefront-language";
import { ContentCopyService } from "./content-copy.service";

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
  detail(@Param("slug") slug: string, @Headers("x-rv-language") language?: string, @Headers("x-rv-seo-audit") seoAudit?: string) {
    return this.blogService.getPublicBySlug(slug, storefrontLanguage(language), seoAudit !== "1");
  }
}

@Controller("admin/blog")
export class AdminBlogController {
  constructor(
    private readonly blogService: BlogService,
    private readonly contentCopyService: ContentCopyService,
  ) {}

  @Get()
  list(@Query() query: BlogQueryDto) {
    return this.blogService.listAdmin(query);
  }

  @Post("generate-copy")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async generateCopy(@Body() dto: GenerateBlogCopyDto, @Req() request: AuthenticatedRequest) {
    const draft = await this.contentCopyService.generate({
      kind: "blog",
      context: JSON.stringify({ title: dto.title }),
      brief: dto.brief,
    }, auditContextFrom(request));
    return { ...draft, tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 8) };
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
