import { Module } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { AdminCategoriesController, CategoriesController } from "./categories.controller";
import { ProductsService } from "./products.service";
import { AdminProductsController, ProductsController } from "./products.controller";

@Module({
  controllers: [CategoriesController, AdminCategoriesController, ProductsController, AdminProductsController],
  providers: [CategoriesService, ProductsService],
  exports: [CategoriesService, ProductsService],
})
export class CatalogModule {}
