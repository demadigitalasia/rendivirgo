import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import defaults from "./hero-defaults.json";
import { SaveHeroSlidesDto } from "./hero-slides.dto";
import { HeroSlidesService } from "./hero-slides.service";

const document = () => plainToInstance(SaveHeroSlidesDto, structuredClone(defaults));
const context = { adminId: "fixture-admin", ip: null, userAgent: null };
const audit = { log: async () => undefined };

describe("Home hero content publication", () => {
  it("validates the starter content and rejects missing nested content or out-of-range settings", async () => {
    assert.deepEqual(await validate(document()), []);
    for (const changed of [ { ...document(), settings: undefined }, { ...document(), settings: { ...document().settings, duration: 2 } }, { ...document(), slides: [{ ...document().slides[0], en: undefined }] } ]) {
      assert.ok((await validate(plainToInstance(SaveHeroSlidesDto, changed))).length > 0);
    }
  });
  it("rejects zero or more than five active slides before writing", async () => {
    const service = new HeroSlidesService({} as never, audit as never);
    for (const count of [0,6]) {
      const input = document();
      input.slides = Array.from({length:count || 1},(_,i) => ({ ...input.slides[0], id: `slide-${i}`, isActive: count > 0 }));
      await assert.rejects(service.save(input, context), /between 1 and 5/);
    }
  });
  it("rejects unsafe image and button URLs", async () => {
    const service = new HeroSlidesService({} as never, audit as never);
    for (const url of ["javascript:alert(1)", "//untrusted.example", "/\\untrusted.example", "data:text/html,test"]) {
      const input = document(); input.slides[0].ctaHref = url;
      await assert.rejects(service.save(input, context), /site path or HTTPS/);
      input.slides[0].ctaHref = "/shop"; input.slides[0].imageUrl = url;
      await assert.rejects(service.save(input, context), /Invalid image URL/);
    }
  });
  it("requires complete Indonesian content for a Ready translation", async () => {
    const service = new HeroSlidesService({} as never, audit as never);
    const input = document(); input.slides[0].idCopy.ctaLabel = "";
    await assert.rejects(service.save(input, context), /Complete the Indonesian translation/);
  });
  it("rejects an outdated editor version before modifying banners", async () => {
    const service = new HeroSlidesService({ $transaction: async (operation: (tx: unknown) => unknown) => operation({ siteSetting: { findUnique: async () => ({ updatedAt: new Date("2026-10-25T00:00:00Z") }) } }) } as never, audit as never);
    await assert.rejects(service.save(document(), context), /changed in another session/);
  });
  it("preserves the legacy hero and imports unused banners as drafts", async () => {
    const service = new HeroSlidesService({
      siteSetting: { findUnique: async () => null, findMany: async () => [{ key: "home.heroTitle", value: "My existing hero" }, { key: "home.heroImage", value: "/images/original.webp" }] },
      banner: { findMany: async () => [{ id: "legacy-banner", title: "Old banner", imageUrl: "/old.webp" }] },
      product: { findFirst: async () => ({ id: "featured-product" }) },
    } as never, audit as never);
    const result = await service.getAdmin();
    assert.equal(result.slides[0].en.title, "My existing hero");
    assert.equal(result.slides[0].imageUrl, "/images/original.webp");
    assert.equal(result.slides[0].translationStatus, "Review");
    assert.equal(result.slides[0].productId, "featured-product");
    assert.equal(result.slides.filter(slide => slide.isActive).length, 4);
    assert.equal(result.slides[4].id, "legacy-banner");
    assert.equal(result.slides[4].isActive, false);
  });
  it("excludes drafts, falls back as a complete language, and resolves live product prices", async () => {
    const source = document(); source.slides[1].isActive = false; source.slides[0].translationStatus = "Review"; source.slides[0].productId = "selected-product";
    const service = new HeroSlidesService({
      siteSetting: { findUnique: async () => ({ updatedAt: new Date(), value: { settings: source.settings } }) },
      banner: { findMany: async () => source.slides.map(slide => ({ id: slide.id, isActive: slide.isActive, heroContent: slide })) },
      product: { findMany: async () => [{ id: "selected-product", name: "Live product", nameId: "Produk", idTranslationStatus: "Ready", price: "123.45", stoneType: "Agate", origin: "Java, Indonesia", category: { slug: "cabochons" }, slug: "live-product" }] },
    } as never, audit as never);
    const result = await service.getPublic();
    assert.equal(result.slides.length, 3);
    assert.deepEqual(result.slides[0].idCopy, result.slides[0].en);
    assert.equal(result.slides[0].product?.price, 123.45);
    assert.equal(result.slides[0].product?.href, "/shop/cabochons/live-product");
  });
});
