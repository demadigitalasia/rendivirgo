import { PartialType } from "@nestjs/mapped-types";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { BannerPlacement, ContentStatus } from "../../../generated/prisma";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

const optionalBoolean = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    const normalized = String(value).toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
    return value;
  });

// ---------------------------------------------------------------- blog

export class BlogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;
}

export class CreateBlogPostDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  coverImage?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  author?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  readMinutes?: number;

  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  metaDescription?: string | null;
}

export class UpdateBlogPostDto extends PartialType(CreateBlogPostDto) {}

// ---------------------------------------------------------------- pages

export class PageQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

export class CreatePageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120000)
  body?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsBoolean()
  showInFooter?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  metaDescription?: string | null;
}

export class UpdatePageDto extends PartialType(CreatePageDto) {}

// ---------------------------------------------------------------- testimonials

export class TestimonialQueryDto extends PaginationQueryDto {
  @IsOptional()
  @optionalBoolean()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  productId?: string;
}

export class CreateTestimonialDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  customerName: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string | null;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  quote: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  productId?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateTestimonialDto extends PartialType(CreateTestimonialDto) {}

// ---------------------------------------------------------------- banners

export class PublicBannerQueryDto {
  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;
}

export class BannerQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;

  @IsOptional()
  @optionalBoolean()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBannerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ctaLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  ctaHref?: string | null;

  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  focalX?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  focalY?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}
