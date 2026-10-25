import { extractBlogBodyImages } from "@/lib/blog-images";

/** Editorial heuristics, inspired by Yoast. Not a search-engine ranking score. */
export type SeoKind = "product" | "blog" | "page" | "category" | "home";
export type SeoInput = {
  kind: SeoKind;
  publicPath?: string;
  publicTitleFallback?: string | null;
  publicDescriptionFallback?: string | null;
  focusTopic?: string;
  title?: string | null;
  slug?: string | null;
  body?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  images?: Array<{ url?: string | null; alt?: string | null; fallback?: boolean; decorative?: boolean }>;
};
export type SeoCheckStatus = "pass" | "review" | "action";
export type SeoCheck = { id: string; label: string; points: number; max: number; advice: string; status: SeoCheckStatus };
export type SeoResult = { score: number; checks: SeoCheck[]; words: number; maxPoints: number; applicableChecks: number; label: string; tone: "green" | "amber" | "red" };

export function needsSeoReview(check: SeoCheck) {
  return check.status !== "pass";
}

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
  const add = (id: string, label: string, ratio: number, max: number, advice: string, status?: SeoCheckStatus) => {
    const points = Math.round(ratio * max);
    checks.push({ id, label, points, max, advice, status: status ?? (max === 0 ? "review" : points === max ? "pass" : points > 0 ? "review" : "action") });
  };
  add("title", "Page title present", title ? 1 : 0, 10, "Use a unique, concise title that describes the page. Google may choose other page text for the result title.");
  add("meta-title", "SEO title present", metaTitle ? 1 : 0, 15, `Write a unique, page-specific SEO title (${metaTitle.length} characters). Google has no fixed character limit and may truncate or rewrite it for display.`);
  add("meta-description", "Meta description present", description ? 1 : 0, 15, `Summarize this page accurately (${description.length} characters). Google has no fixed character limit and may generate a different search snippet.`);
  const slug = input.slug?.trim() ?? "";
  add("slug", "Readable URL", input.kind === "home" || /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug) ? 1 : slug ? 0.5 : 0, 5, "Use readable words separated by hyphens. URL keywords alone have little ranking impact; changing an existing URL requires a redirect.");
  const target = { product: 100, blog: 300, page: 150, category: 35, home: 100 }[input.kind];
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const counts = new Map<string, number>();
  tokens.forEach(token => counts.set(token, (counts.get(token) ?? 0) + 1));
  let repetition: number | null = null;
  let repeatedText = "";
  if (tokens.length >= 50) {
    let highestCount = 0;
    for (const [token, count] of counts) if (count > highestCount) { highestCount = count; repeatedText = token; }
    repetition = highestCount / tokens.length;
    for (const phraseLength of [2, 3, 4, 5]) {
      const phrases = new Map<string, number>();
      for (let index = 0; index <= tokens.length - phraseLength; index++) {
        const phrase = tokens.slice(index, index + phraseLength).join(" ");
        const count = (phrases.get(phrase) ?? 0) + 1;
        phrases.set(phrase, count);
        const share = Math.min(1, count * phraseLength / tokens.length);
        if (share > repetition) { repetition = share; repeatedText = phrase; }
      }
    }
  }
  const excessiveRepetition = repetition !== null && repetition > 0.2;
  add("content", "Content length guide", !excessiveRepetition && words >= target ? 1 : !excessiveRepetition && words >= target / 2 ? 0.5 : 0, 5, `${words} words. Roughly ${target} words is an editorial prompt for this content type, not a Google target. Length alone does not establish usefulness.`);
  const topic = (input.focusTopic || title).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)?.filter(word => !["the", "and", "for", "with", "from", "rendi", "virgo", "dan", "yang", "untuk", "dari"].includes(word)) ?? [];
  const topicCoverage = (value: string) => {
    const words = new Set(value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
    return topic.length ? topic.filter(word => words.has(word)).length / topic.length : 0;
  };
  const bodyTopic = topicCoverage(text);
  const metaTopic = (topicCoverage(metaTitle) + topicCoverage(description)) / 2;
  const topicRatio = topic.length && !excessiveRepetition ? Math.min(1, bodyTopic * 0.65 + metaTopic * 0.35) : 0;
  add("topic", "Topic consistency prompt", topicRatio, 10, "Check that the main subject appears naturally in the body and metadata. This checks word overlap only; it does not assess search intent, synonyms, or content relevance.");
  const paragraphs = body.split(/\n\s*\n/).filter(part => plainText(part).length);
  const longParagraph = paragraphs.some(part => plainText(part).split(/\s+/).length > 150);
  add("readability", "Readable structure", text && !longParagraph ? 1 : text ? 0.5 : 0, 5, "Break long passages into short paragraphs that are easy to scan.");
  add("repetition", "Natural language", repetition === null ? 0 : repetition <= 0.12 ? 1 : repetition <= 0.2 ? 0.5 : 0, repetition === null ? 0 : 15, repetition === null
    ? "There is not enough body text to assess repeated wording; review this manually."
    : `The repeated word or phrase “${repeatedText}” covers about ${Math.round(repetition * 100)}% of body word positions. Review for unnatural repetition; this heuristic cannot judge context.`, repetition === null ? "review" : undefined);
  if (input.kind === "blog" || input.kind === "page") {
    add("headings", "Section headings", /^\s*#{2,3}\s+\S/m.test(body) || /<h[23][\s>]/i.test(body) ? 1 : 0, 5, "Organize the body with meaningful H2/H3 headings (## / ###). The page title already supplies H1.");
    add("links", "Relevant internal link", /\[[^\]]+\]\(\/(?!\/)[^)]+\)/.test(body) || /href=["']\/(?!\/)/.test(body) ? 1 : 0, 5, "Add a useful internal link to an existing related article, product, or category where it helps readers.");
  }
  if (["product", "blog", "category", "home"].includes(input.kind)) {
    const images = input.images?.filter(image => image.url?.trim()) ?? [];
    const informative = images.filter(image => !image.decorative);
    const repeated = informative.length > 1 && new Set(informative.map(image => image.alt?.trim().toLowerCase())).size < informative.length;
    const complete = images.length && images.every(image => image.decorative || image.alt?.trim() && !image.fallback) && !repeated;
    add("images", "Image and alternative text", complete ? 1 : images.length ? 0.5 : 0, input.kind === "blog" ? 5 : 10, "Describe each informative image specifically. Automatic title fallbacks and repeated alt text receive partial credit; decorative images may intentionally use empty alt text.");
  }
  const applicableChecks = checks.filter(check => check.max > 0).length;
  const maxPoints = checks.reduce((sum, check) => sum + check.max, 0);
  const score = maxPoints ? Math.round(checks.reduce((sum, check) => sum + check.points, 0) / maxPoints * 100) : 0;
  return { score, checks, words, maxPoints, applicableChecks, ...seoRating(score) };
}

/** Adapters keep saved-list scores and editor scores on the same inputs. */
export function productSeoInput(p: { name: string; slug: string; description: string; seo: { metaTitle: string | null; metaDescription: string | null }; images: Array<{ url: string; alt?: string | null }> }): SeoInput {
  return { kind: "product", title: p.name, slug: p.slug, body: p.description, ...p.seo, images: p.images.map(image => ({ ...image, alt: image.alt || p.name, fallback: !image.alt?.trim() })) };
}
export function contentSeoInput(p: { title: string; slug: string; body?: string; metaTitle: string | null; metaDescription: string | null; coverImage?: string | null; coverAlt?: string | null }, kind: "blog" | "page"): SeoInput {
  const images = kind === "blog"
    ? [
        ...(p.coverImage ? [{ url: p.coverImage, alt: p.coverAlt, fallback: !p.coverAlt?.trim() }] : []),
        ...extractBlogBodyImages(p.body ?? "").map(image => ({ url: image.url, alt: image.alt })),
      ]
    : undefined;
  return { kind, ...p, images };
}
