import { Global, Module } from "@nestjs/common";
import { AuditLogsController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Global()
@Module({
  controllers: [AuditLogsController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
