import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  Equals,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { LapidaryMaterialSource, LapidaryRequestStatus, LapidaryServiceType } from "../../generated/prisma";
import { PaginationQueryDto } from "../common/dto/pagination.dto";

const lapidaryShapeKeys = ["oval", "round", "teardrop", "long-oval", "cushion", "freeform", "custom", "pear", "marquise", "half-oval", "rounded-triangle", "side-tongue", "ladder-trapezoid", "rhombus", "keystone", "tongue", "cartouche", "wide-shield", "bowed-rectangle", "barrel", "shield", "trillion", "bowed-triangle", "emerald-octagon", "split-oval", "split-marquise", "fan", "wing", "tapered-baton", "kite", "rounded-rectangle"];

export class LapidaryRequestItemDto {
  @IsOptional() @IsIn(["Studio", "Low", "Medium", "High"])
  domeProfile?: string;
  @IsOptional() @IsNumber() @Min(0.3) @Max(20)
  domeHeightMm?: number;

  @IsEnum(LapidaryServiceType)
  @IsIn([LapidaryServiceType.CabochonPendant, LapidaryServiceType.CabochonPair, LapidaryServiceType.Other], { message: "Choose an available lapidary service" })
  serviceType: LapidaryServiceType;

  @IsOptional() @IsString() @MaxLength(1000)
  workDescription?: string;

  @IsOptional() @IsString() @IsIn(lapidaryShapeKeys)
  shapeKey?: string;

  @IsOptional() @IsString() @MaxLength(120)
  desiredShape?: string;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(5000)
  lengthMm?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(5000)
  widthMm?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(5000)
  depthMm?: number | null;

  @Type(() => Number) @IsInt() @Min(1) @Max(500)
  quantity: number;

  @IsOptional() @IsString() @MaxLength(100)
  productId?: string;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(100000)
  materialQuantity?: number;

  @IsOptional() @IsArray() @ArrayMinSize(2) @ArrayMaxSize(2)
  @ValidateNested({ each: true }) @Type(() => LapidaryRequestComponentDto)
  components?: LapidaryRequestComponentDto[];
}

export class LapidaryRequestComponentDto {
  @IsIn(["Pendant", "MatchingPair"])
  key: "Pendant" | "MatchingPair";

  @IsOptional() @IsString() @IsIn(lapidaryShapeKeys)
  shapeKey?: string;

  @IsOptional() @IsString() @MaxLength(120)
  desiredShape?: string;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(5000)
  lengthMm?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(5000)
  widthMm?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(5000)
  depthMm?: number | null;
}

export class CreateLapidaryRequestDto {
  @IsString() @MinLength(2) @MaxLength(120)
  name: string;

  @IsEmail() @MaxLength(200)
  email: string;

  @IsString() @Matches(/^\+[1-9]\d{7,14}$/, { message: "Enter a valid international phone number including its country code" }) @MaxLength(16)
  phone: string;

  @IsString() @MinLength(2) @MaxLength(100)
  country: string;

  @IsOptional() @IsString() @MaxLength(160)
  company?: string;

  @IsOptional() @IsString() @MaxLength(160)
  materialOrigin?: string;

  @IsOptional() @IsString() @MaxLength(500)
  materialCondition?: string;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(10000000)
  materialWeightGram?: number;

  @IsEnum(LapidaryMaterialSource)
  materialSource: LapidaryMaterialSource;

  @IsOptional() @IsString() @MaxLength(2000)
  materialDescription?: string;

  @IsOptional() @IsIn(["HighGloss", "SatinMatte", "Natural", "NotSure", "Other"])
  finishPreference?: string;

  @IsOptional() @IsString() @MaxLength(8000)
  additionalDetails?: string;

  @IsArray() @ArrayMinSize(1, { message: "Add at least one lapidary work item" }) @ArrayMaxSize(8, { message: "Add no more than 8 work items" })
  @ValidateNested({ each: true }) @Type(() => LapidaryRequestItemDto)
  items: LapidaryRequestItemDto[];

  @IsOptional() @IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetDate?: string;

  @IsBoolean() @Equals(true)
  consent: boolean;

  @IsOptional() @IsArray() @ArrayMaxSize(5, { message: "Add no more than 5 reference links" })
  @IsUrl({ protocols: ["http", "https"], require_protocol: true }, { each: true }) @MaxLength(1000, { each: true })
  referenceImageUrls: string[] = [];

  // Honeypot: real visitors leave this hidden field empty.
  @IsOptional() @IsString() @MaxLength(200)
  website?: string;
}

export class LapidaryRequestQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(LapidaryRequestStatus)
  status?: LapidaryRequestStatus;
}

export class UpdateLapidaryRequestDto {
  @IsOptional() @IsBoolean()
  confirmMaterialReceived?: boolean;
  @IsOptional() @IsBoolean()
  reviseInvoice?: boolean;

  @IsOptional() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @IsString() @MinLength(5) @MaxLength(1000)
  invoiceRevisionReason?: string;

  @IsOptional() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @IsString() @MinLength(5) @MaxLength(1000)
  cancellationReason?: string;
  @IsOptional() @IsEnum(LapidaryRequestStatus)
  status?: LapidaryRequestStatus;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000)
  quoteAmount?: number | null;

  @IsOptional() @IsString() @MaxLength(3)
  @Matches(/^[A-Za-z]{3}$/)
  quoteCurrency?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650)
  estimatedDays?: number | null;

  @IsOptional() @IsString() @MaxLength(8000)
  adminNotes?: string | null;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000)
  serviceEstimateMin?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000)
  serviceEstimateMax?: number | null;

  @IsOptional() @IsString() @MaxLength(4000)
  materialShippingInstructions?: string | null;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000)
  invoiceServiceAmount?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000)
  invoiceReturnShippingAmount?: number | null;

  @IsOptional() @IsString() @MaxLength(3)
  @Matches(/^[A-Za-z]{3}$/)
  invoiceCurrency?: string;

  @IsOptional() @IsString() @MaxLength(120)
  returnCarrier?: string | null;

  @IsOptional() @IsString() @MaxLength(160)
  returnTrackingNumber?: string | null;

  @Transform(({ value }) => typeof value === "string" ? value.trim() || null : value)
  @IsOptional() @IsUrl({ protocols: ["http", "https"], require_protocol: true }) @MaxLength(1000)
  returnTrackingUrl?: string | null;
}

export class ConfirmLapidaryPaymentDto {
  @IsInt() @Min(1)
  revision: number;

  @IsDateString()
  proofUploadedAt: string;
}

export class ClaimLapidaryRequestDto {
  @IsString() @MinLength(32) @MaxLength(200)
  token: string;
}

export class AcceptLapidaryEstimateDto {
  @Equals(true, { message: "Confirm that you accept the estimated service price range before work begins" })
  accepted: boolean;
}

export class SubmitLapidaryInboundShipmentDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(120)
  carrier: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(160)
  trackingNumber: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() || null : value)
  @IsOptional() @IsUrl({ protocols: ["http", "https"], require_protocol: true }) @MaxLength(1000)
  trackingUrl?: string | null;
}

export class CreateLapidaryProgressUpdateDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(160)
  title: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(4000)
  body: string;

  @IsOptional() @Type(() => Boolean) @IsBoolean()
  isCustomerVisible?: boolean;
}

export class SaveLapidaryArtistDto {
  @IsOptional() @IsString() @MaxLength(160)
  slug?: string;

  @IsString() @MinLength(2) @MaxLength(120)
  name: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  role?: string;

  @IsOptional() @IsString() @MaxLength(120)
  roleId?: string;

  @IsOptional() @IsString() @MaxLength(120)
  signatureStyle?: string;

  @IsOptional() @IsString() @MaxLength(120)
  signatureStyleId?: string;

  @IsOptional() @IsString() @MaxLength(120)
  location?: string;

  @IsString() @MinLength(20) @MaxLength(5000)
  bio: string;

  @IsOptional() @IsString() @MaxLength(5000)
  bioId?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  experienceEn?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  experienceId?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(60, { each: true })
  specialties?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(60, { each: true })
  stoneExperienceEn?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(60, { each: true })
  stoneExperienceId?: string[];

  @IsOptional() @IsString() @MaxLength(1000)
  imageUrl?: string | null;

  @IsOptional() @IsString() @MaxLength(180)
  imageAltEn?: string;

  @IsOptional() @IsString() @MaxLength(180)
  imageAltId?: string;

  @IsOptional() @IsIn(["left", "center", "right"])
  imagePosition?: "left" | "center" | "right";

  @IsOptional() @IsArray() @ArrayMaxSize(12)
  @ValidateNested({ each: true }) @Type(() => SaveLapidaryArtistImageDto)
  portfolioImages?: SaveLapidaryArtistImageDto[];

  @IsBoolean()
  isPublished: boolean = false;

  @Type(() => Number) @IsInt() @Min(0) @Max(100000)
  sortOrder: number = 0;
}

export class SaveLapidaryArtistImageDto {
  @IsString() @MinLength(1) @MaxLength(1000)
  url: string;

  @IsString() @MinLength(2) @MaxLength(180)
  altEn: string;

  @IsString() @MinLength(2) @MaxLength(180)
  altId: string;

  @IsOptional() @IsString() @MaxLength(160)
  captionEn?: string;

  @IsOptional() @IsString() @MaxLength(160)
  captionId?: string;
}

export class SaveLapidaryArtistsPresentationDto {
  @IsString() @MinLength(2) @MaxLength(100)
  eyebrowEn: string;

  @IsString() @MinLength(2) @MaxLength(100)
  eyebrowId: string;

  @IsString() @MinLength(2) @MaxLength(160)
  titleEn: string;

  @IsString() @MinLength(2) @MaxLength(160)
  titleId: string;

  @IsString() @MinLength(2) @MaxLength(1200)
  introEn: string;

  @IsString() @MinLength(2) @MaxLength(1200)
  introId: string;

  @IsString() @MinLength(2) @MaxLength(160)
  capabilityTitleEn: string;

  @IsString() @MinLength(2) @MaxLength(160)
  capabilityTitleId: string;

  @IsString() @MinLength(2) @MaxLength(1200)
  capabilityBodyEn: string;

  @IsString() @MinLength(2) @MaxLength(1200)
  capabilityBodyId: string;

  @IsString() @MinLength(2) @MaxLength(160)
  emptyTitleEn: string;

  @IsString() @MinLength(2) @MaxLength(160)
  emptyTitleId: string;

  @IsString() @MinLength(2) @MaxLength(1200)
  emptyBodyEn: string;

  @IsString() @MinLength(2) @MaxLength(1200)
  emptyBodyId: string;

  @IsString() @MinLength(2) @MaxLength(100)
  ctaLabelEn: string;

  @IsString() @MinLength(2) @MaxLength(100)
  ctaLabelId: string;

  @IsOptional() @IsIn(["customOrder", "contact"])
  ctaTarget?: "customOrder" | "contact";

  @IsOptional() @IsIn(["customOrder", "contact"])
  detailCtaTarget?: "customOrder" | "contact";

  @IsString() @MaxLength(1000)
  heroImage: string;

  @IsString() @MaxLength(180)
  heroAltEn: string;

  @IsString() @MaxLength(180)
  heroAltId: string;

  @IsOptional() @IsIn(["left", "center", "right"])
  heroImagePosition?: "left" | "center" | "right";

  @IsString() @MinLength(2) @MaxLength(160)
  metaTitleEn: string;

  @IsString() @MinLength(2) @MaxLength(160)
  metaTitleId: string;

  @IsString() @MinLength(2) @MaxLength(320)
  metaDescriptionEn: string;

  @IsString() @MinLength(2) @MaxLength(320)
  metaDescriptionId: string;

  @IsOptional() @IsIn(["mineral", "forest", "quartz"])
  visualStyle?: "mineral" | "forest" | "quartz";

  @IsBoolean()
  motionEnabled: boolean;
}

export class SaveLapidaryStudioPhotoDto {
  @IsString() @MinLength(1) @MaxLength(1000)
  url: string;

  @IsString() @MinLength(2) @MaxLength(180)
  altEn: string;

  @IsString() @MinLength(2) @MaxLength(180)
  altId: string;

  @IsOptional() @IsString() @MaxLength(160)
  captionEn?: string;

  @IsOptional() @IsString() @MaxLength(160)
  captionId?: string;
}

export class SaveLapidaryStudioDto {
  @IsArray() @ArrayMinSize(11, { message: "Choose at least 11 studio photographs" }) @ArrayMaxSize(24, { message: "Choose no more than 24 studio photographs" })
  @ValidateNested({ each: true }) @Type(() => SaveLapidaryStudioPhotoDto)
  images: SaveLapidaryStudioPhotoDto[] = [];

  @IsString() @MinLength(1) @MaxLength(1000)
  heroImage: string;

  @IsOptional() @IsString() @MaxLength(160)
  titleEn?: string;

  @IsOptional() @IsString() @MaxLength(160)
  titleId?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  introEn?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  introId?: string;

  @IsOptional() @IsString() @MaxLength(160)
  galleryTitleEn?: string;

  @IsOptional() @IsString() @MaxLength(160)
  galleryTitleId?: string;

  @IsOptional() @IsString() @MaxLength(100)
  eyebrowEn?: string;

  @IsOptional() @IsString() @MaxLength(100)
  eyebrowId?: string;

  @IsOptional() @IsString() @MaxLength(100)
  galleryEyebrowEn?: string;

  @IsOptional() @IsString() @MaxLength(100)
  galleryEyebrowId?: string;

  @IsOptional() @IsString() @MaxLength(160)
  ctaLabelEn?: string;

  @IsOptional() @IsString() @MaxLength(160)
  ctaLabelId?: string;

  @IsOptional() @IsString() @MaxLength(160)
  approachTitleEn?: string;

  @IsOptional() @IsString() @MaxLength(160)
  approachTitleId?: string;

  @IsOptional() @IsString() @MaxLength(100)
  approachEyebrowEn?: string;

  @IsOptional() @IsString() @MaxLength(100)
  approachEyebrowId?: string;

  @IsOptional() @IsString() @MaxLength(100)
  photoCountLabelEn?: string;

  @IsOptional() @IsString() @MaxLength(100)
  photoCountLabelId?: string;

  @IsOptional() @IsString() @MaxLength(100)
  backLabelEn?: string;

  @IsOptional() @IsString() @MaxLength(100)
  backLabelId?: string;

  @IsOptional() @IsIn(["customOrder", "contact"])
  ctaTarget?: "customOrder" | "contact";

  @IsOptional() @IsIn(["left", "center", "right"])
  heroImagePosition?: "left" | "center" | "right";

  @IsOptional() @IsString() @MaxLength(160)
  metaTitleEn?: string;

  @IsOptional() @IsString() @MaxLength(160)
  metaTitleId?: string;

  @IsOptional() @IsString() @MaxLength(320)
  metaDescriptionEn?: string;

  @IsOptional() @IsString() @MaxLength(320)
  metaDescriptionId?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(240, { each: true })
  approachPointsEn?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(240, { each: true })
  approachPointsId?: string[];

  @IsOptional() @IsIn(["mineral", "forest", "quartz"])
  visualStyle?: "mineral" | "forest" | "quartz";

  @IsOptional() @IsBoolean()
  motionEnabled?: boolean;
}

export class SaveLapidaryProcessStepDto {
  @IsString() @MinLength(2) @MaxLength(120)
  titleEn: string;

  @IsString() @MinLength(2) @MaxLength(120)
  titleId: string;

  @IsString() @MinLength(2) @MaxLength(700)
  bodyEn: string;

  @IsString() @MinLength(2) @MaxLength(700)
  bodyId: string;
}

export class SaveLapidaryProcessPhaseDto {
  @IsString() @MinLength(2) @MaxLength(120)
  titleEn: string;

  @IsString() @MinLength(2) @MaxLength(120)
  titleId: string;

  @IsString() @MinLength(2) @MaxLength(500)
  introEn: string;

  @IsString() @MinLength(2) @MaxLength(500)
  introId: string;

  @IsArray() @ArrayMinSize(5) @ArrayMaxSize(5)
  @ValidateNested({ each: true }) @Type(() => SaveLapidaryProcessStepDto)
  steps: SaveLapidaryProcessStepDto[];
}

export class SaveLapidaryProcessDto {
  @IsString() @MinLength(2) @MaxLength(100)
  eyebrowEn: string;

  @IsString() @MinLength(2) @MaxLength(100)
  eyebrowId: string;

  @IsString() @MinLength(2) @MaxLength(160)
  titleEn: string;

  @IsString() @MinLength(2) @MaxLength(160)
  titleId: string;

  @IsString() @MinLength(2) @MaxLength(1200)
  introEn: string;

  @IsString() @MinLength(2) @MaxLength(1200)
  introId: string;

  @IsString() @MinLength(2) @MaxLength(80)
  phaseLabelEn: string;

  @IsString() @MinLength(2) @MaxLength(80)
  phaseLabelId: string;

  @IsString() @MinLength(2) @MaxLength(100)
  stepCountLabelEn: string;

  @IsString() @MinLength(2) @MaxLength(100)
  stepCountLabelId: string;

  @IsString() @MinLength(2) @MaxLength(80)
  expandDetailsLabelEn: string;

  @IsString() @MinLength(2) @MaxLength(80)
  expandDetailsLabelId: string;

  @IsString() @MinLength(2) @MaxLength(80)
  collapseDetailsLabelEn: string;

  @IsString() @MinLength(2) @MaxLength(80)
  collapseDetailsLabelId: string;

  @IsString() @MinLength(1) @MaxLength(1000)
  heroImage: string;

  @IsString() @MinLength(2) @MaxLength(180)
  heroAltEn: string;

  @IsString() @MinLength(2) @MaxLength(180)
  heroAltId: string;

  @IsIn(["left", "center", "right"])
  heroImagePosition: "left" | "center" | "right";

  @IsArray() @ArrayMinSize(3) @ArrayMaxSize(3)
  @ValidateNested({ each: true }) @Type(() => SaveLapidaryProcessPhaseDto)
  phases: SaveLapidaryProcessPhaseDto[];

  @IsString() @MinLength(2) @MaxLength(100)
  noteEyebrowEn: string;

  @IsString() @MinLength(2) @MaxLength(100)
  noteEyebrowId: string;

  @IsString() @MinLength(2) @MaxLength(160)
  noteTitleEn: string;

  @IsString() @MinLength(2) @MaxLength(160)
  noteTitleId: string;

  @IsString() @MinLength(2) @MaxLength(1200)
  noteBodyEn: string;

  @IsString() @MinLength(2) @MaxLength(1200)
  noteBodyId: string;

  @IsString() @MinLength(2) @MaxLength(160)
  ctaLabelEn: string;

  @IsString() @MinLength(2) @MaxLength(160)
  ctaLabelId: string;

  @IsIn(["customOrder", "contact"])
  ctaTarget: "customOrder" | "contact";

  @IsString() @MinLength(2) @MaxLength(100)
  backLabelEn: string;

  @IsString() @MinLength(2) @MaxLength(100)
  backLabelId: string;

  @IsString() @MinLength(2) @MaxLength(160)
  contactPromptEn: string;

  @IsString() @MinLength(2) @MaxLength(160)
  contactPromptId: string;

  @IsString() @MinLength(2) @MaxLength(160)
  contactLabelEn: string;

  @IsString() @MinLength(2) @MaxLength(160)
  contactLabelId: string;

  @IsString() @MinLength(2) @MaxLength(160)
  metaTitleEn: string;

  @IsString() @MinLength(2) @MaxLength(160)
  metaTitleId: string;

  @IsString() @MinLength(2) @MaxLength(320)
  metaDescriptionEn: string;

  @IsString() @MinLength(2) @MaxLength(320)
  metaDescriptionId: string;

  @IsIn(["mineral", "forest", "quartz"])
  visualStyle: "mineral" | "forest" | "quartz";

  @IsIn(["timeline", "cards"])
  layout: "timeline" | "cards";

  @IsBoolean()
  motionEnabled: boolean;
}

export class SaveLapidaryDomeDto {
  @IsBoolean() enabled: boolean;
  @IsNumber() @Min(0.3) @Max(10) minHeight: number;
  @IsNumber() @Min(0.5) @Max(20) maxHeight: number;
  @IsNumber() @Min(0.3) @Max(10) defaultHeight: number;
  @IsNumber() @Min(0.1) @Max(0.8) maxWidthRatio: number;
  @IsString() @MaxLength(200) labelEn: string;
  @IsString() @MaxLength(200) labelId: string;
}

export class SaveLapidaryServicePricingDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000)
  pendantUsd: number;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000)
  matchedPairUsd: number;
}
