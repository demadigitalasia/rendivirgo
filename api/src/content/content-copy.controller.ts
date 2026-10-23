import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { ContentCopyService, type CopyKind } from "./content-copy.service";

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
  generate(@Body() input: GenerateContentCopyDto) { return this.copy.generate(input); }
}
