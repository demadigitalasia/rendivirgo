CREATE TYPE "BlogAuthorType" AS ENUM ('Person', 'Organization');

ALTER TABLE "BlogPost"
  ADD COLUMN "coverAlt" TEXT,
  ADD COLUMN "coverAltId" TEXT,
  ADD COLUMN "authorType" "BlogAuthorType" NOT NULL DEFAULT 'Organization',
  ADD COLUMN "authorUrl" TEXT;
