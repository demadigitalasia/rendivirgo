import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProductStatus } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { paginated, skipTake, type Paginated } from "../common/dto/pagination.dto";
import { slugify, uniqueSlug } from "../common/utils/slug";
import { PrismaService } from "../prisma/prisma.service";
import { BulkProductActionDto, CreateProductDto, ProductQueryDto, UpdateProductDto } from "./dto/product.dto";

export const productInclude = {
  category: true,
  images: { orderBy: { sortOrder: "asc" as const } },
  variants: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const sortMap: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  "price-asc": { price: "asc" },
  "price-desc": { price: "desc" },
  name: { name: "asc" },
  "weight-desc": { weightGram: "desc" },
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ mapping

  toApiProduct(product: ProductWithRelations) {
    const dimensionsMm = {
      length: product.lengthMm ?? 0,
      width: product.widthMm ?? 0,
      height: product.heightMm ?? 0,
    };

    const stockQuantity = product.stockModel === "Unique" ? 1 : (product.stockQuantity ?? 0);
    const inStock = product.status === "Published" && stockQuantity > 0;

    return {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      category: { id: product.category.id, slug: product.category.slug, name: product.category.name },
      categoryId: product.categoryId,
      categorySlug: product.category.slug,
      stoneType: product.stoneType,
      origin: product.origin,
      mohsHardness: product.mohsHardness,
      condition: product.condition,
      price: Number(product.price),
      compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
      currency: product.currency,
      unit: product.unit,
      stockModel: product.stockModel,
      stockQuantity,
      weightGram: product.weightGram,
      weightCarat: product.weightCarat,
      dimensionsMm,
      status: product.status,
      tone: product.tone,
      shippingClass: product.shippingClass,
      shippingProfileId: product.shippingProfileId,
      description: product.description,
      featured: product.featured,
      fragile: product.fragile,
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
        alt: image.alt,
        focalX: image.focalX,
        focalY: image.focalY,
        sortOrder: image.sortOrder,
      })),
      imageUrls: product.images.map((image) => image.url),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        price: Number(variant.price),
        stockQuantity: variant.stockQuantity,
        weightGram: variant.weightGram,
        dimensionsMm: {
          length: variant.lengthMm ?? 0,
          width: variant.widthMm ?? 0,
          height: variant.heightMm ?? 0,
        },
        shippingClass: variant.shippingClass,
      })),
      seo: { metaTitle: product.metaTitle, metaDescription: product.metaDescription },
      inStock,
      publishedAt: product.publishedAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  // ------------------------------------------------------------ queries

  private buildWhere(query: ProductQueryDto, publicOnly: boolean): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {};

    if (publicOnly) {
      where.status = "Published";
    } else if (query.status) {
      where.status = query.status;
    } else {
      where.status = { not: "Archived" };
    }

    if (query.category) where.category = { slug: query.category, ...(publicOnly ? { isActive: true } : {}) };
    if (query.stoneType) where.stoneType = { equals: query.stoneType, mode: "insensitive" };
    if (query.origin) where.origin = { contains: query.origin, mode: "insensitive" };
    if (query.stockModel) where.stockModel = query.stockModel;
    if (query.condition) where.condition = query.condition;
    if (query.featured !== undefined) where.featured = query.featured;

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }

    if (query.inStock) {
      where.OR = [
        { stockModel: "Unique" },
        { stockModel: "Quantity", stockQuantity: { gt: 0 } },
      ];
    }

    if (query.search) {
      const search = query.search.trim();
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { stoneType: { contains: search, mode: "insensitive" } },
            { origin: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    return where;
  }

  async listPublic(query: ProductQueryDto): Promise<Paginated<ReturnType<ProductsService["toApiProduct"]>>> {
    const where = this.buildWhere(query, true);
    const orderBy = sortMap[query.sort ?? "newest"] ?? sortMap.newest;

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({ where, orderBy, include: productInclude, ...skipTake(query.page, query.pageSize) }),
    ]);

    return paginated(products.map((product) => this.toApiProduct(product)), total, query.page, query.pageSize);
  }

  async listAdmin(query: ProductQueryDto) {
    const where = this.buildWhere(query, false);
    const orderBy = sortMap[query.sort ?? "newest"] ?? sortMap.newest;

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({ where, orderBy, include: productInclude, ...skipTake(query.page, query.pageSize) }),
    ]);

    return paginated(products.map((product) => this.toApiProduct(product)), total, query.page, query.pageSize);
  }

  async getPublicBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: { in: ["Published", "Reserved", "Sold"] }, category: { isActive: true } },
      include: productInclude,
    });
    if (!product) throw new NotFoundException("Product not found");
    return this.toApiProduct(product);
  }

  async getAdminById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: productInclude });
    if (!product) throw new NotFoundException("Product not found");
    return this.toApiProduct(product);
  }

  async related(slug: string, limit = 4) {
    const product = await this.prisma.product.findUnique({ where: { slug }, select: { id: true, categoryId: true } });
    if (!product) return [];
    const products = await this.prisma.product.findMany({
      where: { status: "Published", categoryId: product.categoryId, id: { not: product.id } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: productInclude,
    });
    return products.map((item) => this.toApiProduct(item));
  }

  async filters() {
    const [origins, stoneTypes] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { status: "Published" },
        distinct: ["origin"],
        select: { origin: true },
        orderBy: { origin: "asc" },
      }),
      this.prisma.product.findMany({
        where: { status: "Published" },
        distinct: ["stoneType"],
        select: { stoneType: true },
        orderBy: { stoneType: "asc" },
      }),
    ]);
    return {
      origins: origins.map((item) => item.origin),
      stoneTypes: stoneTypes.map((item) => item.stoneType),
    };
  }

  // ------------------------------------------------------------ mutations

  private async nextSku(categorySlug: string): Promise<string> {
    const prefix = `RV-${categorySlug.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase() || "GEN"}`;
    return this.prisma.$transaction(async (tx) => {
      const sequence = await tx.sequence.upsert({
        where: { key: `sku:${prefix}` },
        create: { key: `sku:${prefix}`, value: 1 },
        update: { value: { increment: 1 } },
      });
      return `${prefix}-${String(sequence.value).padStart(4, "0")}`;
    });
  }

  private normalizeStock<T extends { stockModel?: string; stockQuantity?: number | null }>(data: T): T {
    if (data.stockModel === "Unique") {
      return { ...data, stockQuantity: null };
    }
    if (data.stockModel === "Quantity") {
      return { ...data, stockQuantity: Math.max(0, Number(data.stockQuantity ?? 0)) };
    }
    return data;
  }

  async create(dto: CreateProductDto, context: AuditContext) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new BadRequestException("Category not found");

    const slug = dto.slug
      ? await uniqueSlug(slugify(dto.slug), (candidate) => this.prisma.product.findUnique({ where: { slug: candidate } }))
      : await uniqueSlug(slugify(dto.name), (candidate) => this.prisma.product.findUnique({ where: { slug: candidate } }));

    const sku = dto.sku?.trim() || (await this.nextSku(category.slug));
    const skuTaken = await this.prisma.product.findUnique({ where: { sku } });
    if (skuTaken) throw new BadRequestException(`SKU "${sku}" is already used`);

    const stockModel = dto.stockModel ?? "Unique";
    const status = dto.status ?? "Draft";

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        sku,
        categoryId: dto.categoryId,
        stoneType: dto.stoneType,
        origin: dto.origin,
        mohsHardness: dto.mohsHardness ?? null,
        condition: dto.condition ?? "Natural",
        price: new Prisma.Decimal(dto.price),
        compareAtPrice: dto.compareAtPrice === undefined || dto.compareAtPrice === null ? null : new Prisma.Decimal(dto.compareAtPrice),
        currency: dto.currency ?? "USD",
        unit: dto.unit ?? "piece",
        stockModel,
        stockQuantity: stockModel === "Unique" ? null : Math.max(0, dto.stockQuantity ?? 0),
        weightGram: dto.weightGram,
        weightCarat: dto.weightCarat ?? null,
        lengthMm: dto.lengthMm ?? null,
        widthMm: dto.widthMm ?? null,
        heightMm: dto.heightMm ?? null,
        status,
        tone: dto.tone ?? category.tone,
        shippingClass: dto.shippingClass ?? "Standard",
        shippingProfileId: dto.shippingProfileId ?? null,
        description: dto.description ?? "",
        featured: dto.featured ?? false,
        fragile: dto.fragile ?? false,
        metaTitle: dto.metaTitle ?? null,
        metaDescription: dto.metaDescription ?? null,
        publishedAt: status === "Published" ? new Date() : null,
        images: {
          create: (dto.images ?? []).map((image, index) => ({
            url: image.url,
            alt: image.alt ?? dto.name,
            focalX: image.focalX ?? null,
            focalY: image.focalY ?? null,
            sortOrder: image.sortOrder ?? index,
          })),
        },
        variants: {
          create: (dto.variants ?? []).map((variant, index) => ({
            sku: variant.sku,
            name: variant.name,
            price: new Prisma.Decimal(variant.price),
            stockQuantity: variant.stockQuantity,
            weightGram: variant.weightGram,
            lengthMm: variant.lengthMm ?? null,
            widthMm: variant.widthMm ?? null,
            heightMm: variant.heightMm ?? null,
            shippingClass: variant.shippingClass ?? "Standard",
            sortOrder: variant.sortOrder ?? index,
          })),
        },
      },
      include: productInclude,
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "product.create",
      entityType: "Product",
      entityId: product.id,
      summary: `Created product "${product.name}" (${product.sku})`,
      metadata: { status: product.status, price: Number(product.price) },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiProduct(product);
  }

  async update(id: string, dto: UpdateProductDto, context: AuditContext) {
    const existing = await this.prisma.product.findUnique({ where: { id }, include: productInclude });
    if (!existing) throw new NotFoundException("Product not found");

    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new BadRequestException("Category not found");
    }

    const slug = dto.slug && slugify(dto.slug) !== existing.slug
      ? await uniqueSlug(slugify(dto.slug), (candidate) => this.prisma.product.findUnique({ where: { slug: candidate } }))
      : undefined;

    if (dto.sku && dto.sku !== existing.sku) {
      const taken = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (taken) throw new BadRequestException(`SKU "${dto.sku}" is already used`);
    }

    const nextStatus = dto.status ?? existing.status;
    const priceChanged = dto.price !== undefined && Number(existing.price) !== Number(dto.price);
    const stockChanged = dto.stockQuantity !== undefined && existing.stockQuantity !== dto.stockQuantity;

    const product = await this.prisma.$transaction(async (tx) => {
      if (dto.images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
      }
      if (dto.variants) {
        const keepIds = dto.variants.map((variant) => variant.id).filter((value): value is string => Boolean(value));
        await tx.productVariant.deleteMany({ where: { productId: id, id: { notIn: keepIds.length ? keepIds : ["__none__"] } } });
      }

      return tx.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(slug ? { slug } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.stoneType !== undefined ? { stoneType: dto.stoneType } : {}),
          ...(dto.origin !== undefined ? { origin: dto.origin } : {}),
          ...(dto.mohsHardness !== undefined ? { mohsHardness: dto.mohsHardness } : {}),
          ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
          ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
          ...(dto.compareAtPrice !== undefined
            ? { compareAtPrice: dto.compareAtPrice === null ? null : new Prisma.Decimal(dto.compareAtPrice) }
            : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
          ...(dto.stockModel !== undefined ? { stockModel: dto.stockModel } : {}),
          ...(dto.stockModel === "Unique" ? { stockQuantity: null } : dto.stockQuantity !== undefined ? { stockQuantity: Math.max(0, dto.stockQuantity ?? 0) } : {}),
          ...(dto.weightGram !== undefined ? { weightGram: dto.weightGram } : {}),
          ...(dto.weightCarat !== undefined ? { weightCarat: dto.weightCarat } : {}),
          ...(dto.lengthMm !== undefined ? { lengthMm: dto.lengthMm } : {}),
          ...(dto.widthMm !== undefined ? { widthMm: dto.widthMm } : {}),
          ...(dto.heightMm !== undefined ? { heightMm: dto.heightMm } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.status !== undefined && dto.status === "Published" && !existing.publishedAt ? { publishedAt: new Date() } : {}),
          ...(dto.tone !== undefined ? { tone: dto.tone } : {}),
          ...(dto.shippingClass !== undefined ? { shippingClass: dto.shippingClass } : {}),
          ...(dto.shippingProfileId !== undefined ? { shippingProfileId: dto.shippingProfileId } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
          ...(dto.fragile !== undefined ? { fragile: dto.fragile } : {}),
          ...(dto.metaTitle !== undefined ? { metaTitle: dto.metaTitle } : {}),
          ...(dto.metaDescription !== undefined ? { metaDescription: dto.metaDescription } : {}),
          ...(dto.images
            ? {
                images: {
                  create: dto.images.map((image, index) => ({
                    url: image.url,
                    alt: image.alt ?? dto.name ?? existing.name,
                    focalX: image.focalX ?? null,
                    focalY: image.focalY ?? null,
                    sortOrder: image.sortOrder ?? index,
                  })),
                },
              }
            : {}),
          ...(dto.variants
            ? {
                variants: {
                  upsert: dto.variants.map((variant, index) => ({
                    where: { sku: variant.sku },
                    create: {
                      sku: variant.sku,
                      name: variant.name,
                      price: new Prisma.Decimal(variant.price),
                      stockQuantity: variant.stockQuantity,
                      weightGram: variant.weightGram,
                      lengthMm: variant.lengthMm ?? null,
                      widthMm: variant.widthMm ?? null,
                      heightMm: variant.heightMm ?? null,
                      shippingClass: variant.shippingClass ?? "Standard",
                      sortOrder: variant.sortOrder ?? index,
                    },
                    update: {
                      name: variant.name,
                      price: new Prisma.Decimal(variant.price),
                      stockQuantity: variant.stockQuantity,
                      weightGram: variant.weightGram,
                      lengthMm: variant.lengthMm ?? null,
                      widthMm: variant.widthMm ?? null,
                      heightMm: variant.heightMm ?? null,
                      shippingClass: variant.shippingClass ?? "Standard",
                      sortOrder: variant.sortOrder ?? index,
                    },
                  })),
                },
              }
            : {}),
        },
        include: productInclude,
      });
    });

    if (priceChanged) {
      await this.prisma.productPriceHistory.create({
        data: {
          productId: id,
          field: "price",
          oldValue: String(Number(existing.price)),
          newValue: String(dto.price),
          adminId: context.adminId ?? null,
        },
      });
    }
    if (stockChanged) {
      await this.prisma.productPriceHistory.create({
        data: {
          productId: id,
          field: "stockQuantity",
          oldValue: String(existing.stockQuantity ?? 0),
          newValue: String(dto.stockQuantity ?? 0),
          adminId: context.adminId ?? null,
        },
      });
    }

    if (nextStatus === "Sold" && existing.status !== "Sold") {
      await this.prisma.notification.create({
        data: {
          type: "Stock",
          title: `${product.name} marked as sold`,
          body: `Product ${product.sku} is now sold and hidden from the public catalog.`,
          href: `/admin/products/${product.id}`,
          entityType: "Product",
          entityId: product.id,
        },
      });
    }

    await this.audit.log({
      adminId: context.adminId,
      action: "product.update",
      entityType: "Product",
      entityId: product.id,
      summary: `Updated product "${product.name}" (${product.sku})`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiProduct(product);
  }

  async bulk(dto: BulkProductActionDto, context: AuditContext) {
    if (!dto.ids.length) throw new BadRequestException("No products selected");

    const where = { id: { in: dto.ids } };
    let affected = 0;

    switch (dto.action) {
      case "Publish": {
        const result = await this.prisma.product.updateMany({ where, data: { status: "Published", publishedAt: new Date() } });
        affected = result.count;
        break;
      }
      case "Unpublish": {
        const result = await this.prisma.product.updateMany({ where, data: { status: "Draft" } });
        affected = result.count;
        break;
      }
      case "Archive": {
        const result = await this.prisma.product.updateMany({ where, data: { status: "Archived" } });
        affected = result.count;
        break;
      }
      case "Restore": {
        const result = await this.prisma.product.updateMany({ where, data: { status: "Draft" } });
        affected = result.count;
        break;
      }
      case "Delete": {
        const result = await this.prisma.product.deleteMany({ where });
        affected = result.count;
        break;
      }
    }

    await this.audit.log({
      adminId: context.adminId,
      action: `product.bulk_${dto.action.toLowerCase()}`,
      entityType: "Product",
      summary: `Bulk ${dto.action} applied to ${affected} product(s)`,
      metadata: { ids: dto.ids },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { affected };
  }

  async duplicate(id: string, context: AuditContext) {
    const source = await this.prisma.product.findUnique({ where: { id }, include: productInclude });
    if (!source) throw new NotFoundException("Product not found");

    const slug = await uniqueSlug(slugify(`${source.name} copy`), (candidate) => this.prisma.product.findUnique({ where: { slug: candidate } }));
    const sku = await this.nextSku(source.category.slug);

    const copy = await this.prisma.product.create({
      data: {
        name: `${source.name} (Copy)`,
        slug,
        sku,
        categoryId: source.categoryId,
        stoneType: source.stoneType,
        origin: source.origin,
        mohsHardness: source.mohsHardness,
        condition: source.condition,
        price: source.price,
        compareAtPrice: source.compareAtPrice,
        currency: source.currency,
        unit: source.unit,
        stockModel: source.stockModel,
        stockQuantity: source.stockQuantity,
        weightGram: source.weightGram,
        weightCarat: source.weightCarat,
        lengthMm: source.lengthMm,
        widthMm: source.widthMm,
        heightMm: source.heightMm,
        status: "Draft",
        tone: source.tone,
        shippingClass: source.shippingClass,
        shippingProfileId: source.shippingProfileId,
        description: source.description,
        featured: false,
        fragile: source.fragile,
        metaTitle: source.metaTitle,
        metaDescription: source.metaDescription,
        images: { create: source.images.map((image, index) => ({ url: image.url, alt: image.alt, focalX: image.focalX, focalY: image.focalY, sortOrder: index })) },
      },
      include: productInclude,
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "product.duplicate",
      entityType: "Product",
      entityId: copy.id,
      summary: `Duplicated product "${source.name}" as "${copy.name}"`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiProduct(copy);
  }

  async priceHistory(id: string) {
    return this.prisma.productPriceHistory.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  // ------------------------------------------------------------ csv

  private readonly csvColumns = [
    "name",
    "slug",
    "sku",
    "categorySlug",
    "stoneType",
    "origin",
    "price",
    "currency",
    "unit",
    "stockModel",
    "stockQuantity",
    "weightGram",
    "weightCarat",
    "lengthMm",
    "widthMm",
    "heightMm",
    "condition",
    "status",
    "tone",
    "featured",
    "fragile",
    "description",
  ] as const;

  async exportCsv(query: ProductQueryDto): Promise<string> {
    const where = this.buildWhere(query, false);
    const products = await this.prisma.product.findMany({ where, orderBy: { createdAt: "desc" }, include: productInclude, take: 5000 });

    const escape = (value: unknown) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const rows = products.map((product) =>
      [
        product.name,
        product.slug,
        product.sku,
        product.category.slug,
        product.stoneType,
        product.origin,
        Number(product.price),
        product.currency,
        product.unit,
        product.stockModel,
        product.stockModel === "Unique" ? 1 : (product.stockQuantity ?? 0),
        product.weightGram,
        product.weightCarat ?? "",
        product.lengthMm ?? "",
        product.widthMm ?? "",
        product.heightMm ?? "",
        product.condition,
        product.status,
        product.tone,
        product.featured,
        product.fragile,
        product.description,
      ]
        .map(escape)
        .join(","),
    );

    return [this.csvColumns.join(","), ...rows].join("\n");
  }

  async importCsv(csv: string, context: AuditContext) {
    const lines = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) throw new BadRequestException("CSV must contain a header row and at least one product");

    const parseLine = (line: string): string[] => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (inQuotes) {
          if (char === '"' && line[index + 1] === '"') {
            current += '"';
            index += 1;
          } else if (char === '"') {
            inQuotes = false;
          } else {
            current += char;
          }
        } else if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          values.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current);
      return values;
    };

    const header = parseLine(lines[0]).map((column) => column.trim());
    const categories = await this.prisma.category.findMany();
    const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const line of lines.slice(1)) {
      const values = parseLine(line);
      const record: Record<string, string> = {};
      header.forEach((column, index) => {
        record[column] = values[index]?.trim() ?? "";
      });

      const category = categoryBySlug.get(record.categorySlug ?? "");
      if (!category) {
        results.skipped += 1;
        results.errors.push(`Row "${record.name}": unknown category "${record.categorySlug}"`);
        continue;
      }
      if (!record.name || !record.price) {
        results.skipped += 1;
        results.errors.push(`Row "${record.name || "(no name)"}": name and price are required`);
        continue;
      }

      try {
        const slug = await uniqueSlug(slugify(record.slug || record.name), (candidate) => this.prisma.product.findUnique({ where: { slug: candidate } }));
        const sku = record.sku && !(await this.prisma.product.findUnique({ where: { sku: record.sku } })) ? record.sku : await this.nextSku(category.slug);
        const stockModel = record.stockModel === "Quantity" ? "Quantity" : "Unique";
        const status: ProductStatus = (Object.values(ProductStatus) as string[]).includes(record.status)
          ? (record.status as ProductStatus)
          : ProductStatus.Draft;

        await this.prisma.product.create({
          data: {
            name: record.name,
            slug,
            sku,
            categoryId: category.id,
            stoneType: record.stoneType || "Unknown",
            origin: record.origin || "Indonesia",
            price: new Prisma.Decimal(Number(record.price) || 0),
            currency: record.currency || "USD",
            unit: (["piece", "pair", "gram", "carat", "strand", "bag"].includes(record.unit) ? record.unit : "piece") as "piece",
            stockModel,
            stockQuantity: stockModel === "Unique" ? null : Math.max(0, Number(record.stockQuantity) || 0),
            weightGram: Number(record.weightGram) || 0,
            weightCarat: record.weightCarat ? Number(record.weightCarat) : null,
            lengthMm: record.lengthMm ? Number(record.lengthMm) : null,
            widthMm: record.widthMm ? Number(record.widthMm) : null,
            heightMm: record.heightMm ? Number(record.heightMm) : null,
            condition: (["Natural", "Treated", "Dyed"].includes(record.condition) ? record.condition : "Natural") as "Natural",
            status,
            tone: category.tone,
            description: record.description ?? "",
            featured: record.featured === "true",
            fragile: record.fragile === "true",
            publishedAt: status === "Published" ? new Date() : null,
          },
        });
        results.created += 1;
      } catch (error) {
        results.skipped += 1;
        results.errors.push(`Row "${record.name}": ${(error as Error).message}`);
      }
    }

    await this.audit.log({
      adminId: context.adminId,
      action: "product.import_csv",
      entityType: "Product",
      summary: `Imported ${results.created} product(s) from CSV (${results.skipped} skipped)`,
      metadata: results,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return results;
  }
}
