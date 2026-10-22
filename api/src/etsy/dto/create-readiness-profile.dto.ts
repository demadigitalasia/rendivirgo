import { IsIn, IsInt, Max, Min } from "class-validator";

export class CreateReadinessProfileDto {
  @IsIn(["ready_to_ship", "made_to_order"])
  readinessState: "ready_to_ship" | "made_to_order";

  @IsInt()
  @Min(1)
  @Max(10)
  minProcessingTime: number;

  @IsInt()
  @Min(1)
  @Max(10)
  maxProcessingTime: number;

  @IsIn(["days", "weeks"])
  processingTimeUnit: "days" | "weeks" = "days";
}
