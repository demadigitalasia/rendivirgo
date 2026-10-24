ALTER TABLE "Customer"
  ADD COLUMN "wholesaleRequestedAt" TIMESTAMP(3);

CREATE INDEX "Customer_wholesaleRequestedAt_idx" ON "Customer"("wholesaleRequestedAt");
