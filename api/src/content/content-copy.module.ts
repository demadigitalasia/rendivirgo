import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { ContentCopyService } from "./content-copy.service";
import { AiUsageBudgetService } from "./ai-usage-budget.service";

@Module({
  imports: [SettingsModule],
  providers: [AiUsageBudgetService, ContentCopyService],
  exports: [ContentCopyService],
})
export class ContentCopyModule {}
