import { seoRating, type SeoCheck } from "./seo-analysis";

export type HtmlAudit = {
  path: string; title: string; description: string; locale: string;
  score: number; checks: SeoCheck[]; label: string; tone: "green" | "amber" | "red";
};

/** Parse inert fetched HTML; never insert or execute the fetched document. */
export function auditHtml(html: string, path: string, siteOrigin = "https://rendivirgo.com"): HtmlAudit {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // React can append resolved metadata after the initial document shell.
  const last = (selector: string) => Array.from(doc.querySelectorAll(selector)).at(-1);
  const title = last("title")?.textContent?.trim() ?? "";
  const description = last('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";
  const main = doc.querySelector("main") ?? doc.body;
  const checks: SeoCheck[] = [];
  const add = (id: string, label: string, ok: boolean, max: number, advice: string) => checks.push({ id, label, points: ok ? max : 0, max, advice });
  add("title", "Search title", title.length > 0 && title.length <= 75, 15, `Use a unique descriptive title. Current length: ${title.length}. Length is an editorial guide, not a Google limit.`);
  add("description", "Search description", description.length > 0 && description.length <= 200, 15, `Provide a unique, accurate description. Current length: ${description.length}.`);
  const h1s = main.querySelectorAll("h1");
  add("h1", "One clear main heading", h1s.length === 1 && Boolean(h1s[0]?.textContent?.trim()), 10, `Found ${h1s.length} H1 headings; use one descriptive page heading.`);
  const canonicals = [...new Set(Array.from(doc.querySelectorAll('link[rel="canonical"]')).map(link => link.getAttribute("href") ?? ""))];
  let canonicalOk = false;
  try { const url = new URL(canonicals[0] ?? ""); canonicalOk = canonicals.length === 1 && url.origin === new URL(siteOrigin).origin && url.pathname.replace(/\/$/, "") === path.split("?")[0].replace(/\/$/, ""); } catch { /* invalid URL */ }
  add("canonical", "Canonical URL", canonicalOk, 10, "Declare one absolute canonical URL matching this page's path. Review query-string pagination separately.");
  const robots = Array.from(doc.querySelectorAll('meta[name="robots"], meta[name="googlebot"]')).map(meta => meta.getAttribute("content") ?? "").join(",");
  add("indexable", "Indexable public page", !/\b(?:noindex|none)\b/i.test(robots), 10, "This sitemap URL has noindex. Remove it from the sitemap or review its intended indexing status.");
  const images = Array.from(main.querySelectorAll("img"));
  add("alt", "Image accessibility", images.every(img => img.hasAttribute("alt")), 10, "Every content image needs an alt attribute. Empty alt is appropriate for intentionally decorative images.");
  const headingLevels = Array.from(main.querySelectorAll("h1,h2,h3,h4,h5,h6")).map(h => Number(h.tagName.slice(1)));
  add("structure", "Heading hierarchy", headingLevels.every((level, i) => i === 0 || level <= headingLevels[i - 1] + 1), 5, "Use heading levels in a logical order without skipping levels.");
  const links = Array.from(main.querySelectorAll("a[href]"));
  add("links", "Descriptive links", links.length > 0 && links.every(a => Boolean(a.textContent?.trim() || a.getAttribute("aria-label")?.trim() || a.querySelector("img[alt]")?.getAttribute("alt")?.trim())), 5, "Use crawlable links with descriptive text, image alt, or an accessible label.");
  const schemas: unknown[] = [];
  let invalidSchema = false;
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) { try { schemas.push(JSON.parse(script.textContent ?? "")); } catch { invalidSchema = true; } }
  const expectedSchema = /^\/(?:id\/)?shop\/[^/]+\/[^/]+/.test(path) ? "Product" : /^\/(?:id\/)?blog\/[^/?]+/.test(path) ? "Article" : /^\/(?:id\/?)?$/.test(path) ? "Organization" : null;
  const types: string[] = [];
  const schemaObjects: Record<string, unknown>[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") { const obj = value as Record<string, unknown>; schemaObjects.push(obj); if (typeof obj["@type"] === "string") types.push(obj["@type"]); else if (Array.isArray(obj["@type"])) types.push(...obj["@type"].filter((t): t is string => typeof t === "string")); if (obj["@graph"]) visit(obj["@graph"]); }
  };
  schemas.forEach(visit);
  const typed = schemaObjects.find(obj => obj["@type"] === expectedSchema || Array.isArray(obj["@type"]) && obj["@type"].includes(expectedSchema));
  const offer = typed?.offers && typeof typed.offers === "object" ? (Array.isArray(typed.offers) ? typed.offers[0] : typed.offers) as Record<string, unknown> : null;
  const fieldsOk = expectedSchema === "Product" ? Boolean(typed?.name && typed.image && offer && offer.price !== undefined && offer.priceCurrency && offer.availability) : expectedSchema === "Article" ? Boolean(typed?.headline && typed.author && typed.datePublished) : expectedSchema === "Organization" ? Boolean(typed?.name && typed.url) : true;
  add("schema", "Structured data syntax, type and basic fields", !invalidSchema && (!expectedSchema || types.includes(expectedSchema) && fieldsOk), 10, `Check JSON-LD syntax${expectedSchema ? `, ${expectedSchema} type, and basic fields (Product: name/image/offer price/currency/availability; Article: headline/author/datePublished; Organization: name/url)` : ""}. This is not full Google rich-result validation.`);
  add("social", "Social preview metadata", ["og:title", "og:description", "og:image"].every(property => Boolean(last(`meta[property="${property}"]`)?.getAttribute("content"))), 5, "Provide Open Graph title, description, and an image for link previews.");
  const locale = doc.documentElement.lang;
  add("language", "Document language", Boolean(locale) && (/^\/id(?:\/|$)/.test(path) ? locale.startsWith("id") : locale.startsWith("en")), 5, "Declare the HTML language corresponding to this URL.");
  const score = checks.reduce((sum, check) => sum + check.points, 0);
  return { path, title, description, locale, checks, score, ...seoRating(score) };
}

export function flagDuplicateMetadata(results: HtmlAudit[]): HtmlAudit[] {
  const counts = new Map<string, number>();
  const keyFor = (result: HtmlAudit, field: "title" | "description") => JSON.stringify([result.locale, field, result[field].toLowerCase()]);
  for (const result of results) for (const field of ["title", "description"] as const) {
    if (result[field]) { const key = keyFor(result, field); counts.set(key, (counts.get(key) ?? 0) + 1); }
  }
  return results.map(result => {
    const checks = result.checks.map(check => {
      const field = check.id === "title" ? "title" : check.id === "description" ? "description" : null;
      if (!field || !result[field]) return check;
      const count = counts.get(keyFor(result, field)) ?? 0;
      return count > 1 ? { ...check, points: 0, advice: `Duplicate ${field} on ${count} scanned URLs in this language. Write page-specific metadata.` } : check;
    });
    const score = checks.reduce((sum, check) => sum + check.points, 0);
    return { ...result, checks, score, ...seoRating(score) };
  });
}
