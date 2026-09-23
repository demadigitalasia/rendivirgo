import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { DiscountsService } from "./discounts.service";
import { CreateDiscountDto, DiscountQueryDto, UpdateDiscountDto, ValidateDiscountDto } from "./dto/discount.dto";

@Controller("discounts")
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Public()
  @Post("validate")
  validate(@Body() dto: ValidateDiscountDto) {
    return this.discountsService.validate(dto);
  }
}

@Controller("admin/discounts")
export class AdminDiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get()
  list(@Query() query: DiscountQueryDto) {
    return this.discountsService.listAdmin(query);
  }

  @Post()
  create(@Body() dto: CreateDiscountDto, @Req() request: AuthenticatedRequest) {
    return this.discountsService.create(dto, auditContextFrom(request));
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.discountsService.getAdminById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateDiscountDto, @Req() request: AuthenticatedRequest) {
    return this.discountsService.update(id, dto, auditContextFrom(request));
  }

  @Patch(":id/toggle")
  toggle(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.discountsService.toggle(id, auditContextFrom(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.discountsService.remove(id, auditContextFrom(request));
  }
}
