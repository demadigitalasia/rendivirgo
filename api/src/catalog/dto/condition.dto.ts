import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { TranslationStatus } from "../../../generated/prisma";

export class CreateConditionDto {
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  note?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  noteId?: string | null;

  @IsOptional()
  @IsEnum(TranslationStatus)
  idTranslationStatus?: TranslationStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateConditionDto extends CreateConditionDto {
  @IsOptional()
  declare name: string;
}
