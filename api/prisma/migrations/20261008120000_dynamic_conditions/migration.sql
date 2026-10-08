ALTER TABLE "Product" ALTER COLUMN "condition" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "condition" TYPE TEXT USING "condition"::TEXT;
ALTER TABLE "Product" ALTER COLUMN "condition" SET DEFAULT 'Natural';
DROP TYPE "StoneCondition";

CREATE TABLE "ConditionOption" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConditionOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConditionOption_slug_key" ON "ConditionOption"("slug");
CREATE UNIQUE INDEX "ConditionOption_name_key" ON "ConditionOption"("name");
CREATE INDEX "ConditionOption_sortOrder_idx" ON "ConditionOption"("sortOrder");

INSERT INTO "ConditionOption" ("id", "slug", "name", "note", "sortOrder", "isActive", "updatedAt") VALUES
    ('condition_natural', 'natural', 'Natural', 'Natural inclusions, colour variation, and small variations in texture are part of this stone''s character.', 0, true, CURRENT_TIMESTAMP),
    ('condition_treated', 'treated', 'Treated', 'Any treatment is disclosed so you can make an informed choice.', 1, true, CURRENT_TIMESTAMP),
    ('condition_dyed', 'dyed', 'Dyed', 'This stone has been dyed; colour may vary slightly from screen to screen.', 2, true, CURRENT_TIMESTAMP);
