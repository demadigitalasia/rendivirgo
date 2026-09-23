import { Transform, Type } from "class-transformer";
import { PartialType } from "@nestjs/mapped-types";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ProductStatus, ProductTone, ProductUnit, ShippingClass, StockModel, StoneCondition } from "../../../generated/prisma";

export class ProductImageDto {
  @IsString()
  @MaxLength(1000)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  alt?: string;

  @IsOptional()
  @IsNumber()
  focalX?: number;

  @IsOptional()
  @IsNumber()
  focalY?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class ProductVariantDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  sku: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsInt()
  @Min(0)
  stockQuantity: number;

  @IsInt()
  @Min(0)
  weightGram: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lengthMm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  widthMm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  heightMm?: number;

  @IsOptional()
  @IsEnum(ShippingClass)
  shippingClass?: ShippingClass;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsString()
  categoryId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  stoneType: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  origin: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  mohsHardness?: number;

  @IsOptional()
  @IsEnum(StoneCondition)
  condition?: StoneCondition;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsEnum(ProductUnit)
  unit?: ProductUnit;

  @IsOptional()
  @IsEnum(StockModel)
  stockModel?: StockModel;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number | null;

  @IsInt()
  @Min(0)
  weightGram: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightCarat?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  lengthMm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  widthMm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  heightMm?: number | null;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsEnum(ProductTone)
  tone?: ProductTone;

  @IsOptional()
  @IsEnum(ShippingClass)
  shippingClass?: ShippingClass;

  @IsOptional()
  @IsString()
  shippingProfileId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  fragile?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  metaDescription?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class BulkProductActionDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsIn(["Publish", "Unpublish", "Archive", "Restore", "Delete"])
  action: "Publish" | "Unpublish" | "Archive" | "Restore" | "Delete";
}

export class ProductQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 12;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  stoneType?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsEnum(StockModel)
  stockModel?: StockModel;

  @IsOptional()
  @IsEnum(StoneCondition)
  condition?: StoneCondition;

  @IsOptional()
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsEnum(["newest", "oldest", "price-asc", "price-desc", "name", "weight-desc"])
  sort?: "newest" | "oldest" | "price-asc" | "price-desc" | "name" | "weight-desc";
}
