CREATE TYPE "TranslationStatus" AS ENUM ('Missing', 'Draft', 'Review', 'Ready');

ALTER TABLE "ConditionOption"
  ADD COLUMN "noteId" TEXT,
  ADD COLUMN "idTranslationStatus" "TranslationStatus" NOT NULL DEFAULT 'Missing';

ALTER TABLE "Category"
  ADD COLUMN "nameId" TEXT,
  ADD COLUMN "descriptionId" TEXT,
  ADD COLUMN "metaTitleId" TEXT,
  ADD COLUMN "metaDescriptionId" TEXT,
  ADD COLUMN "idTranslationStatus" "TranslationStatus" NOT NULL DEFAULT 'Missing';

ALTER TABLE "Product"
  ADD COLUMN "nameId" TEXT,
  ADD COLUMN "descriptionId" TEXT,
  ADD COLUMN "metaTitleId" TEXT,
  ADD COLUMN "metaDescriptionId" TEXT,
  ADD COLUMN "idTranslationStatus" "TranslationStatus" NOT NULL DEFAULT 'Missing';

ALTER TABLE "BlogPost"
  ADD COLUMN "titleId" TEXT,
  ADD COLUMN "excerptId" TEXT,
  ADD COLUMN "bodyId" TEXT,
  ADD COLUMN "tagsId" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "metaTitleId" TEXT,
  ADD COLUMN "metaDescriptionId" TEXT,
  ADD COLUMN "idTranslationStatus" "TranslationStatus" NOT NULL DEFAULT 'Missing';

ALTER TABLE "Page"
  ADD COLUMN "titleId" TEXT,
  ADD COLUMN "bodyId" TEXT,
  ADD COLUMN "metaTitleId" TEXT,
  ADD COLUMN "metaDescriptionId" TEXT,
  ADD COLUMN "idTranslationStatus" "TranslationStatus" NOT NULL DEFAULT 'Missing';

ALTER TABLE "Testimonial"
  ADD COLUMN "quoteId" TEXT,
  ADD COLUMN "idTranslationStatus" "TranslationStatus" NOT NULL DEFAULT 'Missing';
