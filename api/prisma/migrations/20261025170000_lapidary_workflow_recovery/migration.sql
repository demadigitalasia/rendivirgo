ALTER TYPE "LapidaryRequestStatus" ADD VALUE IF NOT EXISTS 'ReturnPending';
ALTER TABLE "LapidaryRequest"
  ADD COLUMN "workCancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "LapidaryInvoice"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "revisionReason" TEXT;
