import { Module } from "@nestjs/common";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";
import { AdminGuard } from "./admin.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  controllers: [AuthController, ApiKeysController],
  providers: [AuthService, ApiKeysService, AdminGuard],
  exports: [AuthService, ApiKeysService, AdminGuard],
})
export class AuthModule {}
