ALTER TYPE "LapidaryServiceType" ADD VALUE IF NOT EXISTS 'DecorationSpear';

ALTER TABLE "LapidaryRequestItem"
  ADD COLUMN "materialQuantity" DECIMAL(12,3),
  ADD COLUMN "materialUnitSnapshot" TEXT,
  ADD COLUMN "components" JSONB,
  ADD CONSTRAINT "LapidaryRequestItem_materialQuantity_positive" CHECK (
    "materialQuantity" IS NULL OR "materialQuantity" > 0
  );
