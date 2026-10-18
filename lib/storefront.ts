import type { Product, ProductStatus, ProductTone, ShippingClass, StockModel, Unit } from "@/lib/catalog";
import type { Language } from "@/lib/i18n";
import { defaultProductWatermark, type ProductWatermarkSettings } from "@/lib/product-watermark";

const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:4000";

export type ApiProductImage = {
  id: string;
  url: string;
  alt: string | null;
  focalX: number | null;
  focalY: number | null;
  sortOrder: number;
};

export type ApiVariant = {
  id: string;
  sku: string;
  name: string;
  price: number;
  stockQuantity: number;
  weightGram: number;
  dimensionsMm: { length: number; width: number; height: number };
  shippingClass: ShippingClass;
};

export type ApiProduct = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  contentLocale: Language;
  category: { id: string; slug: string; name: string; contentLocale: Language };
  categorySlug: string;
  stoneType: string;
  origin: string;
  mohsHardness: number | null;
  condition: string;
  conditionNote?: string | null;
  conditionNoteContentLocale?: Language;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  unit: Unit;
  stockModel: StockModel;
  stockQuantity: number;
  weightGram: number;
  weightCarat: number | null;
  dimensionsMm: { length: number; width: number; height: number };
  status: "Draft" | "Published" | "Reserved" | "Sold" | "Archived";
  tone: ProductTone;
  shippingClass: ShippingClass;
  description: string;
  videoUrl: string | null;
  featured: boolean;
  fragile: boolean;
  images: ApiProductImage[];
  imageUrls: string[];
  variants: ApiVariant[];
  seo: { metaTitle: string | null; metaDescription: string | null };
  inStock: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiCategory = {
  id: string;
  slug: string;
  name: string;
  contentLocale: Language;
  description: string | null;
  imageUrl: string | null;
  tone: ProductTone;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
  metaTitle: string | null;
  metaDescription: string | null;
};

export type ApiBlogPost = {
  id: string;
  slug: string;
  title: string;
  contentLocale: Language;
  excerpt: string;
  body?: string;
  coverImage: string | null;
  coverAlt: string | null;
  tags: string[];
  status: "Draft" | "Published" | "Scheduled" | "Archived";
  author: string;
  authorType: "Person" | "Organization";
  authorUrl: string | null;
  readMinutes: number;
  views: number;
  publishedAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  updatedAt: string;
};

export type ApiPage = {
  id: string;
  slug: string;
  title: string;
  contentLocale: Language;
  body: string;
  status: "Draft" | "Published" | "Scheduled" | "Archived";
  showInFooter: boolean;
  sortOrder: number;
  metaTitle: string | null;
  metaDescription: string | null;
  updatedAt: string;
};

export type ApiTestimonial = {
  id: string;
  customerName: string;
  location: string | null;
  quote: string;
  contentLocale: Language;
  rating: number;
  sortOrder: number;
};

export type ApiBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  placement: "HomeHero" | "HomeOwner" | "Promo";
  sortOrder: number;
};

export type SiteContent = {
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  ownerName: string;
  ownerRole: string;
  ownerBio: string;
  ownerImage: string;
  ownerCtaLabel: string;
  ownerCtaHref: string;
  contentLocale: Language;
  shippingOverrideEnabled: boolean;
  shippingOverrideAmount: number;
  freeShippingThreshold: number;
};

export type PublicSettings = {
  store: {
    name: string;
    tagline: string;
    email: string;
    whatsapp: string;
    whatsappSecondary: string;
    currency: string;
    languages: string[];
    address: string;
    hours: string;
    socials: Record<string, string>;
    productWatermark: ProductWatermarkSettings;
  };
  seo: { defaultTitle: string; defaultDescription: string };
};

export type ShippingQuoteOption = {
  id: string;
  name: string;
  carrier: string | null;
  price: number;
  breakdown: Record<string, number>;
};

export type ShippingQuote = {
  options: ShippingQuoteOption[];
  source: "CarrierAPI" | "AdminOverride" | "FreeShipping";
  overrideApplied: boolean;
};

const statusMap: Record<ApiProduct["status"], ProductStatus> = {
  Published: "Available",
  Reserved: "Reserved",
  Sold: "Sold",
  Draft: "Sold",
  Archived: "Sold",
};

export function mapProduct(item: ApiProduct): Product {
  const origin = item.origin?.trim() ?? "";
  const displayOrigin = /^(?:not provided|not specified|unknown|n\/?a|none)$/i.test(origin) ? "" : origin;
  return {
    id: item.id,
    slug: item.slug,
    sku: item.sku,
    name: item.name,
    contentLocale: item.contentLocale ?? "en",
    category: item.category.name,
    categoryContentLocale: item.category.contentLocale ?? "en",
    categorySlug: item.categorySlug,
    stoneType: item.stoneType,
    origin: displayOrigin,
    mohsHardness: item.mohsHardness,
    price: item.price,
    currency: "USD",
    unit: item.unit,
    stockModel: item.stockModel,
    ...(item.stockModel === "Quantity" ? { stockQuantity: item.stockQuantity } : {}),
    weightGram: item.weightGram,
    weightCarat: item.weightCarat ?? Math.round(item.weightGram * 5 * 10) / 10,
    dimensionsMm: item.dimensionsMm,
    condition: item.condition,
    conditionNote: item.conditionNote,
    conditionNoteContentLocale: item.conditionNoteContentLocale,
    status: statusMap[item.status] ?? "Available",
    tone: item.tone,
    description: item.description,
    videoUrl: item.videoUrl ?? null,
    images: item.imageUrls.length ? item.imageUrls : ["/images/products/stone-moss.svg"],
    seo: {
      metaTitle: item.seo.metaTitle ?? `${item.name} — ${item.category.name} | RENDI VIRGO`,
      metaDescription: item.seo.metaDescription ?? `${item.description} ${item.stoneType} from ${item.origin}. ${item.weightGram} g.`,
    },
    shipping: {
      packageWeightGram: item.weightGram + 45,
      packageDimensionsMm: {
        length: item.dimensionsMm.length + 30,
        width: item.dimensionsMm.width + 30,
        height: item.dimensionsMm.height + 20,
      },
      shippingProfileId: "rv-worldwide-standard",
      shippingClass: item.shippingClass,
      calculationMethod: "CarrierAPI",
      packageModel: "SinglePackageTotalWeight",
    },
    featured: item.featured,
    fragile: item.fragile,
    variants: item.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      price: variant.price,
      stockQuantity: variant.stockQuantity,
      weightGram: variant.weightGram,
      dimensionsMm: variant.dimensionsMm,
      shippingProfileId: "rv-worldwide-standard",
    })),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

type ApiReadResult<T> =
  | { status: "ok"; data: T }
  | { status: "not-found" }
  | { status: "unavailable"; error: Error };

async function apiGetWithStatus<T>(path: string, options?: { revalidate?: number; language?: Language; tags?: string[] }): Promise<ApiReadResult<T>> {
  try {
    const response = await fetch(`${apiOrigin}${path}`, {
      headers: { accept: "application/json", "x-rv-language": options?.language ?? "en" },
      next: { revalidate: options?.revalidate ?? 60, ...(options?.tags ? { tags: options.tags } : {}) },
    });
    if (response.status === 404) return { status: "not-found" };
    if (!response.ok) return { status: "unavailable", error: new Error(`The store API returned ${response.status}`) };
    return { status: "ok", data: (await response.json()) as T };
  } catch (error) {
    return { status: "unavailable", error: error instanceof Error ? error : new Error("The store API is unavailable") };
  }
}

async function apiGet<T>(path: string, options?: { revalidate?: number; strictError?: boolean; language?: Language; tags?: string[] }): Promise<T | null> {
  const result = await apiGetWithStatus<T>(path, options);
  if (result.status === "ok") return result.data;
  if (result.status === "unavailable" && options?.strictError) throw result.error;
  return null;
}

async function apiSend<T>(path: string, method: "POST" | "PATCH", body: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${apiOrigin}${path}`, {
      method,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const raw = (payload as { message?: string | string[] } | null)?.message;
      const message = Array.isArray(raw) ? raw.join(", ") : (raw ?? "Request failed");
      return { ok: false, message };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, message: "Could not reach the store API. Please try again." };
  }
}

export type ProductQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  stoneType?: string;
  origin?: string;
  ids?: string[];
  featured?: boolean;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minWeightGram?: number;
  maxWeightGram?: number;
  sort?: "featured" | "newest" | "oldest" | "price-asc" | "price-desc" | "name" | "weight-desc";
};

export async function getProductsWithStatus(query: ProductQuery = {}, options?: { revalidate?: number; language?: Language }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const result = await apiGetWithStatus<{ items: ApiProduct[]; total: number; pageCount: number }>(
    `/api/products?${params.toString()}`,
    options,
  );
  if (result.status === "not-found") {
    return { status: "unavailable" as const, error: new Error("The product search endpoint was not found") };
  }
  if (result.status === "unavailable") return result;
  if (!result.data || !Array.isArray(result.data.items)) {
    return { status: "unavailable" as const, error: new Error("The product search response was incomplete") };
  }
  return {
    status: "ok" as const,
    products: (result.data.items ?? []).map(mapProduct),
    total: result.data.total ?? 0,
    pageCount: result.data.pageCount ?? 1,
  };
}

export async function getProducts(query: ProductQuery = {}, language: Language = "en") {
  const result = await getProductsWithStatus(query, { language });
  if (result.status === "ok") {
    return { products: result.products, total: result.total, pageCount: result.pageCount };
  }
  return { products: [], total: 0, pageCount: 1 };
}

export async function getAllPublishedProducts(language: Language = "en") {
  const first = await getProducts({ pageSize: 100, sort: "newest" }, language);
  const products = [...first.products];
  for (let page = 2; page <= first.pageCount; page += 1) {
    const next = await getProducts({ pageSize: 100, sort: "newest", page }, language);
    if (!next.products.length) break;
    products.push(...next.products);
  }
  return products;
}

export async function getProductFilters() {
  const result = await apiGet<{ origins: string[]; stoneTypes: string[] }>("/api/products/filters");
  return {
    origins: result?.origins ?? [],
    stoneTypes: result?.stoneTypes ?? [],
  };
}

export async function getProductReviewSummary(slug: string) {
  const result = await apiGet<{ summary: { rating: number; count: number } }>(
    `/api/products/${encodeURIComponent(slug)}/reviews?pageSize=1`,
  );
  return result?.summary ?? { rating: 0, count: 0 };
}

export async function getProductBySlug(slug: string, language: Language = "en") {
  const item = await apiGet<ApiProduct>(`/api/products/${encodeURIComponent(slug)}`, { strictError: true, language });
  return item ? mapProduct(item) : null;
}

export async function getRelatedProducts(slug: string, limit = 4, language: Language = "en") {
  const items = await apiGet<ApiProduct[]>(`/api/products/${encodeURIComponent(slug)}/related?limit=${limit}`, { language });
  return (items ?? []).map(mapProduct);
}

export async function getCategories(language: Language = "en") {
  return (await apiGet<ApiCategory[]>("/api/categories", { language })) ?? [];
}

export async function getCategory(slug: string, language: Language = "en") {
  return apiGet<ApiCategory>(`/api/categories/${encodeURIComponent(slug)}`, { language });
}

export async function getBlogPosts(params: { page?: number; pageSize?: number; tag?: string; search?: string } = {}, language: Language = "en") {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const result = await apiGet<{ items: ApiBlogPost[]; total: number; pageCount: number }>(`/api/blog?${search.toString()}`, { language, tags: ["blog-posts"] });
  return { posts: result?.items ?? [], total: result?.total ?? 0, pageCount: result?.pageCount ?? 1 };
}

export async function getBlogPost(slug: string, language: Language = "en") {
  return apiGet<ApiBlogPost>(`/api/blog/${encodeURIComponent(slug)}`, { language, tags: ["blog-posts"] });
}

export async function getPages(language: Language = "en") {
  return (await apiGet<ApiPage[]>("/api/pages", { language })) ?? [];
}

export async function getPage(slug: string, language: Language = "en") {
  return apiGet<ApiPage>(`/api/pages/${encodeURIComponent(slug)}`, { language });
}

export async function getPageWithStatus(slug: string, language: Language = "en") {
  return apiGetWithStatus<ApiPage>(`/api/pages/${encodeURIComponent(slug)}`, { language });
}

export async function getTestimonials(language: Language = "en") {
  return (await apiGet<ApiTestimonial[]>("/api/testimonials", { language })) ?? [];
}

export async function getBanners(placement?: ApiBanner["placement"]) {
  const path = placement ? `/api/banners?placement=${placement}` : "/api/banners";
  return (await apiGet<ApiBanner[]>(path)) ?? [];
}

const defaultSiteContent: SiteContent = {
  heroTitle: "Explore the Collection",
  heroSubtitle: "Rare semi-precious stones from Indonesia, selected for collectors, makers, and quiet moments of wonder.",
  heroImage: "/images/rendi-virgo-hero-stones.webp",
  ownerName: "RENDI VIRGO",
  ownerRole: "Founder & Curator",
  ownerBio:
    "A lifelong passion for Indonesia's natural treasures. RENDI VIRGO is dedicated to sharing the beauty and authenticity of our local stones with the world.",
  ownerImage: "/images/rendi-virgo-owner-cutout.png",
  ownerCtaLabel: "About Us",
  ownerCtaHref: "/about-us",
  contentLocale: "en",
  shippingOverrideEnabled: false,
  shippingOverrideAmount: 48,
  freeShippingThreshold: 0,
};

export async function getSiteContent(language: Language = "en"): Promise<SiteContent> {
  const stored = await apiGet<Record<string, unknown>>("/api/site-content", { language });
  const value = <T,>(key: string, fallback: T): T => {
    const entry = stored?.[key];
    if (entry === undefined || entry === null) return fallback;
    return entry as T;
  };
  return {
    heroTitle: value("home.heroTitle", defaultSiteContent.heroTitle),
    heroSubtitle: value("home.heroSubtitle", defaultSiteContent.heroSubtitle),
    heroImage: value("home.heroImage", defaultSiteContent.heroImage) || defaultSiteContent.heroImage,
    ownerName: value("home.ownerName", defaultSiteContent.ownerName),
    ownerRole: value("home.ownerRole", defaultSiteContent.ownerRole),
    ownerBio: value("home.ownerBio", defaultSiteContent.ownerBio),
    ownerImage: value("home.ownerImage", defaultSiteContent.ownerImage) || defaultSiteContent.ownerImage,
    ownerCtaLabel: value("home.ownerCtaLabel", defaultSiteContent.ownerCtaLabel),
    ownerCtaHref: value("home.ownerCtaHref", defaultSiteContent.ownerCtaHref) || defaultSiteContent.ownerCtaHref,
    contentLocale: value("home.contentLocale", "en"),
    shippingOverrideEnabled: Boolean(value("shipping.overrideEnabled", defaultSiteContent.shippingOverrideEnabled)),
    shippingOverrideAmount: Number(value("shipping.overrideAmount", defaultSiteContent.shippingOverrideAmount)),
    freeShippingThreshold: Number(value("shipping.freeShippingThreshold", defaultSiteContent.freeShippingThreshold)),
  };
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const stored = (await apiGet<Record<string, unknown>>("/api/settings/public")) ?? {};
  const value = <T,>(key: string, fallback: T): T => {
    const entry = stored[key];
    if (entry === undefined || entry === null) return fallback;
    return entry as T;
  };
  return {
    store: {
      name: value("store.name", "RENDI VIRGO"),
      tagline: value("store.tagline", "Indonesian natural stones, from our hands to yours."),
      email: value("store.email", "cs@rendivirgo.com"),
      whatsapp: value("store.whatsapp", ""),
      whatsappSecondary: value("store.whatsappSecondary", ""),
      currency: value("store.currency", "USD"),
      languages: value("store.languages", ["en", "id"]),
      address: value("store.address", "Bandung, West Java, Indonesia"),
      hours: value("store.hours", "Monday – Saturday, 09:00 – 18:00 (GMT+7)"),
      socials: value<Record<string, string>>("store.socials", {}),
      productWatermark: {
        enabled: value("store.productWatermarkEnabled", defaultProductWatermark.enabled),
        logo: value("store.productWatermarkLogo", defaultProductWatermark.logo),
        opacity: value("store.productWatermarkOpacity", defaultProductWatermark.opacity),
        size: value("store.productWatermarkSize", defaultProductWatermark.size),
        x: value("store.productWatermarkX", defaultProductWatermark.x),
        y: value("store.productWatermarkY", defaultProductWatermark.y),
      },
    },
    seo: {
      defaultTitle: value("seo.defaultTitle", "RENDI VIRGO — Indonesian Natural Stones"),
      defaultDescription: value(
        "seo.defaultDescription",
        "One-of-a-kind Indonesian stones for collectors and makers worldwide.",
      ),
    },
  };
}

export async function getShippingQuote(input: {
  weightGram: number;
  subtotal?: number;
  countryCode?: string;
  shippingClass?: ShippingClass;
}) {
  return apiSend<ShippingQuote>("/api/shipping/quote", "POST", input);
}

export type CreateOrderInput = {
  email: string;
  customerName: string;
  phone?: string;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
    countryCode?: string;
  };
  customerNote?: string;
  shippingRateId?: string;
  discountCode?: string;
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
};

export async function createOrder(input: CreateOrderInput) {
  return apiSend<{ id: string; orderNumber: string; total: number; status: string; paymentStatus: string }>("/api/orders", "POST", input);
}

export async function validateDiscount(input: {
  code: string;
  subtotal: number;
  items?: Array<{ productId: string; quantity: number; lineTotal: number }>;
}) {
  return apiSend<{ valid: boolean; code: string; type: string; discountAmount: number; freeShipping: boolean; message: string }>(
    "/api/discounts/validate",
    "POST",
    input,
  );
}

export async function sendContactMessage(input: { name: string; email: string; phone?: string; subject: string; body: string }) {
  return apiSend<{ id: string }>("/api/contact", "POST", input);
}

export function formatPageBody(body: string) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
