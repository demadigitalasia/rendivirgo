import { Module } from "@nestjs/common";
import { CustomerAccountController, CustomerAuthController } from "./customer-account.controller";
import { CustomerAuthService } from "./customer-auth.service";
import { CustomerAvatarService } from "./customer-avatar.service";
import { CustomerGuard } from "./customer.guard";
import { AdminCustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

import { WholesaleApplicationsService } from "./wholesale-applications.service";

@Module({
  controllers: [AdminCustomersController, CustomerAuthController, CustomerAccountController],
  providers: [WholesaleApplicationsService, CustomersService, CustomerAuthService, CustomerAvatarService, CustomerGuard],
  exports: [CustomersService, CustomerAuthService, CustomerGuard],
})
export class CustomersModule {}
