CREATE TYPE "OrderOutboxKind" AS ENUM ('OrderReceivedCustomer', 'OrderReceivedAdmin', 'PaymentReceivedCustomer');
CREATE TYPE "OrderOutboxStatus" AS ENUM ('Pending', 'Processing', 'Sent');

CREATE TABLE "OrderOutbox" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "kind" "OrderOutboxKind" NOT NULL,
  "status" "OrderOutboxStatus" NOT NULL DEFAULT 'Pending',
  "dedupeKey" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrderOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderOutbox_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrderOutbox_dedupeKey_key" ON "OrderOutbox"("dedupeKey");
CREATE INDEX "OrderOutbox_status_availableAt_createdAt_idx" ON "OrderOutbox"("status", "availableAt", "createdAt");
CREATE INDEX "OrderOutbox_status_lockedAt_idx" ON "OrderOutbox"("status", "lockedAt");
