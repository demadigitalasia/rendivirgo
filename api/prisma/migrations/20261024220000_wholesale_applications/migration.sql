CREATE TYPE "WholesaleApplicationStatus" AS ENUM ('None', 'Pending', 'Approved', 'Rejected');
ALTER TYPE "AuthEmailOutboxKind" ADD VALUE 'WholesaleCustomerNotification';
ALTER TYPE "AuthEmailOutboxKind" ADD VALUE 'WholesaleAdminNotification';
ALTER TABLE "Customer"
  ADD COLUMN "wholesaleStatus" "WholesaleApplicationStatus" NOT NULL DEFAULT 'None',
  ADD COLUMN "wholesaleBusinessName" TEXT,
  ADD COLUMN "wholesaleBuyerType" TEXT,
  ADD COLUMN "wholesaleBusinessCountry" TEXT,
  ADD COLUMN "wholesaleBusinessWebsite" TEXT,
  ADD COLUMN "wholesaleBusinessNeeds" TEXT,
  ADD COLUMN "wholesaleReviewReason" TEXT,
  ADD COLUMN "wholesaleReviewedAt" TIMESTAMP(3),
  ADD COLUMN "wholesaleRevision" INTEGER NOT NULL DEFAULT 0;
UPDATE "Customer" SET "wholesaleStatus" = CASE WHEN "wholesaleAccess" THEN 'Approved'::"WholesaleApplicationStatus" WHEN "wholesaleRequestedAt" IS NOT NULL THEN 'Pending'::"WholesaleApplicationStatus" ELSE 'None'::"WholesaleApplicationStatus" END;
