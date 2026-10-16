CREATE TYPE "OrderReturnRequestStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

CREATE TABLE "OrderReturnRequest" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "OrderReturnRequestStatus" NOT NULL DEFAULT 'Pending',
  "reason" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "evidencePath" TEXT,
  "evidenceMime" TEXT,
  "adminResponse" TEXT,
  "reviewedById" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),

  CONSTRAINT "OrderReturnRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderReturnRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "OrderReturnRequest_status_submittedAt_idx" ON "OrderReturnRequest"("status", "submittedAt");
CREATE INDEX "OrderReturnRequest_orderId_submittedAt_idx" ON "OrderReturnRequest"("orderId", "submittedAt");
