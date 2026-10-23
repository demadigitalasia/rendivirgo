import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeSeo, productSeoInput, type SeoInput } from "../lib/seo-analysis";
import { flagDuplicateMetadata, type HtmlAudit } from "../lib/seo-html";

const complete: SeoInput = {
  kind: "blog", title: "Indonesian Agate Care and Collection Guide", slug: "indonesian-agate-care",
  metaTitle: "Indonesian Agate Care | RENDI VIRGO",
  metaDescription: "Learn about Indonesian agate care, storage, and thoughtful collecting. Explore practical guidance for looking after your natural stone collection.",
  body: `Indonesian agate collection care.\n\n## Care and storage\n\n${Array.from({ length: 4 }, () => Array.from({ length: 80 }, (_, i) => `stone${i}`).join(" ")).join("\n\n")}\n\n[Browse the collection](/shop)`,
  images: [{ url: "/agate.webp", alt: "Green agate cabochon" }],
};

describe("editorial SEO scoring", () => {
  it("gives an empty draft no fabricated credit", () => assert.equal(analyzeSeo({ kind: "page" }).score, 0));
  it("recognizes complete content and gives actionable losses for missing metadata", () => {
    assert.equal(analyzeSeo(complete).score, 100);
    const result = analyzeSeo({ ...complete, metaTitle: "", metaDescription: "" });
    assert.ok(result.score < 80);
    assert.equal(result.checks.find(check => check.id === "meta-description")?.points, 0);
  });
  it("does not impose article length or headings on category descriptions", () => {
    const result = analyzeSeo({ ...complete, kind: "category", body: Array(40).fill("agate").join(" ") });
    assert.equal(result.checks.find(check => check.id === "content")?.points, 20);
    assert.equal(result.checks.some(check => check.id === "headings"), false);
  });
  it("handles Indonesian text and Unicode slugs", () => {
    const result = analyzeSeo({ ...complete, title: "Panduan Merawat Batu Akik Indonesia", slug: "batu-akik-indonesia", metaTitle: "Batu Akik Indonesia | RENDI VIRGO", metaDescription: "Panduan merawat batu akik Indonesia untuk kolektor. Pelajari cara menyimpan dan membersihkan koleksi batu alam dengan langkah yang mudah dipahami.", body: `## Batu akik\n\n${["akik", ...Array.from({length:320}, (_, i) => `batu${i}`)].join(" ")}\n\n[Koleksi](/shop)` });
    assert.equal(result.checks.find(check => check.id === "topic")?.points, 10);
    assert.equal(result.checks.find(check => check.id === "slug")?.points, 10);
  });
  it("flags overly long metadata and unsafe-looking slugs", () => {
    const result = analyzeSeo({ ...complete, metaDescription: "x".repeat(500), slug: "../bad?slug" });
    assert.equal(result.checks.find(check => check.id === "meta-description")?.points, 0);
    assert.ok((result.checks.find(check => check.id === "slug")?.points ?? 10) < 10);
  });
  it("normalizes every content type within 0–100 and treats the homepage root as valid", () => {
    for (const kind of ["product", "blog", "page", "category", "home"] as const) {
      for (const body of ["", "Agate", complete.body]) {
        const result = analyzeSeo({ ...complete, kind, body });
        assert.ok(result.score >= 0 && result.score <= 100);
      }
    }
    assert.equal(analyzeSeo({ kind: "home", slug: "" }).checks.find(check => check.id === "slug")?.points, 10);
  });
  it("uses the same product image fallback as the storefront", () => {
    const input = productSeoInput({ name: "Indonesian agate", slug: "agate", description: "Agate", seo: { metaTitle: null, metaDescription: null }, images: [{ url: "/agate.webp", alt: null }] });
    assert.equal(input.images?.[0].alt, "Indonesian agate");
  });
});

function htmlResult(path: string, locale: string, title: string, description: string): HtmlAudit {
  return { path, locale, title, description, score: 100, label: "Good", tone: "green", checks: [
    { id: "title", label: "Title", points: 15, max: 15, advice: "" },
    { id: "description", label: "Description", points: 15, max: 15, advice: "" },
    { id: "other", label: "Other", points: 70, max: 70, advice: "" },
  ] };
}
describe("metadata uniqueness across audited URLs", () => {
  it("penalizes duplicate metadata within the same language without mutating results", () => {
    const original = [htmlResult("/a", "en-GB", "Same title", "Same description"), htmlResult("/b", "en-GB", "same title", "Same description")];
    const results = flagDuplicateMetadata(original);
    assert.deepEqual(results.map(result => result.score), [70, 70]);
    assert.equal(original[0].score, 100);
    assert.equal(flagDuplicateMetadata(results)[0].score, 70);
  });
  it("does not misclassify translations as same-language duplicates", () => {
    const result = flagDuplicateMetadata([htmlResult("/a", "en-GB", "Agate", "Care"), htmlResult("/id/a", "id-ID", "Agate", "Care")]);
    assert.deepEqual(result.map(row => row.score), [100, 100]);
  });
});

 describe("content quality signals", () => {
 it("does not give repeated filler a perfect score", () => {
 const result = analyzeSeo({...complete, body: "## Care\n\n" + Array(320).fill("agate").join(" ") + "\n\n[Shop](/shop)"});
 assert.ok(result.score < 80);
 assert.equal(result.checks.find(c => c.id === "content")?.points, 0);
 });
 it("gives automatic image fallback only partial credit", () => {
 const result=analyzeSeo({...complete, images:[{url:"/a.webp",alt:"Agate",fallback:true}]});
 assert.ok(result.checks.find(c=>c.id==="images")!.points < 5);
 });
 });
