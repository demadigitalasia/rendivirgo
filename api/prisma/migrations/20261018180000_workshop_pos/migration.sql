ALTER TYPE "PaymentMethod" ADD VALUE 'Cash';
ALTER TYPE "PaymentMethod" ADD VALUE 'QRIS';

CREATE TYPE "OrderSource" AS ENUM ('Online', 'POS', 'Wholesale');
CREATE TYPE "FulfillmentMethod" AS ENUM ('Shipping', 'WorkshopPickup');

ALTER TABLE "Product"
  ADD COLUMN "sellOnWeb" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sellInWorkshop" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "workshopStockQuantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ProductVariant"
  ADD COLUMN "workshopStockQuantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order"
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'Online',
  ADD COLUMN "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'Shipping',
  ADD COLUMN "exchangeRate" DECIMAL(12,4),
  ADD COLUMN "manualDiscountType" "DiscountType",
  ADD COLUMN "manualDiscountValue" DECIMAL(12,2),
  ADD COLUMN "discountReason" TEXT;

ALTER TABLE "OrderItem"
  ADD COLUMN "workshopAllocatedQuantity" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Order_source_placedAt_idx" ON "Order"("source", "placedAt");
