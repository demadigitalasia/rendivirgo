import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EtsyIntegrationController } from "./etsy-integration.controller";
import { EtsyIntegrationService } from "./etsy-integration.service";

@Module({
  imports: [AuditModule],
  controllers: [EtsyIntegrationController],
  providers: [EtsyIntegrationService],
  exports: [EtsyIntegrationService],
})
export class EtsyIntegrationModule {}
