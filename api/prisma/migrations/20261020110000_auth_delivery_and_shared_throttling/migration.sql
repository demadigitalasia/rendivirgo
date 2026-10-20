CREATE TYPE "AuthEmailOutboxKind" AS ENUM (
  'CustomerVerification',
  'CustomerPasswordReset',
  'AdminPasswordReset'
);

CREATE TYPE "AuthEmailOutboxStatus" AS ENUM (
  'Pending',
  'Processing',
  'Sent',
  'Cancelled',
  'Failed'
);

CREATE TABLE "AuthEmailOutbox" (
  "id" TEXT NOT NULL,
  "kind" "AuthEmailOutboxKind" NOT NULL,
  "status" "AuthEmailOutboxStatus" NOT NULL DEFAULT 'Pending',
  "targetId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "encryptedPayload" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthEmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthEmailOutbox_tokenHash_key" ON "AuthEmailOutbox"("tokenHash");
CREATE UNIQUE INDEX "AuthEmailOutbox_dedupeKey_key" ON "AuthEmailOutbox"("dedupeKey");
CREATE INDEX "AuthEmailOutbox_status_availableAt_createdAt_idx" ON "AuthEmailOutbox"("status", "availableAt", "createdAt");
CREATE INDEX "AuthEmailOutbox_status_lockedAt_idx" ON "AuthEmailOutbox"("status", "lockedAt");
CREATE INDEX "AuthEmailOutbox_status_expiresAt_idx" ON "AuthEmailOutbox"("status", "expiresAt");

CREATE TABLE "AuthRateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "AuthRateLimitBucket_resetAt_idx" ON "AuthRateLimitBucket"("resetAt");
