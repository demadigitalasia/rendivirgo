import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeSeo, productSeoInput, type SeoInput } from "../lib/seo-analysis";
import { auditHtml, flagDuplicateMetadata, robotsAllowsPath, type HtmlAudit } from "../lib/seo-html";

const complete: SeoInput = {
  kind: "blog", title: "Indonesian Agate Care and Collection Guide", slug: "indonesian-agate-care",
  metaTitle: "Indonesian Agate Care | RENDI VIRGO",
  metaDescription: "Learn about Indonesian agate care, storage, and thoughtful collecting. Explore practical guidance for looking after your natural stone collection.",
  body: `Indonesian agate collection care.\n\n## Care and storage\n\n${Array.from({ length: 4 }, () => Array.from({ length: 80 }, (_, i) => `stone${i}`).join(" ")).join("\n\n")}\n\n[Browse the collection](/shop)`,
  images: [{ url: "/agate.webp", alt: "Green agate cabochon" }],
};

describe("editorial SEO scoring", () => {
  it("gives an empty draft no points and marks unassessable repetition for review", () => {
    const result = analyzeSeo({ kind: "page" });
    const repetition = result.checks.find(check => check.id === "repetition");
    assert.equal(result.score, 0);
    assert.equal(repetition?.max, 0);
    assert.equal(repetition?.status, "review");
  });
  it("recognizes complete content and gives actionable losses for missing metadata", () => {
    assert.ok(analyzeSeo(complete).score >= 95);
    const result = analyzeSeo({ ...complete, metaTitle: "", metaDescription: "" });
    assert.ok(result.score < 80);
    assert.equal(result.checks.find(check => check.id === "meta-description")?.points, 0);
  });
  it("does not impose article length or headings on category descriptions", () => {
    const result = analyzeSeo({ ...complete, kind: "category", body: Array(40).fill("agate").join(" ") });
    assert.equal(result.checks.find(check => check.id === "content")?.points, 5);
    assert.equal(result.checks.find(check => check.id === "content")?.max, 5);
    assert.equal(result.checks.some(check => check.id === "headings"), false);
  });
  it("handles Indonesian text and Unicode slugs", () => {
    const result = analyzeSeo({ ...complete, title: "Panduan Merawat Batu Akik Indonesia", slug: "batu-akik-indonesia", metaTitle: "Batu Akik Indonesia | RENDI VIRGO", metaDescription: "Panduan merawat batu akik Indonesia untuk kolektor. Pelajari cara menyimpan dan membersihkan koleksi batu alam dengan langkah yang mudah dipahami.", body: `## Batu akik\n\n${["akik", ...Array.from({length:320}, (_, i) => `batu${i}`)].join(" ")}\n\n[Koleksi](/shop)` });
    assert.ok((result.checks.find(check => check.id === "topic")?.points ?? 0) > 0);
    assert.equal(result.checks.find(check => check.id === "slug")?.points, 5);
  });
  it("does not impose a Google character limit on metadata and flags unsafe-looking slugs", () => {
    const result = analyzeSeo({ ...complete, metaDescription: "x".repeat(500), slug: "../bad?slug" });
    assert.equal(result.checks.find(check => check.id === "meta-description")?.points, 15);
    assert.ok((result.checks.find(check => check.id === "slug")?.points ?? 5) < 5);
    assert.match(result.checks.find(check => check.id === "meta-description")?.advice ?? "", /no fixed character limit/i);
  });
  it("normalizes every content type within 0–100 and treats the homepage root as valid", () => {
    for (const kind of ["product", "blog", "page", "category", "home"] as const) {
      for (const body of ["", "Agate", complete.body]) {
        const result = analyzeSeo({ ...complete, kind, body });
        assert.ok(result.score >= 0 && result.score <= 100);
      }
    }
    assert.equal(analyzeSeo({ kind: "home", slug: "" }).checks.find(check => check.id === "slug")?.points, 5);
  });
  it("uses the same product image fallback as the storefront", () => {
    const input = productSeoInput({ name: "Indonesian agate", slug: "agate", description: "Agate", seo: { metaTitle: null, metaDescription: null }, images: [{ url: "/agate.webp", alt: null }] });
    assert.equal(input.images?.[0].alt, "Indonesian agate");
  });
});

function htmlResult(path: string, locale: string, title: string, description: string): HtmlAudit {
  return { path, locale, title, description, score: 100, maxPoints: 100, applicableChecks: 3, label: "Good", tone: "green", checks: [
    { id: "title", label: "Title", points: 15, max: 15, advice: "", status: "pass" },
    { id: "description", label: "Description", points: 15, max: 15, advice: "", status: "pass" },
    { id: "other", label: "Other", points: 70, max: 70, advice: "", status: "pass" },
  ] };
}

function withDocumentParser<T>(run: () => T, languageLinks: Array<{ language: string; href: string }> = []): T {
  const tag = (name: string, text = "", attributes: Record<string, string> = {}) => ({
    tagName: name.toUpperCase(),
    textContent: text,
    getAttribute: (key: string) => attributes[key] ?? null,
    hasAttribute: (key: string) => key in attributes,
    querySelector: () => null,
  }) as unknown as Element;
  const title = tag("title", "About our studio");
  const description = tag("meta", "", { content: "A description of the RENDI VIRGO studio." });
  const canonical = tag("link", "", { href: "https://rendivirgo.com/about" });
  const headings = [tag("h1", "About RENDI VIRGO"), tag("h1", "Our studio")];
  const main = {
    querySelectorAll: (selector: string) => selector === "h1" || selector === "h1,h2,h3,h4,h5,h6" ? headings : [],
  } as unknown as HTMLElement;
  const document = {
    documentElement: { lang: "en" },
    body: main,
    querySelector: (selector: string) => selector === "main" ? main : null,
    querySelectorAll: (selector: string) => {
      if (selector === "title") return [title];
      if (selector === 'meta[name="description"]') return [description];
      if (selector === 'link[rel="canonical"]') return [canonical];
      if (selector === 'link[rel="alternate"][hreflang]') return languageLinks.map(link => tag("link", "", { rel: "alternate", hreflang: link.language, href: link.href }));
      if (selector === 'meta[property="og:title"]') return [tag("meta", "", { content: "About RENDI VIRGO" })];
      if (selector === 'meta[property="og:description"]') return [tag("meta", "", { content: "Studio information" })];
      if (selector === 'meta[property="og:image"]') return [tag("meta", "", { content: "/studio.webp" })];
      return [];
    },
  } as unknown as Document;
  const target = globalThis as unknown as { DOMParser?: typeof DOMParser };
  const previous = target.DOMParser;
  target.DOMParser = class { parseFromString() { return document; } } as unknown as typeof DOMParser;
  try { return run(); }
  finally {
    if (previous) target.DOMParser = previous;
    else delete target.DOMParser;
  }
}

describe("public HTML audit", () => {
  it("allows multiple H1 headings while requiring a main heading", () => {
    const result = withDocumentParser(() => auditHtml("fixture", "/about"));
    assert.equal(result.checks.find(check => check.id === "h1")?.points, 10);
  });
  it("checks localized alternate links against the sitemap language map", () => {
    const expected = [
      { language: "en", href: "https://rendivirgo.com/about" },
      { language: "id", href: "https://rendivirgo.com/id/about" },
    ];
    const result = withDocumentParser(() => auditHtml("fixture", "/about", "https://rendivirgo.com", true, expected), expected);
    assert.equal(result.checks.find(check => check.id === "hreflang")?.points, 5);
  });
  it("flags language alternates that are not reciprocal in the sitemap", () => {
    const expected = [{ language: "en", href: "https://rendivirgo.com/about" }];
    const result = withDocumentParser(() => auditHtml("fixture", "/about", "https://rendivirgo.com", true, expected, false), expected);
    assert.equal(result.checks.find(check => check.id === "hreflang")?.points, 0);
    assert.equal(result.checks.find(check => check.id === "hreflang")?.status, "action");
  });
});

describe("Googlebot robots.txt access", () => {
  it("follows the most specific rule and prefers Allow for equally specific rules", () => {
    const robots = `User-agent: *\nAllow: /\nDisallow: /private/\nDisallow: /private/*.pdf$\nAllow: /private/featured.pdf$\nDisallow: /same\nAllow: /same\n`;
    assert.equal(robotsAllowsPath(robots, "/shop/agate"), true);
    assert.equal(robotsAllowsPath(robots, "/private/guide.html"), false);
    assert.equal(robotsAllowsPath(robots, "/private/archive.pdf"), false);
    assert.equal(robotsAllowsPath(robots, "/private/featured.pdf"), true);
    assert.equal(robotsAllowsPath(robots, "/same"), true);
  });
  it("uses a specific Googlebot group over the wildcard group", () => {
    const robots = `User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n`;
    assert.equal(robotsAllowsPath(robots, "/shop/agate"), true);
  });
});

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
  it("groups language tags by primary language when finding duplicates", () => {
    const result = flagDuplicateMetadata([htmlResult("/a", "en", "Same title", "Same description"), htmlResult("/b", "en-GB", "same title", "Same description")]);
    assert.deepEqual(result.map(row => row.score), [70, 70]);
  });
});

 describe("content quality signals", () => {
 it("does not give repeated filler a perfect score", () => {
 const result = analyzeSeo({...complete, body: "## Care\n\n" + Array(320).fill("agate").join(" ") + "\n\n[Shop](/shop)"});
 assert.ok(result.score < 80);
 assert.equal(result.checks.find(c => c.id === "content")?.points, 0);
 });
 it("catches a repeated multi-word phrase, not only one repeated token", () => {
 const repeatedPhrase = Array(80).fill("rare translucent untreated crystalline specimen").join(" ");
 const result = analyzeSeo({...complete, body: `## Overview\n\n${repeatedPhrase}\n\n[Shop](/shop)`});
 assert.ok(result.score < 80);
 assert.equal(result.checks.find(c => c.id === "content")?.points, 0);
 });
 it("gives automatic image fallback only partial credit", () => {
 const result=analyzeSeo({...complete, images:[{url:"/a.webp",alt:"Agate",fallback:true}]});
 assert.ok(result.checks.find(c=>c.id==="images")!.points < result.checks.find(c=>c.id==="images")!.max);
 });
 });
