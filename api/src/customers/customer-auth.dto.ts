import { IsBoolean, IsEmail, IsIn, IsUrl, Matches, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CustomerRegisterDto {
  @IsOptional()
  @IsString()
  @Matches(/^\/(?:wholesale\/(?:finished|checkout)|id\/wholesale\/(?:finished|checkout)|account\/lapidary(?:\?claim=[A-Za-z0-9_-]{43})?)$/)
  next?: string;

  @IsEmail()
  @MaxLength(200)
  email: string;
}

export class CustomerLoginDto {
  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password: string;
}

export class CustomerEmailTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(300)
  token: string;
}

export class CustomerVerifyEmailDto extends CustomerEmailTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  password: string;
}

export class CustomerForgotPasswordDto {
  @IsEmail()
  @MaxLength(200)
  email: string;
}

export class CustomerResetPasswordDto extends CustomerEmailTokenDto {
  @IsString()
  @MinLength(12)
  @MaxLength(200)
  newPassword: string;
}

export class ChangeCustomerPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  currentPassword: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  newPassword: string;
}

export class UpdateCustomerProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  addressLine1?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  addressLine2?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  postalCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string | null;

  @IsOptional()
  @IsBoolean()
  acceptsMarketing?: boolean;
}

export class WholesaleRequestDto {
  @IsString() @MinLength(2) @MaxLength(200) @Matches(/\S/)
  businessName: string;

  @IsIn(["Retailer", "Jewelry maker", "Stone dealer", "Designer", "Other"])
  buyerType: string;

  @IsString() @MinLength(2) @MaxLength(120) @Matches(/\S/)
  country: string;

  @IsOptional() @IsUrl({ protocols: ["http", "https"], require_protocol: true }) @MaxLength(500)
  website?: string;

  @IsString() @MinLength(10) @MaxLength(2000) @Matches(/\S/)
  needs: string;
}
