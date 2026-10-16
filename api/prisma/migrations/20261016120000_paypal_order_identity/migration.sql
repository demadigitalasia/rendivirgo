ALTER TABLE "Order" ADD COLUMN "paypalOrderId" TEXT;

CREATE UNIQUE INDEX "Order_paypalOrderId_key" ON "Order"("paypalOrderId");

-- Before this migration, pending PayPal orders used paymentRef for the provider order ID.
-- Paid orders keep paymentRef as the capture ID, and cannot be backfilled without provider history.
UPDATE "Order"
SET "paypalOrderId" = "paymentRef", "paymentRef" = NULL
WHERE "paymentMethod" = 'PayPal'
  AND "paymentStatus" = 'Pending'
  AND "paymentRef" IS NOT NULL;
