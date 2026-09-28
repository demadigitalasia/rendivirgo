import { Type } from "class-transformer";
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreatePayPalOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  orderId: string;
}

export class CapturePayPalOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  paypalOrderId: string;
}

export class ReleaseExpiredDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit: number;
}
