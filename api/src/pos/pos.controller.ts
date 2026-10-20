import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { CreatePosReservationDto, CreatePosSaleDto, PosSettingsDto } from "./dto/pos.dto";
import { PosService } from "./pos.service";

@Controller("admin/pos")
export class PosController {
  constructor(private readonly pos: PosService) {}

  @Get("settings")
  settings() {
    return this.pos.getSettings();
  }

  @Patch("settings")
  updateSettings(@Body() dto: PosSettingsDto, @Req() request: AuthenticatedRequest) {
    return this.pos.updateSettings(dto, auditContextFrom(request));
  }

  @Get("catalog")
  catalog(@Query("search") search?: string) {
    return this.pos.catalog(search ?? "");
  }

  @Post("reservations")
  reserve(@Body() dto: CreatePosReservationDto, @Req() request: AuthenticatedRequest) {
    return this.pos.reserveStock(dto, auditContextFrom(request));
  }

  @Patch("reservations/:id/refresh")
  refreshReservation(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.pos.refreshReservation(id, auditContextFrom(request));
  }

  @Delete("reservations/:id")
  releaseReservation(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.pos.releaseReservation(id, auditContextFrom(request));
  }

  @Post("sales")
  createSale(@Body() dto: CreatePosSaleDto, @Req() request: AuthenticatedRequest) {
    return this.pos.createSale(dto, auditContextFrom(request));
  }
}
