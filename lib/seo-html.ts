import { seoRating, type SeoCheck } from "./seo-analysis";

export type HtmlAudit = {
  path: string; title: string; description: string; locale: string;
  score: number; maxPoints: number; applicableChecks: number; checks: SeoCheck[]; label: string; tone: "green" | "amber" | "red";
};
export type HreflangAlternate = { language: string; href: string };

type RobotsRule = { allow: boolean; pattern: string; specificity: number };
type RobotsGroup = { agents: string[]; rules: RobotsRule[] };

/** Evaluate the common Allow/Disallow path rules used by Googlebot. */
export function robotsAllowsPath(content: string, path: string): boolean {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  const finish = () => {
    if (current?.agents.length) groups.push(current);
    current = null;
  };
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) {
      if (current?.rules.length) finish();
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (directive === "user-agent") {
      if (current?.rules.length) finish();
      current ??= { agents: [], rules: [] };
      if (value) current.agents.push(value.toLowerCase());
    } else if ((directive === "allow" || directive === "disallow") && value && current?.agents.length) {
      current.rules.push({ allow: directive === "allow", pattern: value, specificity: value.replace(/[\*$]/g, "").length });
    }
  }
  finish();

  const matchingGroups = groups.filter(group => group.agents.some(agent => agent === "googlebot"));
  const applicable = matchingGroups.length ? matchingGroups : groups.filter(group => group.agents.some(agent => agent === "*"));
  const rules = applicable.flatMap(group => group.rules);
  const candidate = new URL(path, "https://robots.invalid");
  const target = `${candidate.pathname}${candidate.search}`;
  const matched = rules.filter(rule => {
    const anchored = rule.pattern.endsWith("$");
    const pattern = anchored ? rule.pattern.slice(0, -1) : rule.pattern;
    const source = `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}${anchored ? "$" : ""}`;
    try { return new RegExp(source).test(target); } catch { return false; }
  }).sort((a, b) => b.specificity - a.specificity);
  if (!matched.length) return true;
  const highestSpecificity = matched[0].specificity;
  return matched.some(rule => rule.specificity === highestSpecificity && rule.allow);
}

/** Parse inert fetched HTML; never insert or execute the fetched document. */
export function auditHtml(html: string, path: string, siteOrigin = "https://rendivirgo.com", robotsAllowed?: boolean, expectedAlternates?: HreflangAlternate[], sitemapAlternatesReciprocal = true): HtmlAudit {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // React can append resolved metadata after the initial document shell.
  const last = (selector: string) => Array.from(doc.querySelectorAll(selector)).at(-1);
  const title = last("title")?.textContent?.trim() ?? "";
  const description = last('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";
  const main = doc.querySelector("main") ?? doc.body;
  const checks: SeoCheck[] = [];
  const add = (id: string, label: string, ok: boolean, max: number, advice: string) => checks.push({ id, label, points: ok ? max : 0, max, advice, status: ok ? "pass" : "action" });
  add("title", "Search title present", title.length > 0, 15, title ? `Search title is present (${title.length} characters). Review clarity and page uniqueness; Google does not set a fixed title-length limit.` : "Add a descriptive page title.");
  add("description", "Search description present", description.length > 0, 15, description ? `Search description is present (${description.length} characters). Review accuracy and usefulness; Google may choose a different snippet.` : "Add a concise description that accurately summarizes this page.");
  const h1s = main.querySelectorAll("h1");
  add("h1", "Main heading", Array.from(h1s).some(heading => Boolean(heading.textContent?.trim())), 10, `Found ${h1s.length} H1 headings. Use a clear main heading and logical sections; Google does not require exactly one H1.`);
  const canonicals = Array.from(doc.querySelectorAll('link[rel="canonical"]')).map(link => link.getAttribute("href") ?? "");
  const currentUrl = new URL(path, siteOrigin);
  const expectedCanonical = new URL(currentUrl.pathname, siteOrigin);
  const queryEntries = [...currentUrl.searchParams.entries()];
  const meaningfulEntries = queryEntries.filter(([key, value]) => {
    if (/^utm_/i.test(key) || ["gclid", "fbclid"].includes(key.toLowerCase()) || value === "") return false;
    if (key === "page" && Number(value) <= 1) return false;
    if (["category", "stone", "price", "weight", "origin"].includes(key) && value === "all") return false;
    return !(key === "sort" && value === "featured");
  });
  const isShopFacet = /^\/(?:id\/)?shop\/?$/i.test(currentUrl.pathname) && meaningfulEntries.some(([key]) => key !== "page");
  if (isShopFacet) {
    // Search and faceted shop URLs consolidate to the unfiltered collection.
  } else {
    const pageValues = meaningfulEntries.filter(([key]) => key === "page");
    const hasOnlyDefaultPage = pageValues.length === 1 && Number(pageValues[0][1]) <= 1;
    for (const [key, value] of meaningfulEntries) {
      if (hasOnlyDefaultPage && key === "page") continue;
      expectedCanonical.searchParams.append(key, value);
    }
  }
  expectedCanonical.searchParams.sort();
  let canonicalOk = false;
  try {
    const url = new URL(canonicals[0] ?? "");
    url.searchParams.sort();
    const normalizedPath = (value: string) => value.replace(/\/$/, "") || "/";
    canonicalOk = canonicals.length === 1 && url.origin === new URL(siteOrigin).origin &&
      normalizedPath(url.pathname) === normalizedPath(expectedCanonical.pathname) && url.search === expectedCanonical.search;
  } catch { /* invalid URL */ }
  add("canonical", "Canonical URL", canonicalOk, 10, isShopFacet ? "Filtered shop URLs should consolidate to the unfiltered /shop page." : "Declare one absolute canonical URL that matches this page, including meaningful pagination or article filters. Tracking parameters are ignored.");
  const robots = Array.from(doc.querySelectorAll('meta[name="robots"], meta[name="googlebot"]')).map(meta => meta.getAttribute("content") ?? "").join(",");
  add("indexable", "Indexing directive", !/\b(?:noindex|none)\b/i.test(robots), 10, "This page has a noindex meta directive. Review the intended indexing status; crawler access is checked separately.");
  if (robotsAllowed === undefined) {
    checks.push({ id: "robots-policy", label: "robots.txt access", points: 0, max: 0, status: "review", advice: "robots.txt policy was not supplied to this page audit; review crawler access separately." });
  } else {
    add("robots-policy", "robots.txt access", robotsAllowed, 5, robotsAllowed ? "Googlebot is allowed to crawl this URL under the retrieved robots.txt rules." : "The retrieved robots.txt rules disallow Googlebot from this sitemap URL.");
  }
  if (!expectedAlternates?.length) {
    checks.push({ id: "hreflang", label: "Localized alternate links", points: 0, max: 0, status: "review", advice: "No language alternates were supplied by the sitemap; verify whether this page has translated equivalents." });
  } else {
    const alternateLinks = Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]'));
    const expected = new Map(expectedAlternates.map(item => [item.language.toLowerCase(), item.href]));
    const actual = new Map<string, string>();
    let valid = true;
    for (const link of alternateLinks) {
      const language = link.getAttribute("hreflang")?.trim().toLowerCase() ?? "";
      const href = link.getAttribute("href")?.trim() ?? "";
      if (!/^(?:x-default|[a-z]{2,3}(?:-[a-z0-9]{2,8})*)$/i.test(language) || !href || actual.has(language)) {
        valid = false;
        continue;
      }
      try {
        const url = new URL(href, siteOrigin);
        if (!["http:", "https:"].includes(url.protocol)) valid = false;
        url.hash = "";
        url.searchParams.sort();
        actual.set(language, url.href);
      } catch { valid = false; }
    }
    const normalizedExpected = (value: string) => {
      const url = new URL(value, siteOrigin);
      url.hash = "";
      url.searchParams.sort();
      return url.href;
    };
    const hasUnexpectedLanguages = [...actual.keys()].some(language => language !== "x-default" && !expected.has(language));
    const match = valid && sitemapAlternatesReciprocal && expected.size === expectedAlternates.length && !hasUnexpectedLanguages && [...expected].every(([language, href]) => actual.get(language) === normalizedExpected(href));
    add("hreflang", "Localized alternate links", match, 5, match ? "HTML language alternates match reciprocal sitemap declarations." : "HTML language alternates are invalid, differ from the sitemap, or are not reciprocal in the sitemap.");
  }
  const images = Array.from(main.querySelectorAll("img"));
  add("alt", "Image alt attributes", images.every(img => img.hasAttribute("alt")), 10, "Every image has an alt attribute. Empty alt is appropriate for decorative images; manually confirm that informative images have useful descriptions.");
  const headingLevels = Array.from(main.querySelectorAll("h1,h2,h3,h4,h5,h6")).map(h => Number(h.tagName.slice(1)));
  add("structure", "Heading hierarchy", headingLevels.length > 0 && headingLevels[0] === 1 && headingLevels.every((level, i) => i === 0 || level <= headingLevels[i - 1] + 1), 5, "Start the main content with its H1, then use heading levels in a logical order without skipping levels.");
  const links = Array.from(main.querySelectorAll("a[href]"));
  add("links", "Link labels present", links.length > 0 && links.every(a => Boolean(a.textContent?.trim() || a.getAttribute("aria-label")?.trim() || a.querySelector("img[alt]")?.getAttribute("alt")?.trim())), 5, "This checks that links have a non-empty text or accessible label. Review manually that the label describes the destination.");
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
  const hasText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
  const hasImage = (value: unknown): boolean => hasText(value) || Array.isArray(value) && value.some(hasImage) || Boolean(value && typeof value === "object" && hasText((value as Record<string, unknown>).url));
  const hasAuthor = (value: unknown): boolean => hasText(value) || Array.isArray(value) && value.some(hasAuthor) || Boolean(value && typeof value === "object" && hasText((value as Record<string, unknown>).name));
  const offerPrice = typeof offer?.price === "number" ? offer.price : typeof offer?.price === "string" ? Number(offer.price) : Number.NaN;
  const validOffer = Number.isFinite(offerPrice) && offerPrice >= 0 && typeof offer?.priceCurrency === "string" && /^[A-Z]{3}$/.test(offer.priceCurrency) && hasText(offer.availability);
  const validUrl = (value: unknown) => {
    if (!hasText(value)) return false;
    try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
  };
  const fieldsOk = expectedSchema === "Product" ? Boolean(hasText(typed?.name) && hasImage(typed?.image) && offer && validOffer) : expectedSchema === "Article" ? Boolean(hasText(typed?.headline) && hasAuthor(typed?.author) && hasText(typed?.datePublished) && !Number.isNaN(Date.parse(typed.datePublished))) : expectedSchema === "Organization" ? Boolean(hasText(typed?.name) && validUrl(typed.url)) : true;
  add("schema", "Structured data syntax, type and basic fields", !invalidSchema && (!expectedSchema || types.includes(expectedSchema) && fieldsOk), 10, `Check JSON-LD syntax${expectedSchema ? `, ${expectedSchema} type, and basic fields (Product: name/image/offer price/currency/availability; Article: headline/author/datePublished; Organization: name/url)` : ""}. This is not full Google rich-result validation.`);
  add("social", "Social preview metadata", ["og:title", "og:description", "og:image"].every(property => Boolean(last(`meta[property="${property}"]`)?.getAttribute("content"))), 5, "Provide Open Graph title, description, and an image for link previews.");
  const locale = doc.documentElement.lang;
  add("language", "Document language", Boolean(locale) && (/^\/id(?:\/|$)/.test(path) ? locale.startsWith("id") : locale.startsWith("en")), 5, "Declare the HTML language corresponding to this URL.");
  const maxPoints = checks.reduce((sum, check) => sum + check.max, 0);
  const applicableChecks = checks.filter(check => check.max > 0).length;
  const score = maxPoints ? Math.round(checks.reduce((sum, check) => sum + check.points, 0) / maxPoints * 100) : 0;
  return { path, title, description, locale, checks, score, maxPoints, applicableChecks, ...seoRating(score) };
}

export function flagDuplicateMetadata(results: HtmlAudit[]): HtmlAudit[] {
  const counts = new Map<string, number>();
  const keyFor = (result: HtmlAudit, field: "title" | "description") => {
    const primaryLanguage = result.locale.toLowerCase().split("-")[0];
    const normalizedValue = result[field].toLowerCase().replace(/\s+/g, " ").trim();
    return JSON.stringify([primaryLanguage, field, normalizedValue]);
  };
  for (const result of results) for (const field of ["title", "description"] as const) {
    if (result[field]) { const key = keyFor(result, field); counts.set(key, (counts.get(key) ?? 0) + 1); }
  }
  return results.map(result => {
    const checks = result.checks.map(check => {
      const field = check.id === "title" ? "title" : check.id === "description" ? "description" : null;
      if (!field || !result[field]) return check;
      const count = counts.get(keyFor(result, field)) ?? 0;
      return count > 1 ? { ...check, points: 0, status: "action" as const, advice: `Duplicate ${field} on ${count} scanned URLs in this language. Write page-specific metadata.` } : check;
    });
    const maxPoints = checks.reduce((sum, check) => sum + check.max, 0);
    const applicableChecks = checks.filter(check => check.max > 0).length;
    const score = maxPoints ? Math.round(checks.reduce((sum, check) => sum + check.points, 0) / maxPoints * 100) : 0;
    return { ...result, checks, score, maxPoints, applicableChecks, ...seoRating(score) };
  });
}
