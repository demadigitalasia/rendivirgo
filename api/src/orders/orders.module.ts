import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { AdminOrdersController, OrdersController } from "./orders.controller";
import { OrderLifecycleService } from "./order-lifecycle.service";
import { OrderReturnRequestsService } from "./order-return-requests.service";
import { OrdersService } from "./orders.service";

@Module({
  imports: [SettingsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrderLifecycleService, OrderReturnRequestsService],
  exports: [OrdersService, OrderLifecycleService],
})
export class OrdersModule {}
