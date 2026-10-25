ALTER TABLE "LapidaryArtist"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "signatureStyle" TEXT,
  ADD COLUMN "signatureStyleId" TEXT,
  ADD COLUMN "stoneExperienceEn" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "stoneExperienceId" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "experienceEn" TEXT,
  ADD COLUMN "experienceId" TEXT,
  ADD COLUMN "imageAltEn" TEXT,
  ADD COLUMN "imageAltId" TEXT,
  ADD COLUMN "imagePosition" TEXT NOT NULL DEFAULT 'center',
  ADD COLUMN "portfolioImages" JSONB NOT NULL DEFAULT '[]'::JSONB;

UPDATE "LapidaryArtist"
SET "slug" = COALESCE(
  NULLIF(trim(BOTH '-' FROM lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'))), ''),
  'artist'
) || '-' || left("id", 6);

ALTER TABLE "LapidaryArtist"
  ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "LapidaryArtist_slug_key" ON "LapidaryArtist"("slug");
