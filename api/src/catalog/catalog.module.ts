import { Module } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { AdminCategoriesController, CategoriesController } from "./categories.controller";
import { ProductsService } from "./products.service";
import { AdminProductsController, ProductsController } from "./products.controller";
import { CatalogPdfService } from "./catalog-pdf.service";
import { ConditionsService } from "./conditions.service";
import { ProductCopyService } from "./product-copy.service";
import { CategoryCopyService } from "./category-copy.service";
import { AdminConditionsController, ConditionsController } from "./conditions.controller";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [SettingsModule],
  controllers: [CategoriesController, AdminCategoriesController, ConditionsController, AdminConditionsController, ProductsController, AdminProductsController],
  providers: [CategoriesService, ConditionsService, ProductsService, CatalogPdfService, ProductCopyService, CategoryCopyService],
  exports: [CategoriesService, ProductsService],
})
export class CatalogModule {}
