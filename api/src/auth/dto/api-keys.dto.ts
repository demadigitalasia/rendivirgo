import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { API_KEY_ALL_SCOPE, API_KEY_SCOPE_DOMAINS } from "../api-key-scopes";

const ALLOWED_SCOPES = [API_KEY_ALL_SCOPE, ...API_KEY_SCOPE_DOMAINS.flatMap((domain) => [`${domain}:read`, `${domain}:write`])];

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsIn(ALLOWED_SCOPES, { each: true })
  scopes: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  expiresInDays?: number;
}
