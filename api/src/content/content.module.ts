import { ContentCopyService } from "./content-copy.service";
import { ContentCopyController } from "./content-copy.controller";
import { Module } from "@nestjs/common";
import { BannersService } from "./banners.service";
import { AdminBannersController, BannersController } from "./banners.controller";
import { BlogService } from "./blog.service";
import { BlogCopyService } from "./blog-copy.service";
import { AdminBlogController, BlogController } from "./blog.controller";
import { PagesService } from "./pages.service";
import { AdminPagesController, PagesController } from "./pages.controller";
import { AdminSiteContentController, SiteContentController } from "./site-content.controller";
import { SiteContentService } from "./site-content.service";
import { TestimonialsService } from "./testimonials.service";
import { AdminTestimonialsController, TestimonialsController } from "./testimonials.controller";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [SettingsModule],
  controllers: [
    ContentCopyController,
    BlogController,
    AdminBlogController,
    PagesController,
    AdminPagesController,
    TestimonialsController,
    AdminTestimonialsController,
    BannersController,
    AdminBannersController,
    SiteContentController,
    AdminSiteContentController,
  ],
  providers: [ContentCopyService, BlogService, BlogCopyService, PagesService, TestimonialsService, BannersService, SiteContentService],
  exports: [BlogService, PagesService, TestimonialsService, BannersService, SiteContentService],
})
export class ContentModule {}
