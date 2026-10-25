import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDefined, IsIn, IsInt, IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class HeroCopyDto {
  @IsString() @MaxLength(40) label: string;
  @IsString() @MaxLength(100) eyebrow: string;
  @IsString() @MaxLength(160) title: string;
  @IsString() @MaxLength(320) description: string;
  @IsString() @MaxLength(80) ctaLabel: string;
  @IsString() @MaxLength(80) secondaryLabel: string;
  @IsString() @MaxLength(250) alt: string;
  @IsString() @MaxLength(100) cardTitle: string;
  @IsString() @MaxLength(160) cardDetail: string;
}

export class HeroSlideDto {
  @IsString() @IsNotEmpty() @MaxLength(100) id: string;
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsBoolean() isActive: boolean;
  @IsIn(["Missing", "Draft", "Review", "Ready"]) translationStatus: "Missing" | "Draft" | "Review" | "Ready";
  @IsDefined() @ValidateNested() @Type(() => HeroCopyDto) en: HeroCopyDto;
  @IsDefined() @ValidateNested() @Type(() => HeroCopyDto) idCopy: HeroCopyDto;
  @IsString() @MaxLength(1000) imageUrl: string;
  @IsString() @MaxLength(1000) mobileImageUrl: string;
  @IsNumber() @Min(0) @Max(1) focalX: number;
  @IsNumber() @Min(0) @Max(1) focalY: number;
  @IsNumber() @Min(0) @Max(1) mobileFocalX: number;
  @IsNumber() @Min(0) @Max(1) mobileFocalY: number;
  @IsNumber() @Min(0.25) @Max(0.85) overlay: number;
  @IsIn(["left", "center", "right"]) alignment: "left" | "center" | "right";
  @IsString() @MaxLength(1000) ctaHref: string;
  @IsString() @MaxLength(1000) secondaryHref: string;
  @IsIn(["none", "product", "info"]) cardType: "none" | "product" | "info";
  @IsString() @MaxLength(100) productId: string;
  @IsString() @MaxLength(1000) cardHref: string;
}

export class HeroSettingsDto {
  @IsBoolean() autoplay: boolean;
  @IsInt() @Min(6) @Max(12) duration: number;
  @IsInt() @Min(300) @Max(1200) transitionMs: number;
  @IsIn(["fade-up", "fade", "none"]) textAnimation: "fade-up" | "fade" | "none";
  @IsBoolean() imageMotion: boolean;
}

export class SaveHeroSlidesDto {
  @IsString() @IsNotEmpty() version: string;
  @IsDefined() @ValidateNested() @Type(() => HeroSettingsDto) settings: HeroSettingsDto;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => HeroSlideDto) slides: HeroSlideDto[];
}
