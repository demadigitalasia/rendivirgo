import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "../../generated/prisma";
import { ShippingService } from "./shipping.service";

type RateInput = {
  id: string;
  name: string;
  carrier: string | null;
  region: string;
  minWeightGram: number;
  maxWeightGram: number | null;
  price: number;
  handlingFee: number;
  insuranceFee: number;
  fragileFee: number;
  oversizedFee: number;
  isActive: boolean;
  sortOrder: number;
};

const rate = (input: Partial<RateInput> & { id: string }): RateInput => ({
  name: `Rate ${input.id}`,
  carrier: "Test",
  region: "Worldwide",
  minWeightGram: 0,
  maxWeightGram: null,
  price: 20,
  handlingFee: 2,
  insuranceFee: 1,
  fragileFee: 5,
  oversizedFee: 8,
  isActive: true,
  sortOrder: 0,
  ...input,
});

const toPrismaRate = (input: RateInput) => ({
  ...input,
  price: new Prisma.Decimal(input.price),
  handlingFee: new Prisma.Decimal(input.handlingFee),
  insuranceFee: new Prisma.Decimal(input.insuranceFee),
  fragileFee: new Prisma.Decimal(input.fragileFee),
  oversizedFee: new Prisma.Decimal(input.oversizedFee),
  createdAt: new Date(),
  updatedAt: new Date(),
});

function buildService(options: {
  rates?: RateInput[];
  settings?: Partial<{ overrideEnabled: boolean; overrideAmount: number; freeShippingThreshold: number }>;
}) {
  const rates = (options.rates ?? []).map(toPrismaRate);
  const prisma = {
    shippingRate: {
      findMany: async () => rates,
      findUnique: async ({ where }: { where: { id: string } }) => rates.find((entry) => entry.id === where.id) ?? null,
    },
  };
  const settings = {
    getShippingSettings: async () => ({
      overrideEnabled: false,
      overrideAmount: 48,
      freeShippingThreshold: 0,
      ...(options.settings ?? {}),
    }),
  };
  const audit = { log: async () => undefined };
  return new ShippingService(prisma as never, settings as never, audit as never);
}

const subtotal = (value: number) => new Prisma.Decimal(value);

describe("ShippingService.resolveOrderShipping", () => {
  it("uses the admin override amount and accepts the synthetic id", async () => {
    const service = buildService({ settings: { overrideEnabled: true, overrideAmount: 48 } });
    const result = await service.resolveOrderShipping({
      shippingRateId: "admin-override",
      subtotal: subtotal(100),
      weightGram: 50,
      countryCode: "US",
      fragile: false,
      oversized: false,
    });
    assert.equal(result.source, "AdminOverride");
    assert.equal(result.shippingCost.toNumber(), 48);
  });

  it("rejects a real rate id while the override is enabled", async () => {
    const service = buildService({
      rates: [rate({ id: "r1" })],
      settings: { overrideEnabled: true },
    });
    await assert.rejects(
      service.resolveOrderShipping({
        shippingRateId: "r1",
        subtotal: subtotal(100),
        weightGram: 50,
        countryCode: "US",
        fragile: false,
        oversized: false,
      }),
      /not available/,
    );
  });

  it("applies free shipping at or above the threshold and rejects other ids", async () => {
    const service = buildService({ rates: [rate({ id: "r1" })], settings: { freeShippingThreshold: 350 } });
    const free = await service.resolveOrderShipping({
      shippingRateId: "free-shipping",
      subtotal: subtotal(350),
      weightGram: 50,
      countryCode: "US",
      fragile: true,
      oversized: true,
    });
    assert.equal(free.shippingCost.toNumber(), 0);
    assert.equal(free.source, "FreeShipping");

    await assert.rejects(
      service.resolveOrderShipping({
        shippingRateId: "r1",
        subtotal: subtotal(400),
        weightGram: 50,
        countryCode: "US",
        fragile: false,
        oversized: false,
      }),
      /Free shipping applies/,
    );
  });

  it("rejects the synthetic free-shipping id below the threshold", async () => {
    const service = buildService({ rates: [rate({ id: "r1" })], settings: { freeShippingThreshold: 350 } });
    await assert.rejects(
      service.resolveOrderShipping({
        shippingRateId: "free-shipping",
        subtotal: subtotal(100),
        weightGram: 50,
        countryCode: "US",
        fragile: false,
        oversized: false,
      }),
      /not available/,
    );
  });

  it("adds handling, insurance, fragile and oversized fees to the selected rate", async () => {
    const service = buildService({ rates: [rate({ id: "r1" })] });
    const result = await service.resolveOrderShipping({
      shippingRateId: "r1",
      subtotal: subtotal(100),
      weightGram: 50,
      countryCode: "US",
      fragile: true,
      oversized: true,
    });
    assert.equal(result.shippingCost.toNumber(), 36); // 20 + 2 + 1 + 5 + 8
  });

  it("does not charge fragile/oversized fees when flags are false", async () => {
    const service = buildService({ rates: [rate({ id: "r1" })] });
    const result = await service.resolveOrderShipping({
      shippingRateId: "r1",
      subtotal: subtotal(100),
      weightGram: 50,
      countryCode: "US",
      fragile: false,
      oversized: false,
    });
    assert.equal(result.shippingCost.toNumber(), 23); // 20 + 2 + 1
  });

  it("rejects an inactive rate", async () => {
    const service = buildService({ rates: [rate({ id: "r1", isActive: false })] });
    await assert.rejects(
      service.resolveOrderShipping({
        shippingRateId: "r1",
        subtotal: subtotal(100),
        weightGram: 50,
        countryCode: "US",
        fragile: false,
        oversized: false,
      }),
      /not available/,
    );
  });

  it("rejects a rate whose weight range does not cover the parcel", async () => {
    const service = buildService({ rates: [rate({ id: "r1", maxWeightGram: 100 })] });
    await assert.rejects(
      service.resolveOrderShipping({
        shippingRateId: "r1",
        subtotal: subtotal(100),
        weightGram: 500,
        countryCode: "US",
        fragile: false,
        oversized: false,
      }),
      /not available/,
    );
  });

  it("rejects a rate that does not serve the destination country", async () => {
    const service = buildService({ rates: [rate({ id: "r1", region: "Indonesia" })] });
    await assert.rejects(
      service.resolveOrderShipping({
        shippingRateId: "r1",
        subtotal: subtotal(100),
        weightGram: 50,
        countryCode: "US",
        fragile: false,
        oversized: false,
      }),
      /not available/,
    );
  });

  it("auto-selects a matching rate when no id is sent", async () => {
    const service = buildService({
      rates: [rate({ id: "world", price: 30 }), rate({ id: "us", region: "US", price: 25 })],
    });
    const result = await service.resolveOrderShipping({
      subtotal: subtotal(100),
      weightGram: 50,
      countryCode: "US",
      fragile: false,
      oversized: false,
    });
    assert.equal(result.name, "Rate us");
  });

  it("throws when no rate matches the parcel", async () => {
    const service = buildService({ rates: [] });
    await assert.rejects(
      service.resolveOrderShipping({
        subtotal: subtotal(100),
        weightGram: 50,
        countryCode: "US",
        fragile: false,
        oversized: false,
      }),
      /No shipping rate/,
    );
  });
});

describe("ShippingService.quote", () => {
  it("keeps quote fees consistent with order resolution", async () => {
    const service = buildService({ rates: [rate({ id: "r1" })] });
    const quote = await service.quote({ weightGram: 50, subtotal: 100, countryCode: "US", fragile: true, oversized: true });
    const order = await service.resolveOrderShipping({
      shippingRateId: "r1",
      subtotal: subtotal(100),
      weightGram: 50,
      countryCode: "US",
      fragile: true,
      oversized: true,
    });
    assert.equal(quote.options[0].price, order.shippingCost.toNumber());
    assert.equal(quote.options[0].breakdown.insurance, 1);
  });
});
