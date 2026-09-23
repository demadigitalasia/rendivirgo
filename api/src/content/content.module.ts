import { Module } from "@nestjs/common";
import { BannersService } from "./banners.service";
import { AdminBannersController, BannersController } from "./banners.controller";
import { BlogService } from "./blog.service";
import { AdminBlogController, BlogController } from "./blog.controller";
import { PagesService } from "./pages.service";
import { AdminPagesController, PagesController } from "./pages.controller";
import { AdminSiteContentController, SiteContentController } from "./site-content.controller";
import { SiteContentService } from "./site-content.service";
import { TestimonialsService } from "./testimonials.service";
import { AdminTestimonialsController, TestimonialsController } from "./testimonials.controller";

@Module({
  controllers: [
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
  providers: [BlogService, PagesService, TestimonialsService, BannersService, SiteContentService],
  exports: [BlogService, PagesService, TestimonialsService, BannersService, SiteContentService],
})
export class ContentModule {}
