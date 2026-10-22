ALTER TABLE "Product"
ADD COLUMN "sellInEtsy" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Product"
SET "sellInEtsy" = true
WHERE "id" IN (SELECT "productId" FROM "EtsyListingMapping");

ALTER TABLE "EtsyListingMapping"
ADD COLUMN "shopId" TEXT;

ALTER TABLE "EtsyListingMapping"
ADD COLUMN "creationAttemptAt" TIMESTAMP(3);

CREATE INDEX "EtsyListingMapping_shopId_idx" ON "EtsyListingMapping"("shopId");
