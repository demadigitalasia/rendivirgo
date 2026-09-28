import { Type } from "class-transformer";
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { ReviewStatus } from "../../../generated/prisma";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

export class CreateReviewDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsEmail()
  @MaxLength(200)
  email: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(4000)
  body: string;
}

export class ReviewQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class UpdateReviewStatusDto {
  @IsEnum(ReviewStatus)
  status: ReviewStatus;
}
