CREATE TYPE "EtsySyncStatus" AS ENUM ('Pending', 'Processing', 'Synced', 'Failed');

CREATE TABLE "EtsyShopConnection" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshLockedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EtsyShopConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EtsyOAuthState" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "codeVerifierEncrypted" TEXT NOT NULL,
    "adminSessionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EtsyOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EtsyListingMapping" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "etsyListingId" TEXT NOT NULL,
    "listingUrl" TEXT,
    "remoteState" TEXT NOT NULL DEFAULT 'draft',
    "imageFingerprint" TEXT NOT NULL DEFAULT '',
    "imageIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EtsyListingMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EtsySyncJob" (
    "productId" TEXT NOT NULL,
    "status" "EtsySyncStatus" NOT NULL DEFAULT 'Pending',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EtsySyncJob_pkey" PRIMARY KEY ("productId")
);

CREATE UNIQUE INDEX "EtsyOAuthState_stateHash_key" ON "EtsyOAuthState"("stateHash");
CREATE INDEX "EtsyOAuthState_expiresAt_idx" ON "EtsyOAuthState"("expiresAt");
CREATE INDEX "EtsyOAuthState_adminSessionId_expiresAt_idx" ON "EtsyOAuthState"("adminSessionId", "expiresAt");
CREATE UNIQUE INDEX "EtsyListingMapping_productId_key" ON "EtsyListingMapping"("productId");
CREATE UNIQUE INDEX "EtsyListingMapping_etsyListingId_key" ON "EtsyListingMapping"("etsyListingId");
CREATE INDEX "EtsyListingMapping_remoteState_idx" ON "EtsyListingMapping"("remoteState");
CREATE INDEX "EtsySyncJob_status_availableAt_createdAt_idx" ON "EtsySyncJob"("status", "availableAt", "createdAt");
CREATE INDEX "EtsySyncJob_status_lockedAt_idx" ON "EtsySyncJob"("status", "lockedAt");

ALTER TABLE "EtsyListingMapping" ADD CONSTRAINT "EtsyListingMapping_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EtsySyncJob" ADD CONSTRAINT "EtsySyncJob_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
