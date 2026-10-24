import assert from "node:assert/strict";
import { test } from "node:test";
import { roughEstimate, type RoughMaterial } from "../lib/rough-materials";
const material: RoughMaterial = { id: "agate", sku: "AG", name: "Agate", stoneType: "Agate", origin: "Indonesia", description: "", sizeNotes: "", images: [], pricePerKg: 1.25, availableKg: 5000, isAvailable: true, currency: "USD" };
test("calculator unlocks only at combined 2000 kg with no more than two types", () => {
  assert.equal(roughEstimate([]).valid, false);
  assert.equal(roughEstimate([{ material, quantity: "1999.999" }]).valid, false);
  assert.equal(roughEstimate([{ material, quantity: "2000" }]).valid, true);
  const mixed = roughEstimate([{ material, quantity: "1200" }, { material: { ...material, id: "jasper", pricePerKg: 2.10 }, quantity: "800" }]);
  assert.equal(mixed.valid, true);
  assert.equal(mixed.total, 3180);
  assert.equal(roughEstimate(["agate", "jasper", "quartz"].map((id) => ({ material: { ...material, id }, quantity: "1000" }))).valid, false);
});
test("calculator rejects invalid quantities and unavailable weights", () => {
  for (const quantity of ["", "-2000", "0", "NaN", "2000.0001", "1000001", "6000"]) assert.equal(roughEstimate([{ material, quantity }]).valid, false);
  assert.equal(roughEstimate([{ material: { ...material, isAvailable: false }, quantity: "2000" }]).valid, false);
});
