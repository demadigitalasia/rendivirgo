import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import {
  CreateShippingProfileDto,
  CreateShippingRateDto,
  ShippingQuoteDto,
  ShippingRateQueryDto,
  UpdateShippingProfileDto,
  UpdateShippingRateDto,
} from "./dto/settings.dto";
import { ShippingService } from "./shipping.service";

@Controller("shipping")
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Public()
  @Post("quote")
  quote(@Body() dto: ShippingQuoteDto) {
    return this.shippingService.quote(dto);
  }
}

@Controller("admin/shipping/rates")
export class AdminShippingRatesController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  list(@Query() query: ShippingRateQueryDto) {
    return this.shippingService.listRates(query);
  }

  @Post()
  create(@Body() dto: CreateShippingRateDto, @Req() request: AuthenticatedRequest) {
    return this.shippingService.createRate(dto, auditContextFrom(request));
  }

  @Patch(":id/toggle")
  toggle(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.shippingService.toggleRate(id, auditContextFrom(request));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateShippingRateDto, @Req() request: AuthenticatedRequest) {
    return this.shippingService.updateRate(id, dto, auditContextFrom(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.shippingService.removeRate(id, auditContextFrom(request));
  }
}

@Controller("admin/shipping/profiles")
export class AdminShippingProfilesController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  list() {
    return this.shippingService.listProfiles();
  }

  @Post()
  create(@Body() dto: CreateShippingProfileDto, @Req() request: AuthenticatedRequest) {
    return this.shippingService.createProfile(dto, auditContextFrom(request));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateShippingProfileDto, @Req() request: AuthenticatedRequest) {
    return this.shippingService.updateProfile(id, dto, auditContextFrom(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.shippingService.removeProfile(id, auditContextFrom(request));
  }
}
