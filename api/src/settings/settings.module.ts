import { Module } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { AdminSettingsController, SettingsController } from "./settings.controller";
import { ShippingService } from "./shipping.service";
import {
  AdminShippingProfilesController,
  AdminShippingRatesController,
  ShippingController,
} from "./shipping.controller";

@Module({
  controllers: [
    SettingsController,
    AdminSettingsController,
    ShippingController,
    AdminShippingRatesController,
    AdminShippingProfilesController,
  ],
  providers: [SettingsService, ShippingService],
  exports: [SettingsService, ShippingService],
})
export class SettingsModule {}
