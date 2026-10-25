-- HomeHero keeps the existing banner identity and canonical content fields.
ALTER TABLE "Banner" ADD COLUMN "heroContent" JSONB;
