import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

export class PosSettingsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  @Max(100_000_000)
  exchangeRate: number;
}

export class PosSaleItemDto {
  @IsString()
  @MinLength(1)
  productId: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedUnitPriceIdr: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9_999_999_999)
  unitPriceIdr?: number;
}

export class CreatePosSaleDto {
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  requestId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  @Max(100_000_000)
  exchangeRate: number;

  @IsOptional()
  @IsString()
  customerId?: string | null;

  @IsIn(["Cash", "BankTransfer", "QRIS"])
  paymentMethod: "Cash" | "BankTransfer" | "QRIS";

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentRef?: string;

  @IsOptional()
  @IsIn(["Percentage", "Fixed"])
  manualDiscountType?: "Percentage" | "Fixed";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  manualDiscountValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  discountReason?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemDto)
  items: PosSaleItemDto[];
}
