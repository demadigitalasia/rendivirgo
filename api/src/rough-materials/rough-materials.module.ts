import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { AdminRoughMaterialsController, RoughMaterialsController } from "./rough-materials.controller";
import { RoughMaterialsService } from "./rough-materials.service";

@Module({ imports: [SettingsModule], controllers: [RoughMaterialsController, AdminRoughMaterialsController], providers: [RoughMaterialsService] })
export class RoughMaterialsModule {}
