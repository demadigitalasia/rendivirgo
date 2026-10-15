ALTER TABLE "Order"
ADD COLUMN "paymentProofPath" TEXT,
ADD COLUMN "paymentProofMime" TEXT,
ADD COLUMN "paymentProofUploadedAt" TIMESTAMP(3);

CREATE INDEX "Order_paymentMethod_paymentStatus_paymentProofUploadedAt_idx"
ON "Order"("paymentMethod", "paymentStatus", "paymentProofUploadedAt");
