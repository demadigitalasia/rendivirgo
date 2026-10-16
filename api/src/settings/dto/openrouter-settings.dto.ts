import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpdateOpenRouterSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{1,159}$/)
  model?: string;
}
