ALTER TYPE "LapidaryRequestStatus" ADD VALUE IF NOT EXISTS 'MaterialInTransit';
ALTER TYPE "LapidaryRequestStatus" ADD VALUE IF NOT EXISTS 'MaterialReceived';
ALTER TYPE "LapidaryRequestStatus" ADD VALUE IF NOT EXISTS 'EstimateSent';
ALTER TYPE "LapidaryRequestStatus" ADD VALUE IF NOT EXISTS 'AwaitingPayment';
ALTER TYPE "LapidaryRequestStatus" ADD VALUE IF NOT EXISTS 'ReturnShipped';
ALTER TYPE "LapidaryRequestStatus" ADD VALUE IF NOT EXISTS 'Delivered';

CREATE TYPE "LapidaryInvoiceStatus" AS ENUM ('AwaitingPayment', 'Paid', 'Void');
CREATE TYPE "LapidaryEmailOutboxStatus" AS ENUM ('Pending', 'Processing', 'Sent', 'Failed');

ALTER TABLE "LapidaryRequest"
  ADD COLUMN "customerId" TEXT,
  ADD COLUMN "claimTokenHash" TEXT,
  ADD COLUMN "claimTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "serviceEstimateMin" DECIMAL(12,2),
  ADD COLUMN "serviceEstimateMax" DECIMAL(12,2),
  ADD COLUMN "estimateAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "materialShippingInstructions" TEXT,
  ADD COLUMN "inboundCarrier" TEXT,
  ADD COLUMN "inboundTrackingNumber" TEXT,
  ADD COLUMN "inboundTrackingUrl" TEXT,
  ADD COLUMN "materialReceivedAt" TIMESTAMP(3),
  ADD COLUMN "returnCarrier" TEXT,
  ADD COLUMN "returnTrackingNumber" TEXT,
  ADD COLUMN "returnTrackingUrl" TEXT,
  ADD COLUMN "returnShippedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD CONSTRAINT "LapidaryRequest_serviceEstimate_range_check" CHECK (
    ("serviceEstimateMin" IS NULL AND "serviceEstimateMax" IS NULL) OR
    ("serviceEstimateMin" IS NOT NULL AND "serviceEstimateMax" IS NOT NULL AND "serviceEstimateMin" >= 0 AND "serviceEstimateMax" >= "serviceEstimateMin")
  );

CREATE UNIQUE INDEX "LapidaryRequest_claimTokenHash_key" ON "LapidaryRequest"("claimTokenHash");
CREATE INDEX "LapidaryRequest_customerId_createdAt_idx" ON "LapidaryRequest"("customerId", "createdAt");
ALTER TABLE "LapidaryRequest"
  ADD CONSTRAINT "LapidaryRequest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LapidaryProgressUpdate" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "body" TEXT NOT NULL,
  "isCustomerVisible" BOOLEAN NOT NULL DEFAULT true,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LapidaryProgressUpdate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LapidaryProgressUpdate_requestId_createdAt_idx" ON "LapidaryProgressUpdate"("requestId", "createdAt");
ALTER TABLE "LapidaryProgressUpdate"
  ADD CONSTRAINT "LapidaryProgressUpdate_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "LapidaryRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LapidaryProgressMedia" (
  "id" TEXT NOT NULL,
  "updateId" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LapidaryProgressMedia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LapidaryProgressMedia_updateId_createdAt_idx" ON "LapidaryProgressMedia"("updateId", "createdAt");
ALTER TABLE "LapidaryProgressMedia"
  ADD CONSTRAINT "LapidaryProgressMedia_updateId_fkey"
  FOREIGN KEY ("updateId") REFERENCES "LapidaryProgressUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LapidaryInvoice" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "serviceAmount" DECIMAL(12,2) NOT NULL,
  "returnShippingAmount" DECIMAL(12,2) NOT NULL,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "returnRecipientName" TEXT,
  "returnPhone" TEXT,
  "returnAddressLine1" TEXT,
  "returnAddressLine2" TEXT,
  "returnCity" TEXT,
  "returnState" TEXT,
  "returnPostalCode" TEXT,
  "returnCountry" TEXT,
  "returnCountryCode" TEXT,
  "status" "LapidaryInvoiceStatus" NOT NULL DEFAULT 'AwaitingPayment',
  "paymentProofPath" TEXT,
  "paymentProofMime" TEXT,
  "paymentProofUploadedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LapidaryInvoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LapidaryInvoice_total_check" CHECK (
    "serviceAmount" >= 0 AND "returnShippingAmount" >= 0 AND
    "totalAmount" = "serviceAmount" + "returnShippingAmount"
  )
);
CREATE UNIQUE INDEX "LapidaryInvoice_requestId_key" ON "LapidaryInvoice"("requestId");
CREATE INDEX "LapidaryInvoice_status_createdAt_idx" ON "LapidaryInvoice"("status", "createdAt");
ALTER TABLE "LapidaryInvoice"
  ADD CONSTRAINT "LapidaryInvoice_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "LapidaryRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LapidaryEmailOutbox" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "encryptedPayload" TEXT NOT NULL,
  "status" "LapidaryEmailOutboxStatus" NOT NULL DEFAULT 'Pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LapidaryEmailOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LapidaryEmailOutbox_dedupeKey_key" ON "LapidaryEmailOutbox"("dedupeKey");
CREATE INDEX "LapidaryEmailOutbox_status_availableAt_createdAt_idx" ON "LapidaryEmailOutbox"("status", "availableAt", "createdAt");
CREATE INDEX "LapidaryEmailOutbox_status_lockedAt_idx" ON "LapidaryEmailOutbox"("status", "lockedAt");
ALTER TABLE "LapidaryEmailOutbox"
  ADD CONSTRAINT "LapidaryEmailOutbox_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "LapidaryRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
