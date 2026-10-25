CREATE TYPE "LapidaryRequestStatus" AS ENUM (
  'New', 'Reviewing', 'QuoteSent', 'Approved', 'InProgress', 'Completed', 'Declined', 'Cancelled'
);
CREATE TYPE "LapidaryMaterialSource" AS ENUM (
  'CustomerSupplied', 'RendiVirgoStock', 'Undecided'
);
CREATE TYPE "LapidaryServiceType" AS ENUM (
  'Cabochon', 'Faceting', 'Freeform', 'Reshaping', 'Other'
);

CREATE TABLE "LapidaryRequest" (
  "id" TEXT NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "country" TEXT,
  "company" TEXT,
  "materialSource" "LapidaryMaterialSource" NOT NULL,
  "materialDescription" TEXT NOT NULL,
  "serviceType" "LapidaryServiceType" NOT NULL,
  "desiredShape" TEXT,
  "lengthMm" DECIMAL(8,2),
  "widthMm" DECIMAL(8,2),
  "depthMm" DECIMAL(8,2),
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "targetDate" TIMESTAMP(3),
  "details" TEXT NOT NULL,
  "referenceImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "termsAcceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "LapidaryRequestStatus" NOT NULL DEFAULT 'New',
  "quoteAmount" DECIMAL(12,2),
  "quoteCurrency" TEXT NOT NULL DEFAULT 'USD',
  "estimatedDays" INTEGER,
  "adminNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LapidaryRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LapidaryRequest_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "LapidaryRequest_dimensions_positive" CHECK (
    ("lengthMm" IS NULL OR "lengthMm" > 0) AND
    ("widthMm" IS NULL OR "widthMm" > 0) AND
    ("depthMm" IS NULL OR "depthMm" > 0)
  ),
  CONSTRAINT "LapidaryRequest_quote_nonnegative" CHECK ("quoteAmount" IS NULL OR "quoteAmount" >= 0),
  CONSTRAINT "LapidaryRequest_estimated_days_positive" CHECK ("estimatedDays" IS NULL OR "estimatedDays" > 0)
);
CREATE UNIQUE INDEX "LapidaryRequest_requestNumber_key" ON "LapidaryRequest"("requestNumber");
CREATE INDEX "LapidaryRequest_status_createdAt_idx" ON "LapidaryRequest"("status", "createdAt");
CREATE INDEX "LapidaryRequest_email_createdAt_idx" ON "LapidaryRequest"("email", "createdAt");
CREATE INDEX "LapidaryRequest_createdAt_idx" ON "LapidaryRequest"("createdAt");

CREATE TABLE "LapidaryArtist" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "roleId" TEXT,
  "location" TEXT,
  "bio" TEXT NOT NULL,
  "bioId" TEXT,
  "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "imageUrl" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LapidaryArtist_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LapidaryArtist_isPublished_sortOrder_idx" ON "LapidaryArtist"("isPublished", "sortOrder");
