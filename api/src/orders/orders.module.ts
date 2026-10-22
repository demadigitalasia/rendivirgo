import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { EtsyIntegrationModule } from "../etsy/etsy-integration.module";
import { SettingsModule } from "../settings/settings.module";
import { AdminOrdersController, AdminWholesaleController, OrdersController, WholesaleController } from "./orders.controller";
import { OrderLifecycleService } from "./order-lifecycle.service";
import { OrderReturnRequestsService } from "./order-return-requests.service";
import { OrdersService } from "./orders.service";

@Module({
  imports: [SettingsModule, CustomersModule, EtsyIntegrationModule],
  controllers: [OrdersController, AdminOrdersController, WholesaleController, AdminWholesaleController],
  providers: [OrdersService, OrderLifecycleService, OrderReturnRequestsService],
  exports: [OrdersService, OrderLifecycleService],
})
export class OrdersModule {}
