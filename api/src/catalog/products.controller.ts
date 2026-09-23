import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { BulkProductActionDto, CreateProductDto, ProductQueryDto, UpdateProductDto } from "./dto/product.dto";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  list(@Query() query: ProductQueryDto) {
    return this.productsService.listPublic(query);
  }

  @Public()
  @Get("filters")
  filters() {
    return this.productsService.filters();
  }

  @Public()
  @Get(":slug")
  detail(@Param("slug") slug: string) {
    return this.productsService.getPublicBySlug(slug);
  }

  @Public()
  @Get(":slug/related")
  related(@Param("slug") slug: string, @Query("limit") limit: string | undefined) {
    return this.productsService.related(slug, Math.min(12, Math.max(1, Number(limit) || 4)));
  }
}

@Controller("admin/products")
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: ProductQueryDto) {
    return this.productsService.listAdmin(query);
  }

  @Get("export.csv")
  async exportCsv(@Query() query: ProductQueryDto, @Res() response: Response) {
    const csv = await this.productsService.exportCsv(query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="rendi-virgo-products-${Date.now()}.csv"`);
    response.send(csv);
  }

  @Post("import")
  importCsv(@Body("csv") csv: string, @Req() request: AuthenticatedRequest) {
    return this.productsService.importCsv(csv ?? "", auditContextFrom(request));
  }

  @Post()
  create(@Body() dto: CreateProductDto, @Req() request: AuthenticatedRequest) {
    return this.productsService.create(dto, auditContextFrom(request));
  }

  @Patch("bulk")
  bulk(@Body() dto: BulkProductActionDto, @Req() request: AuthenticatedRequest) {
    return this.productsService.bulk(dto, auditContextFrom(request));
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.productsService.getAdminById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProductDto, @Req() request: AuthenticatedRequest) {
    return this.productsService.update(id, dto, auditContextFrom(request));
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Query("hard") hard: string | undefined, @Req() request: AuthenticatedRequest) {
    if (hard === "true") {
      return this.productsService.bulk({ ids: [id], action: "Delete" }, auditContextFrom(request));
    }
    return this.productsService.bulk({ ids: [id], action: "Archive" }, auditContextFrom(request));
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.productsService.duplicate(id, auditContextFrom(request));
  }

  @Get(":id/price-history")
  priceHistory(@Param("id") id: string) {
    return this.productsService.priceHistory(id);
  }
}
