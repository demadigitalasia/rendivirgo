import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { ContentCopyService } from "./content-copy.service";

@Module({
  imports: [SettingsModule],
  providers: [ContentCopyService],
  exports: [ContentCopyService],
})
export class ContentCopyModule {}
