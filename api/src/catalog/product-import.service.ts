import { BadRequestException, Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { ProductsService } from "./products.service";
import { CreateProductDto, UpdateProductDto } from "./dto/product.dto";
import type { AuditContext } from "../common/types/audit-context";
import { importColumns, type ImportRecord } from "./product-import";

@Injectable()
export class ProductImportService {
  constructor(private readonly prisma: PrismaService, private readonly products: ProductsService) {}

  async preview(records: ImportRecord[], mode: string) {
    if (!["create", "update", "merge"].includes(mode)) throw new BadRequestException("Invalid import mode");
    if (!Array.isArray(records) || !records.length || records.length > 500) throw new BadRequestException("Import between 1 and 500 rows");
    const categories = await this.prisma.category.findMany({ select: { id: true, slug: true } });
    const seen = new Set<string>();
    const rows = [];
    for (const [index, record] of records.entries()) {
      if (!record || typeof record !== "object" || Object.entries(record).some(([key, value]) => !importColumns.includes(key) || typeof value !== "string")) throw new BadRequestException("Invalid product data");
      const sku = record.sku?.trim();
      const errors: string[] = [];
      if (!sku) errors.push("SKU is required");
      if (seen.has(sku)) errors.push("Duplicate SKU in file");
      seen.add(sku);
      const existing = sku ? await this.prisma.product.findUnique({ where: { sku }, select: { id: true, name: true } }) : null;
      if (mode === "create" && existing) errors.push("SKU already exists; use update or merge");
      if (mode === "update" && !existing) errors.push("SKU not found");
      const data: Record<string, unknown> = { sku };
      for (const [key, value] of Object.entries(record)) {
        if (!value.trim() || key === "categorySlug" || key === "sku") continue;
        if (["price", "stockQuantity", "weightGram", "weightCarat", "lengthMm", "widthMm", "heightMm"].includes(key)) data[key] = Number(value);
        else if (["featured", "fragile"].includes(key)) {
          if (!["true", "false"].includes(value)) errors.push(`${key} must be true or false`);
          data[key] = value === "true";
        } else data[key] = value;
      }
      if (record.categorySlug?.trim()) {
        const category = categories.find(category => category.slug === record.categorySlug.trim());
        if (!category) errors.push("Category slug not found; create the category first");
        else data.categoryId = category.id;
      }
      if (!existing) {
        data.status = "Draft";
        data.stoneType ??= "Unknown";
        data.origin ??= "Indonesia";
        data.weightGram ??= 0;
      }
      const dto = existing ? plainToInstance(UpdateProductDto, data) : plainToInstance(CreateProductDto, data);
      const validation = await validate(dto);
      errors.push(...validation.flatMap(error => Object.values(error.constraints ?? {})));
      rows.push({ row: index + 2, sku, name: record.name || existing?.name || "", action: existing ? "update" : "create", id: existing?.id, errors, data: dto });
    }
    return { rows, valid: rows.every(row => !row.errors.length) };
  }

  async execute(records: ImportRecord[], mode: string, photos: Record<string, string[]>, context: AuditContext) {
    const preview = await this.preview(records, mode);
    if (!preview.valid) throw new BadRequestException("Fix all preview errors before importing");
    if (!photos || typeof photos !== "object" || Array.isArray(photos)) throw new BadRequestException("Invalid photos");
    for (const [sku, urls] of Object.entries(photos)) {
      if (!preview.rows.some(row => row.sku === sku) || !Array.isArray(urls) || urls.length > 20 || urls.some(url => typeof url !== "string")) throw new BadRequestException("Invalid photo mapping");
      const count = await this.prisma.mediaAsset.count({ where: { url: { in: [...new Set(urls)] }, folder: "products" } });
      if (count !== new Set(urls).size) throw new BadRequestException("Product photos must be uploaded to the product media library");
    }
    const result = { created: 0, updated: 0, errors: [] as string[] };
    for (const row of preview.rows) {
      try {
        const urls = photos[row.sku];
        if (urls?.length) row.data.images = urls.map((url, sortOrder) => ({ url, sortOrder, alt: row.name }));
        if (row.action === "update") { await this.products.update(row.id!, row.data, context); result.updated++; }
        else { await this.products.create(row.data as CreateProductDto, context); result.created++; }
      } catch (error) { result.errors.push(`Row ${row.row} (${row.sku}): ${(error as Error).message}`); }
    }
    return result;
  }
}
