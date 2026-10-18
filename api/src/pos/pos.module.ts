import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PosController } from "./pos.controller";
import { PosService } from "./pos.service";

@Module({
  imports: [AuditModule],
  controllers: [PosController],
  providers: [PosService],
})
export class PosModule {}
