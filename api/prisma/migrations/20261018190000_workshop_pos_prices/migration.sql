ALTER TABLE "Product"
  ADD COLUMN "workshopPriceIdr" DECIMAL(12,2);

ALTER TABLE "ProductVariant"
  ADD COLUMN "workshopPriceIdr" DECIMAL(12,2);
