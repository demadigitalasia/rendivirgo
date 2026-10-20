-- Merge old workshop allocations into the one shared physical stock pool.
UPDATE "Product"
SET "stockQuantity" = COALESCE("stockQuantity", 0) + "workshopStockQuantity",
    "workshopStockQuantity" = 0
WHERE "stockModel" = 'Quantity';

UPDATE "ProductVariant"
SET "stockQuantity" = "stockQuantity" + "workshopStockQuantity",
    "workshopStockQuantity" = 0;

UPDATE "Product" SET "workshopStockQuantity" = 0 WHERE "workshopStockQuantity" <> 0;

ALTER TABLE "Product"
  ADD COLUMN "sellInWholesale" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "wholesalePrice" DECIMAL(12,2),
  ADD COLUMN "wholesalePiecesPerUnit" INTEGER;

ALTER TABLE "ProductVariant"
  ADD COLUMN "wholesalePrice" DECIMAL(12,2),
  ADD COLUMN "wholesalePiecesPerUnit" INTEGER;

ALTER TABLE "Customer"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "verificationTokenHash" TEXT,
  ADD COLUMN "verificationTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "resetTokenHash" TEXT,
  ADD COLUMN "resetTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "wholesaleAccess" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "wholesaleApprovedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Customer_verificationTokenHash_key" ON "Customer"("verificationTokenHash");
CREATE UNIQUE INDEX "Customer_resetTokenHash_key" ON "Customer"("resetTokenHash");

CREATE TABLE "CustomerSession" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");
CREATE INDEX "CustomerSession_customerId_revokedAt_expiresAt_idx" ON "CustomerSession"("customerId", "revokedAt", "expiresAt");
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product" ADD CONSTRAINT "Product_wholesalePiecesPerUnit_check"
  CHECK ("wholesalePiecesPerUnit" IS NULL OR "wholesalePiecesPerUnit" > 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_wholesalePiecesPerUnit_check"
  CHECK ("wholesalePiecesPerUnit" IS NULL OR "wholesalePiecesPerUnit" > 0);

CREATE TABLE "PosReservation" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "committedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "PosReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PosReservationItem" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "stockModel" "StockModel" NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "PosReservationItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PosReservation_requestId_key" ON "PosReservation"("requestId");
CREATE INDEX "PosReservation_expiresAt_committedAt_releasedAt_idx" ON "PosReservation"("expiresAt", "committedAt", "releasedAt");
CREATE INDEX "PosReservationItem_reservationId_idx" ON "PosReservationItem"("reservationId");
CREATE INDEX "PosReservationItem_productId_variantId_idx" ON "PosReservationItem"("productId", "variantId");
ALTER TABLE "PosReservationItem" ADD CONSTRAINT "PosReservationItem_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "PosReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
