import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class WholesaleCatalogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([24, 48])
  pageSize = 24;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  stoneType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  origin?: string;

  @IsOptional()
  @IsIn(["featured", "newest", "name-asc", "name-desc", "price-asc", "price-desc"])
  sort: "featured" | "newest" | "name-asc" | "name-desc" | "price-asc" | "price-desc" = "featured";

  @IsOptional()
  @IsIn(["all", "in-stock", "out-of-stock"])
  availability: "all" | "in-stock" | "out-of-stock" = "all";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}
