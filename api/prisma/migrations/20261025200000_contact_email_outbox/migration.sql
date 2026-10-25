CREATE TYPE "ContactEmailOutboxKind" AS ENUM ('AdminNotification', 'CustomerReply');
CREATE TYPE "ContactEmailOutboxStatus" AS ENUM ('Pending', 'Processing', 'Sent', 'Failed');

CREATE TABLE "ContactEmailOutbox" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" "ContactEmailOutboxKind" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "status" "ContactEmailOutboxStatus" NOT NULL DEFAULT 'Pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactEmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactEmailOutbox_dedupeKey_key" ON "ContactEmailOutbox"("dedupeKey");
CREATE INDEX "ContactEmailOutbox_messageId_createdAt_idx" ON "ContactEmailOutbox"("messageId", "createdAt");
CREATE INDEX "ContactEmailOutbox_status_availableAt_createdAt_idx" ON "ContactEmailOutbox"("status", "availableAt", "createdAt");
CREATE INDEX "ContactEmailOutbox_status_lockedAt_idx" ON "ContactEmailOutbox"("status", "lockedAt");

ALTER TABLE "ContactEmailOutbox"
ADD CONSTRAINT "ContactEmailOutbox_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
