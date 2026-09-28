import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { CreateReviewDto, ReviewQueryDto, UpdateReviewStatusDto } from "./dto/review.dto";
import { ReviewsService } from "./reviews.service";

@Controller("products")
export class ProductReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get(":slug/reviews")
  list(@Param("slug") slug: string, @Query() query: PaginationQueryDto) {
    return this.reviewsService.listPublic(slug, query.page, query.pageSize);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(":slug/reviews")
  create(@Param("slug") slug: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createForProduct(slug, dto);
  }
}

@Controller("admin/reviews")
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  list(@Query() query: ReviewQueryDto) {
    return this.reviewsService.listAdmin(query);
  }

  @Patch(":id")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateReviewStatusDto, @Req() request: AuthenticatedRequest) {
    return this.reviewsService.updateStatus(id, dto.status, auditContextFrom(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.reviewsService.remove(id, auditContextFrom(request));
  }
}
