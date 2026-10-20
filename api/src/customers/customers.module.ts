import { Module } from "@nestjs/common";
import { CustomerAccountController, CustomerAuthController } from "./customer-account.controller";
import { CustomerAuthService } from "./customer-auth.service";
import { CustomerGuard } from "./customer.guard";
import { AdminCustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  controllers: [AdminCustomersController, CustomerAuthController, CustomerAccountController],
  providers: [CustomersService, CustomerAuthService, CustomerGuard],
  exports: [CustomersService, CustomerAuthService, CustomerGuard],
})
export class CustomersModule {}
