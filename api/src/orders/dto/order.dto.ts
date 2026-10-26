import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { OrderSource, OrderStatus, PaymentMethod, PaymentStatus } from "../../../generated/prisma";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

export class ShippingAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  line1: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  line2?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  postalCode?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  country: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string;
}

export class OrderItemInputDto {
  @IsString()
  @MinLength(1)
  productId: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  variantId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsUUID("4")
  checkoutKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  quoteToken?: string;

  @IsOptional()
  @IsIn(["PayPal", "BankTransfer"])
  paymentMethod?: PaymentMethod;

  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  customerName: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  customerNote?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];

  @IsOptional()
  @IsString()
  shippingRateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  discountCode?: string;

  @IsOptional() @IsString() @MaxLength(120)
  utmSource?: string;

  @IsOptional() @IsString() @MaxLength(120)
  utmMedium?: string;

  @IsOptional() @IsString() @MaxLength(160)
  utmCampaign?: string;

  @IsOptional() @IsString() @MaxLength(200)
  utmContent?: string;

  @IsOptional() @IsString() @MaxLength(200)
  utmTerm?: string;

  @IsOptional() @IsString() @MaxLength(500)
  landingPath?: string;
}

export class CreateReturnRequestDto {
  @IsString()
  @MinLength(4)
  @MaxLength(40)
  orderNumber: string;

  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsIn(["Damaged", "NotAsDescribed", "Other"])
  reason: string;

  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  details: string;
}

export class ReviewReturnRequestDto {
  @IsIn(["Approved", "Rejected"])
  status: "Approved" | "Rejected";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminResponse?: string;
}

export class OrderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderSource)
  source?: OrderSource;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsIn(["true"])
  proofQueue?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  carrier?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNote?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  customerNote?: string | null;
}

export class UpdateFulfillmentDto {
  @IsIn(["Processing", "Packed", "Shipped", "Completed"])
  status: "Processing" | "Packed" | "Shipped" | "Completed";
}

export class CreateOrderEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  type?: string;
}

export class RefundOrderDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalReference?: string;
}
