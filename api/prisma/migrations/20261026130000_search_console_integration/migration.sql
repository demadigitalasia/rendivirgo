CREATE TABLE "GoogleSearchConsoleConnection" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "siteUrl" TEXT,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "lastReport" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoogleSearchConsoleConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoogleSearchConsoleOAuthState" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "codeVerifierEncrypted" TEXT NOT NULL,
    "adminSessionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoogleSearchConsoleOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleSearchConsoleOAuthState_stateHash_key"
    ON "GoogleSearchConsoleOAuthState"("stateHash");
CREATE INDEX "GoogleSearchConsoleOAuthState_expiresAt_idx"
    ON "GoogleSearchConsoleOAuthState"("expiresAt");
CREATE INDEX "GoogleSearchConsoleOAuthState_adminSessionId_expiresAt_idx"
    ON "GoogleSearchConsoleOAuthState"("adminSessionId", "expiresAt");
