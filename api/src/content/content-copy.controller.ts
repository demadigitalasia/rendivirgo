import { Body, Controller, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { ContentCopyService, type CopyKind } from "./content-copy.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";

export class GenerateContentCopyDto {
  @IsIn(["seo", "page", "home", "banner", "product", "category", "blog"])
  kind: CopyKind;

  @IsString()
  @MaxLength(24000)
  context: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  brief?: string;
}

@Controller("admin/content")
export class ContentCopyController {
  constructor(private readonly copy: ContentCopyService) {}

  @Post("generate-copy")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  generate(@Body() input: GenerateContentCopyDto, @Req() request: AuthenticatedRequest) {
    return this.copy.generate(input, auditContextFrom(request));
  }
}
