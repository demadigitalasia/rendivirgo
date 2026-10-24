CREATE TABLE "RoughMaterial" (
  "id" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "stoneType" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "sizeNotes" TEXT NOT NULL DEFAULT '',
  "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "pricePerKg" DECIMAL(12,2) NOT NULL,
  "availableKg" DECIMAL(14,3),
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoughMaterial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoughMaterial_price_nonnegative" CHECK ("pricePerKg" >= 0),
  CONSTRAINT "RoughMaterial_stock_nonnegative" CHECK ("availableKg" IS NULL OR "availableKg" >= 0)
);
CREATE UNIQUE INDEX "RoughMaterial_sku_key" ON "RoughMaterial"("sku");
CREATE UNIQUE INDEX "RoughMaterial_name_key" ON "RoughMaterial"("name");
CREATE INDEX "RoughMaterial_isPublished_sortOrder_idx" ON "RoughMaterial"("isPublished", "sortOrder");
