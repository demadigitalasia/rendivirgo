import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import {
  BulkShippingRatesDto,
  BulkUpdateShippingRatesDto,
  CreateShippingProfileDto,
  CreateShippingRateDto,
  ShippingQuoteDto,
  ShippingRateQueryDto,
  UpdateShippingProfileDto,
  UpdateShippingRateDto,
} from "./dto/settings.dto";
import { ShippingService } from "./shipping.service";

type UploadedWorkbookFile = { buffer: Buffer; originalname: string };

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

  @Patch("bulk")
  bulkUpdate(@Body() dto: BulkUpdateShippingRatesDto, @Req() request: AuthenticatedRequest) {
    return this.shippingService.bulkUpdateRates(dto, auditContextFrom(request));
  }

  @Delete("bulk")
  bulkRemove(@Body() dto: BulkShippingRatesDto, @Req() request: AuthenticatedRequest) {
    return this.shippingService.bulkRemoveRates(dto, auditContextFrom(request));
  }

  @Get("export")
  async exportRates(@Query("carrier") carrier: string | undefined, @Res() response: Response) {
    const { buffer, carrier: exportCarrier } = await this.shippingService.exportRatesXlsx(carrier);
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition", `attachment; filename="shipping-rates-${exportCarrier}-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    response.setHeader("Cache-Control", "no-store");
    response.send(buffer);
  }

  @Post("import/preview")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  previewImport(
    @UploadedFile() file: UploadedWorkbookFile | undefined,
    @Body("mode") mode: string,
  ) {
    if (!file?.buffer) throw new BadRequestException("Choose an XLSX file to preview.");
    if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
      throw new BadRequestException("Only .xlsx files are supported.");
    }
    return this.shippingService.previewRatesXlsx(file.buffer, mode || "merge");
  }

  @Post("import")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  importRates(
    @UploadedFile() file: UploadedWorkbookFile | undefined,
    @Body("mode") mode: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!file?.buffer) throw new BadRequestException("Choose an XLSX file to import.");
    if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
      throw new BadRequestException("Only .xlsx files are supported.");
    }
    return this.shippingService.importRatesXlsx(file.buffer, mode || "merge", auditContextFrom(request));
  }

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
