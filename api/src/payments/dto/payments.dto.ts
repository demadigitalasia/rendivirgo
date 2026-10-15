import { Type } from "class-transformer";
import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

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

export class ResumeCheckoutDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  orderId?: string;

  @IsOptional()
  @IsUUID("4")
  checkoutKey?: string;

  @IsEmail()
  @MaxLength(200)
  email: string;
}

export class SubmitBankTransferProofDto {
  @IsEmail()
  @MaxLength(200)
  email: string;
}

export class ReleaseExpiredDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit: number;
}
