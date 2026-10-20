import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CustomerRegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  password: string;
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
