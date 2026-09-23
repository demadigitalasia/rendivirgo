import { IsDateString, IsIn, IsOptional } from "class-validator";

export type ReportRange = "7d" | "30d" | "90d" | "12m";
export type ReportGranularity = "day" | "week" | "month";

export class ReportRangeQueryDto {
  @IsOptional()
  @IsIn(["7d", "30d", "90d", "12m"])
  range: ReportRange = "30d";
}

export class SalesReportQueryDto extends ReportRangeQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(["day", "week", "month"])
  groupBy?: ReportGranularity;
}
