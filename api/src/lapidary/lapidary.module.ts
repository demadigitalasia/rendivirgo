import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { CustomersModule } from "../customers/customers.module";
import {
  AdminLapidaryContentController,
  AdminLapidaryRequestsController,
  CustomerLapidaryController,
  LapidaryPublicController,
} from "./lapidary.controller";
import { LapidaryService } from "./lapidary.service";
import { LapidaryEmailOutboxService } from "./lapidary-email-outbox.service";

@Module({
  imports: [SettingsModule, CustomersModule],
  controllers: [LapidaryPublicController, AdminLapidaryRequestsController, CustomerLapidaryController, AdminLapidaryContentController],
  providers: [LapidaryService, LapidaryEmailOutboxService],
})
export class LapidaryModule {}
