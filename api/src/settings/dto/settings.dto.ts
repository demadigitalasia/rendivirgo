import { PartialType } from "@nestjs/mapped-types";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { CalculationMethod, ShippingClass } from "../../../generated/prisma";

const optionalBoolean = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    const normalized = String(value).toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
    return value;
  });

// ---------------------------------------------------------------- quote

export class ShippingQuoteDto {
  @IsInt()
  @Min(1)
  weightGram: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  countryCode?: string;

  @IsOptional()
  @IsIn(["Standard", "Fragile", "Oversized"])
  shippingClass?: "Standard" | "Fragile" | "Oversized";
}

// ---------------------------------------------------------------- rates

export class ShippingRateQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @optionalBoolean()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateShippingRateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  carrier?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minWeightGram?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxWeightGram?: number | null;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  handlingFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  insuranceFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fragileFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  oversizedFee?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateShippingRateDto extends PartialType(CreateShippingRateDto) {}

// ---------------------------------------------------------------- profiles

export class CreateShippingProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @IsInt()
  @Min(0)
  packageWeightGram: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  packageLengthMm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  packageWidthMm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  packageHeightMm?: number | null;

  @IsOptional()
  @IsEnum(ShippingClass)
  shippingClass?: ShippingClass;

  @IsOptional()
  @IsEnum(CalculationMethod)
  calculationMethod?: CalculationMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  packageModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  handlingFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  insuranceFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fragileFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  oversizedFee?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateShippingProfileDto extends PartialType(CreateShippingProfileDto) {}
