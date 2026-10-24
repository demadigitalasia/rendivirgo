import { Module } from "@nestjs/common";
import { CustomerAccountController, CustomerAuthController } from "./customer-account.controller";
import { CustomerAuthService } from "./customer-auth.service";
import { CustomerGuard } from "./customer.guard";
import { AdminCustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

import { WholesaleApplicationsService } from "./wholesale-applications.service";

@Module({
  controllers: [AdminCustomersController, CustomerAuthController, CustomerAccountController],
  providers: [WholesaleApplicationsService, CustomersService, CustomerAuthService, CustomerGuard],
  exports: [CustomersService, CustomerAuthService, CustomerGuard],
})
export class CustomersModule {}
