-- Existing items remain unchanged until explicitly classified by an administrator.
ALTER TABLE "Product" ADD COLUMN "isBulkMaterial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD CONSTRAINT "Product_bulk_manual_channels_check"
CHECK (NOT "isBulkMaterial" OR (NOT "sellOnWeb" AND NOT "sellInWholesale" AND NOT "sellInEtsy"));
