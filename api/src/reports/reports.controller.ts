import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ReportRangeQueryDto, SalesReportQueryDto } from "./dto/report.dto";
import { ReportsService } from "./reports.service";

@Controller("admin/reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("overview")
  overview(@Query() query: ReportRangeQueryDto) {
    return this.reportsService.overview(query);
  }

  @Get("sales")
  sales(@Query() query: SalesReportQueryDto) {
    return this.reportsService.sales(query);
  }

  @Get("products")
  products(@Query() query: ReportRangeQueryDto) {
    return this.reportsService.products(query);
  }

  @Get("customers")
  customers(@Query() query: ReportRangeQueryDto) {
    return this.reportsService.customers(query);
  }

  @Get("export/sales.csv")
  async exportSalesCsv(@Query() query: SalesReportQueryDto, @Res() response: Response) {
    const csv = await this.reportsService.exportSalesCsv(query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="rendi-virgo-sales-${Date.now()}.csv"`);
    response.send(csv);
  }

  @Get("export/products.csv")
  async exportProductsCsv(@Query() query: ReportRangeQueryDto, @Res() response: Response) {
    const csv = await this.reportsService.exportProductsCsv(query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="rendi-virgo-products-${Date.now()}.csv"`);
    response.send(csv);
  }

  @Get("traffic")
  traffic() {
    return this.reportsService.traffic();
  }
}
