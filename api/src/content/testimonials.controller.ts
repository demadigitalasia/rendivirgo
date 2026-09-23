import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { CreateTestimonialDto, TestimonialQueryDto, UpdateTestimonialDto } from "./dto/content.dto";
import { TestimonialsService } from "./testimonials.service";

@Controller("testimonials")
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Public()
  @Get()
  list() {
    return this.testimonialsService.listPublic();
  }
}

@Controller("admin/testimonials")
export class AdminTestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  list(@Query() query: TestimonialQueryDto) {
    return this.testimonialsService.listAdmin(query);
  }

  @Post()
  create(@Body() dto: CreateTestimonialDto, @Req() request: AuthenticatedRequest) {
    return this.testimonialsService.create(dto, auditContextFrom(request));
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.testimonialsService.getAdminById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTestimonialDto, @Req() request: AuthenticatedRequest) {
    return this.testimonialsService.update(id, dto, auditContextFrom(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.testimonialsService.remove(id, auditContextFrom(request));
  }
}
