ALTER TYPE "LapidaryServiceType" ADD VALUE IF NOT EXISTS 'CabochonPendant';
ALTER TYPE "LapidaryServiceType" ADD VALUE IF NOT EXISTS 'CabochonPair';
ALTER TYPE "LapidaryServiceType" ADD VALUE IF NOT EXISTS 'CabochonSuite';
ALTER TYPE "LapidaryServiceType" ADD VALUE IF NOT EXISTS 'CabochonFreeform';
ALTER TYPE "LapidaryServiceType" ADD VALUE IF NOT EXISTS 'SlabPolishing';
ALTER TYPE "LapidaryServiceType" ADD VALUE IF NOT EXISTS 'DecorationSphere';
ALTER TYPE "LapidaryServiceType" ADD VALUE IF NOT EXISTS 'DecorationTower';
ALTER TYPE "LapidaryServiceType" ADD VALUE IF NOT EXISTS 'DecorationTumbled';
ALTER TYPE "LapidaryServiceType" ADD VALUE IF NOT EXISTS 'DecorationOther';

ALTER TABLE "LapidaryRequest"
  ADD COLUMN "materialOrigin" TEXT,
  ADD COLUMN "materialCondition" TEXT,
  ADD COLUMN "materialWeightGram" DECIMAL(12,2),
  ADD COLUMN "finishPreference" TEXT,
  ADD COLUMN "additionalDetails" TEXT;

CREATE TABLE "LapidaryRequestItem" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "serviceType" "LapidaryServiceType" NOT NULL,
  "workDescription" TEXT,
  "shapeKey" TEXT,
  "desiredShape" TEXT,
  "lengthMm" DECIMAL(8,2),
  "widthMm" DECIMAL(8,2),
  "depthMm" DECIMAL(8,2),
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "productId" TEXT,
  "productNameSnapshot" TEXT,
  "productSkuSnapshot" TEXT,
  "productSlugSnapshot" TEXT,
  "productStoneTypeSnapshot" TEXT,
  "productOriginSnapshot" TEXT,
  "productPriceSnapshot" DECIMAL(12,2),
  "productCurrencySnapshot" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LapidaryRequestItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LapidaryRequestItem_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "LapidaryRequestItem_dimensions_positive" CHECK (
    ("lengthMm" IS NULL OR "lengthMm" > 0) AND
    ("widthMm" IS NULL OR "widthMm" > 0) AND
    ("depthMm" IS NULL OR "depthMm" > 0)
  ),
  CONSTRAINT "LapidaryRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LapidaryRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LapidaryRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "LapidaryRequestItem_requestId_sortOrder_idx" ON "LapidaryRequestItem"("requestId", "sortOrder");
CREATE INDEX "LapidaryRequestItem_productId_idx" ON "LapidaryRequestItem"("productId");

CREATE TABLE "LapidaryRequestMedia" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LapidaryRequestMedia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LapidaryRequestMedia_size_positive" CHECK ("size" > 0),
  CONSTRAINT "LapidaryRequestMedia_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LapidaryRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LapidaryRequestMedia_requestId_createdAt_idx" ON "LapidaryRequestMedia"("requestId", "createdAt");
