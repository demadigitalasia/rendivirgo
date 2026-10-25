import { Module } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { AdminCategoriesController, CategoriesController } from "./categories.controller";
import { ProductsService } from "./products.service";
import { AdminProductsController, ProductsController } from "./products.controller";
import { CatalogPdfService } from "./catalog-pdf.service";
import { ConditionsService } from "./conditions.service";
import { ContentCopyModule } from "../content/content-copy.module";
import { AdminConditionsController, ConditionsController } from "./conditions.controller";
import { SettingsModule } from "../settings/settings.module";
import { EtsyIntegrationModule } from "../etsy/etsy-integration.module";

@Module({
  imports: [SettingsModule, ContentCopyModule, EtsyIntegrationModule],
  controllers: [CategoriesController, AdminCategoriesController, ConditionsController, AdminConditionsController, ProductsController, AdminProductsController],
  providers: [CategoriesService, ConditionsService, ProductsService, CatalogPdfService],
  exports: [CategoriesService, ProductsService],
})
export class CatalogModule {}
