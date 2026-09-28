import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { AdminOrdersController, OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [SettingsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
