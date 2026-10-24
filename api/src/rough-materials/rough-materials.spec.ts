import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { calculateRoughQuote } from "./rough-materials.quote";
import { RoughQuoteDto } from "./rough-materials.dto";

const materials = [
  { id: "agate", sku: "RM-AGATE", name: "Agate", pricePerKg: 1.25, availableKg: 10000, isPublished: true, isAvailable: true },
  { id: "jasper", sku: "RM-JASPER", name: "Jasper", pricePerKg: 2.10, availableKg: null, isPublished: true, isAvailable: true },
  { id: "quartz", sku: "RM-QUARTZ", name: "Quartz", pricePerKg: 3, availableKg: 5000, isPublished: true, isAvailable: true },
];

test("single material at exactly 2 metric tons is eligible", () => {
  const quote = calculateRoughQuote([{ materialId: "agate", quantityKg: 2000 }], materials);
  assert.equal(quote.totalKg, 2000);
  assert.equal(quote.total, 2500);
  assert.equal(quote.currency, "USD");
});

test("two materials combine toward the minimum using server prices", () => {
  const quote = calculateRoughQuote([{ materialId: "agate", quantityKg: 1200 }, { materialId: "jasper", quantityKg: 800 }], materials);
  assert.equal(quote.totalKg, 2000);
  assert.equal(quote.total, 3180);
  assert.equal(quote.lines[1].subtotal, 1680);
});

test("1999.999 kg cannot unlock inquiry links", () => {
  assert.throws(() => calculateRoughQuote([{ materialId: "agate", quantityKg: 1999.999 }], materials), /2 metric tons/);
});

test("three materials and duplicate material IDs are rejected", () => {
  assert.throws(() => calculateRoughQuote(materials.map((material) => ({ materialId: material.id, quantityKg: 1000 })), materials), /one or two/);
  assert.throws(() => calculateRoughQuote([{ materialId: "agate", quantityKg: 1000 }, { materialId: "agate", quantityKg: 1000 }], materials), /duplicate/);
});

test("unpublished, unavailable, missing and insufficient-stock materials cannot be quoted", () => {
  const line = [{ materialId: "agate", quantityKg: 2000 }];
  assert.throws(() => calculateRoughQuote(line, [{ ...materials[0], isPublished: false }]), /no longer available/);
  assert.throws(() => calculateRoughQuote(line, [{ ...materials[0], isAvailable: false }]), /no longer available/);
  assert.throws(() => calculateRoughQuote(line, []), /no longer available/);
  assert.throws(() => calculateRoughQuote(line, [{ ...materials[0], availableKg: 1999 }]), /exceeds availability/);
});

test("fractional kg use gram precision and cents rounding", () => {
  const quote = calculateRoughQuote([{ materialId: "agate", quantityKg: 1999.999 }, { materialId: "jasper", quantityKg: 0.001 }], materials);
  assert.equal(quote.totalKg, 2000);
  assert.equal(quote.total, 2500);
  for (const quantityKg of [0, -1, Infinity, NaN, 2000.0001, 1000001]) {
    assert.throws(() => calculateRoughQuote([{ materialId: "agate", quantityKg }], materials), /positive weight/);
  }
});

test("quote DTO rejects empty requests, third materials, invalid precision and negative weights", async () => {
  for (const body of [{ items: [] }, { items: materials.map((material) => ({ materialId: material.id, quantityKg: 1000 })) }, { items: [{ materialId: "agate", quantityKg: -2000 }] }, { items: [{ materialId: "agate", quantityKg: 2000.0001 }] }]) {
    assert.ok((await validate(plainToInstance(RoughQuoteDto, body))).length > 0);
  }
  assert.equal((await validate(plainToInstance(RoughQuoteDto, { items: [{ materialId: "agate", quantityKg: 2000 }] }))).length, 0);
});
