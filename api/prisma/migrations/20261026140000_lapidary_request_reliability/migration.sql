ALTER TABLE "LapidaryRequest"
ADD COLUMN "submissionKey" TEXT,
ADD COLUMN "termsVersion" TEXT;

CREATE UNIQUE INDEX "LapidaryRequest_submissionKey_key"
ON "LapidaryRequest"("submissionKey");
