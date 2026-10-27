import { FileInterceptor } from "@nestjs/platform-express";
import { ProductImportService } from "./product-import.service";
import { importColumns, readProductTable, type ImportRecord } from "./product-import";
import { createXlsxBuffer } from "../settings/xlsx";
import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors, BadRequestException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { BulkProductActionDto, CatalogPdfQueryDto, CreateProductDto, GenerateProductCopyDto, ProductQueryDto, UpdateProductDto } from "./dto/product.dto";
import { ContentCopyService } from "../content/content-copy.service";
import { ProductsService } from "./products.service";
import { storefrontLanguage } from "../common/utils/storefront-language";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  list(@Query() query: ProductQueryDto, @Headers("x-rv-language") language?: string) {
    return this.productsService.listPublic(query, storefrontLanguage(language));
  }

  @Public()
  @Get("filters")
  filters() {
    return this.productsService.filters();
  }

  @Public()
  @Get(":slug")
  detail(@Param("slug") slug: string, @Headers("x-rv-language") language?: string) {
    return this.productsService.getPublicBySlug(slug, storefrontLanguage(language));
  }

  @Public()
  @Get(":slug/related")
  related(@Param("slug") slug: string, @Query("limit") limit: string | undefined, @Headers("x-rv-language") language?: string) {
    return this.productsService.related(slug, Math.min(12, Math.max(1, Number(limit) || 4)), storefrontLanguage(language));
  }
}

@Controller("admin/products")
export class AdminProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly contentCopyService: ContentCopyService,
    private readonly productImport: ProductImportService,
  ) {}

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

  @Get("catalog.pdf")
  async exportCatalogPdf(@Query() query: CatalogPdfQueryDto, @Res() response: Response) {
    const pdf = await this.productsService.exportCatalogPdf(query);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="rendi-virgo-catalog-${Date.now()}.pdf"`);
    response.send(pdf);
  }

  @Get("import/template")
  template(@Res() response: Response) {
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition", 'attachment; filename="product-import-template.xlsx"');
    response.send(createXlsxBuffer([{ name: "Products", headers: importColumns, rows: [] }]));
  }

  @Post("import/preview")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  async previewImport(@UploadedFile() file: { originalname: string; buffer: Buffer } | undefined, @Body("mode") mode: string) {
    if (!file?.buffer) throw new BadRequestException("Choose a product file");
    const records = readProductTable(file);
    return { ...await this.productImport.preview(records, mode || "create"), records };
  }

  @Post("import/commit")
  commitImport(@Body("records") records: ImportRecord[], @Body("mode") mode: string, @Body("photos") photos: Record<string, string[]>, @Req() request: AuthenticatedRequest) {
    return this.productImport.execute(records, mode, photos ?? {}, auditContextFrom(request));
  }

  @Post("import")
  importCsv(@Body("csv") csv: string, @Req() request: AuthenticatedRequest) {
    return this.productsService.importCsv(csv ?? "", auditContextFrom(request));
  }

  @Post("generate-copy")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  generateCopy(@Body() dto: GenerateProductCopyDto, @Req() request: AuthenticatedRequest) {
    return this.contentCopyService.generate({
      kind: "product",
      context: JSON.stringify({
        name: dto.name,
        description: dto.shortDescription,
        category: dto.category,
        stoneType: dto.stoneType,
        origin: dto.origin,
        condition: dto.condition,
        unit: dto.unit,
      }),
    }, auditContextFrom(request));
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
