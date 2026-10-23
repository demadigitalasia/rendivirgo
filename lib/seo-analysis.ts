/** Editorial heuristics, inspired by Yoast. Not a search-engine ranking score. */
export type SeoKind = "product" | "blog" | "page" | "category" | "home";
export type SeoInput = {
  kind: SeoKind;
  publicPath?: string;
  focusTopic?: string;
  title?: string | null;
  slug?: string | null;
  body?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  images?: Array<{ url?: string | null; alt?: string | null; fallback?: boolean; decorative?: boolean }>;
};
export type SeoCheck = { id: string; label: string; points: number; max: number; advice: string };
export type SeoResult = { score: number; checks: SeoCheck[]; words: number; label: string; tone: "green" | "amber" | "red" };

export function seoRating(score: number) {
  return score >= 80 ? { label: "Good", tone: "green" as const } : score >= 50 ? { label: "Needs work", tone: "amber" as const } : { label: "Needs attention", tone: "red" as const };
}

export function plainText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/(?:^|\n)\s*:::.*|[#*_~>`]/g, " ").replace(/&(?:nbsp|amp|lt|gt|quot|#\d+);/g, " ").replace(/\s+/g, " ").trim();
}

export function analyzeSeo(input: SeoInput): SeoResult {
  const title = input.title?.trim() ?? "";
  const metaTitle = input.metaTitle?.trim() ?? "";
  const description = input.metaDescription?.trim() ?? "";
  const body = input.body ?? "";
  const text = plainText(body);
  const words = text ? text.split(/\s+/u).length : 0;
  const checks: SeoCheck[] = [];
  const add = (id: string, label: string, ratio: number, max: number, advice: string) => checks.push({ id, label, points: Math.round(ratio * max), max, advice });
  add("title", "Descriptive page title", title.length >= 10 && title.length <= 200 ? 1 : title.length >= 2 ? 0.5 : 0, 10, "Use a specific title that clearly identifies this content.");
  add("meta-title", "SEO title", metaTitle.length >= 30 && metaTitle.length <= 60 ? 1 : metaTitle.length > 0 && metaTitle.length <= 75 ? 0.5 : 0, 15, `Write a unique SEO title; 30–60 characters is an editorial guide (${metaTitle.length} now), not a Google limit.`);
  add("meta-description", "Meta description", description.length >= 120 && description.length <= 160 ? 1 : description.length > 0 && description.length <= 200 ? 0.5 : 0, 15, `Summarize the page accurately in roughly 120–160 characters (${description.length} now). Google may show a different snippet.`);
  const slug = input.slug?.trim() ?? "";
  add("slug", "Readable URL", input.kind === "home" || /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug) && slug.length <= 90 ? 1 : slug ? 0.5 : 0, 10, "Use a short descriptive slug, with words separated by hyphens. Changing an existing URL requires a redirect.");
  const target = { product: 100, blog: 300, page: 150, category: 35, home: 100 }[input.kind];
  add("content", "Useful content", words >= target ? 1 : words >= target / 2 ? 0.5 : 0, 20, `${words} words. Aim for about ${target}+ useful words for this content type when appropriate. Length alone does not improve rankings; avoid filler.`);
  const topic = (input.focusTopic || title).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)?.filter(word => !["the", "and", "for", "with", "from", "rendi", "virgo", "dan", "yang", "untuk", "dari"].includes(word)) ?? [];
  const hasTopic = (value: string) => {
    const words = new Set(value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
    return topic.length > 0 && topic.some(word => words.has(word));
  };
  add("topic", "Consistent topic", hasTopic(text) && hasTopic(metaTitle) && hasTopic(description) ? 1 : hasTopic(text) ? 0.5 : 0, 10, "Use the main subject from the page title naturally in the body, SEO title, and description. Do not repeat keywords excessively.");
  const paragraphs = body.split(/\n\s*\n/).filter(part => plainText(part).length);
  const longParagraph = paragraphs.some(part => plainText(part).split(/\s+/).length > 150);
  add("readability", "Readable structure", text && !longParagraph ? 1 : text ? 0.5 : 0, 5, "Break long passages into short paragraphs that are easy to scan.");
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const counts = new Map<string, number>();
  tokens.forEach(token => counts.set(token, (counts.get(token) ?? 0) + 1));
  if (tokens.length >= 50 && Math.max(0, ...counts.values()) / tokens.length > 0.2) {
    for (const check of checks) if (["content", "topic", "readability"].includes(check.id)) { check.points = 0; check.advice = "One word makes up over 20% of this text. Review repetition and usefulness before publishing."; }
  }
  if (input.kind === "blog" || input.kind === "page") {
    add("headings", "Section headings", /^\s*#{2,3}\s+\S/m.test(body) || /<h[23][\s>]/i.test(body) ? 1 : 0, 5, "Organize the body with meaningful H2/H3 headings (## / ###). The page title already supplies H1.");
    add("links", "Relevant internal link", /\[[^\]]+\]\(\/(?!\/)[^)]+\)/.test(body) || /href=["']\/(?!\/)/.test(body) ? 1 : 0, 5, "Add a useful internal link to an existing related article, product, or category where it helps readers.");
  }
  if (["product", "blog", "category", "home"].includes(input.kind)) {
    const images = input.images?.filter(image => image.url?.trim()) ?? [];
    const informative = images.filter(image => !image.decorative);
    const repeated = informative.length > 1 && new Set(informative.map(image => image.alt?.trim().toLowerCase())).size < informative.length;
    const complete = images.length && images.every(image => image.decorative || image.alt?.trim() && !image.fallback) && !repeated;
    add("images", "Image and alternative text", complete ? 1 : images.length ? 0.5 : 0, input.kind === "blog" ? 5 : 15, "Describe each content image specifically. Automatic title fallbacks and repeated alt text receive partial credit; decorative images may intentionally use empty alt text.");
  }
  const max = checks.reduce((sum, check) => sum + check.max, 0);
  const score = Math.round(checks.reduce((sum, check) => sum + check.points, 0) / max * 100);
  return { score, checks, words, ...seoRating(score) };
}

/** Adapters keep saved-list scores and editor scores on the same inputs. */
export function productSeoInput(p: { name: string; slug: string; description: string; seo: { metaTitle: string | null; metaDescription: string | null }; images: Array<{ url: string; alt?: string | null }> }): SeoInput {
  return { kind: "product", title: p.name, slug: p.slug, body: p.description, ...p.seo, images: p.images.map(image => ({ ...image, alt: image.alt || p.name, fallback: !image.alt?.trim() })) };
}
export function contentSeoInput(p: { title: string; slug: string; body?: string; metaTitle: string | null; metaDescription: string | null; coverImage?: string | null; coverAlt?: string | null }, kind: "blog" | "page"): SeoInput {
  return { kind, ...p, images: kind === "blog" ? [{ url: p.coverImage, alt: p.coverAlt }] : undefined };
}
