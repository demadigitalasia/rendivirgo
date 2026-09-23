import { Transform, Type } from "class-transformer";
import { PartialType } from "@nestjs/mapped-types";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { DiscountType } from "../../../generated/prisma";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === true || value === "true" || value === "1" || value === 1) return true;
  if (value === false || value === "false" || value === "0" || value === 0) return false;
  return value;
};

export class DiscountItemDto {
  @IsString()
  @MinLength(1)
  productId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lineTotal: number;
}

export class ValidateDiscountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  code: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DiscountItemDto)
  items?: DiscountItemDto[];
}

export class CreateDiscountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string | null;

  @IsEnum(DiscountType)
  type: DiscountType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSubtotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUses?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perCustomerLimit?: number | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string | null;
}

export class UpdateDiscountDto extends PartialType(CreateDiscountDto) {}

export class DiscountQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}
