import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

export class SaveRoughMaterialDto {
  @IsString() @MinLength(2) @MaxLength(80) @Matches(/^[A-Za-z0-9_-]+$/)
  sku: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(200)
  name: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(120)
  stoneType: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(200)
  origin: string;

  @IsString() @MaxLength(6000)
  description: string;

  @IsString() @MaxLength(1000)
  sizeNotes: string;

  @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(1500, { each: true })
  images: string[];

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(1000000)
  pricePerKg: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(1000000)
  availableKg?: number | null;

  @IsBoolean()
  isAvailable: boolean;

  @IsBoolean()
  isPublished: boolean;

  @IsInt() @Min(0) @Max(100000)
  sortOrder: number;
}

export class RoughQuoteLineDto {
  @IsString() @MinLength(1) @MaxLength(100)
  materialId: string;

  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(1000000)
  quantityKg: number;
}

export class RoughQuoteDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2) @ValidateNested({ each: true }) @Type(() => RoughQuoteLineDto)
  items: RoughQuoteLineDto[];

  @IsOptional() @IsString() @MaxLength(120)
  country?: string;

  @IsOptional() @IsString() @MaxLength(160)
  port?: string;
}
