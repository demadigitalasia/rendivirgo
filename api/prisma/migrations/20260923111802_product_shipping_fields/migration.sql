-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "shippingClass" "ShippingClass" NOT NULL DEFAULT 'Standard',
ADD COLUMN     "shippingProfileId" TEXT;
