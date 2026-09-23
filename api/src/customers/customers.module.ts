import { Module } from "@nestjs/common";
import { AdminCustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  controllers: [AdminCustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
