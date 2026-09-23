import { Body, Controller, Delete, Get, Param, Patch, Query, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { CustomersService } from "./customers.service";
import { CustomerQueryDto, UpdateCustomerDto } from "./dto/customer.dto";

@Controller("admin/customers")
export class AdminCustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@Query() query: CustomerQueryDto) {
    return this.customersService.list(query);
  }

  @Get("export.csv")
  async exportCsv(@Query() query: CustomerQueryDto, @Res() response: Response) {
    const csv = await this.customersService.exportCsv(query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="rendi-virgo-customers-${Date.now()}.csv"`);
    response.send(csv);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.customersService.detail(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto, @Req() request: AuthenticatedRequest) {
    return this.customersService.update(id, dto, auditContextFrom(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.customersService.remove(id, auditContextFrom(request));
  }
}
