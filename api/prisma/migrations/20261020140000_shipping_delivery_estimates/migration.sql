ALTER TABLE "ShippingRate"
  ADD COLUMN "deliveryMinDays" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "deliveryMaxDays" INTEGER NOT NULL DEFAULT 7;

ALTER TABLE "ShippingRate"
  ADD CONSTRAINT "ShippingRate_deliveryDays_check"
  CHECK ("deliveryMinDays" >= 1 AND "deliveryMaxDays" >= "deliveryMinDays" AND "deliveryMaxDays" <= 365);
