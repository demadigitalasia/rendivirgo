ALTER TABLE "Order"
ADD COLUMN "utmSource" VARCHAR(120),
ADD COLUMN "utmMedium" VARCHAR(120),
ADD COLUMN "utmCampaign" VARCHAR(160),
ADD COLUMN "utmContent" VARCHAR(200),
ADD COLUMN "utmTerm" VARCHAR(200),
ADD COLUMN "landingPath" VARCHAR(500);

CREATE INDEX "Order_utmCampaign_placedAt_idx"
ON "Order"("utmCampaign", "placedAt");

ALTER TABLE "LapidaryRequest"
ADD COLUMN "utmSource" VARCHAR(120),
ADD COLUMN "utmMedium" VARCHAR(120),
ADD COLUMN "utmCampaign" VARCHAR(160),
ADD COLUMN "utmContent" VARCHAR(200),
ADD COLUMN "utmTerm" VARCHAR(200),
ADD COLUMN "landingPath" VARCHAR(500);

CREATE INDEX "LapidaryRequest_utmCampaign_createdAt_idx"
ON "LapidaryRequest"("utmCampaign", "createdAt");
