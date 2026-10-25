import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ContentCopyModule } from "../content/content-copy.module";
import { GoogleSearchConsoleController } from "./google-search-console.controller";
import { GoogleSearchConsoleService } from "./google-search-console.service";

@Module({
  imports: [AuditModule, ContentCopyModule],
  controllers: [GoogleSearchConsoleController],
  providers: [GoogleSearchConsoleService],
  exports: [GoogleSearchConsoleService],
})
export class GoogleSearchConsoleModule {}
