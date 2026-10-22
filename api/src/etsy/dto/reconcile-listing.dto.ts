import { IsString, Matches, MaxLength } from "class-validator";

export class ReconcileListingDto {
  @IsString()
  @Matches(/^[1-9]\d{0,19}$/)
  @MaxLength(20)
  listingId: string;
}
