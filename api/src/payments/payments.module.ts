import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { SettingsModule } from "../settings/settings.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PayPalService } from "./paypal.service";

@Module({
  imports: [OrdersModule, SettingsModule],
  controllers: [PaymentsController],
  providers: [PayPalService, PaymentsService],
  exports: [PaymentsService, PayPalService],
})
export class PaymentsModule {}
