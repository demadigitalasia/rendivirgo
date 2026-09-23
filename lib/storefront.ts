import type { Product, ProductStatus, ProductTone, ShippingClass, StockModel, Unit } from "@/lib/catalog";

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
  category: { id: string; slug: string; name: string };
  categorySlug: string;
  stoneType: string;
  origin: string;
  mohsHardness: number | null;
  condition: "Natural" | "Treated" | "Dyed";
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
  excerpt: string;
  body?: string;
  coverImage: string | null;
  tags: string[];
  status: "Draft" | "Published" | "Scheduled" | "Archived";
  author: string;
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
    currency: string;
    languages: string[];
    address: string;
    hours: string;
    socials: Record<string, string>;
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
  return {
    id: item.id,
    slug: item.slug,
    sku: item.sku,
    name: item.name,
    category: item.category.name,
    categorySlug: item.categorySlug,
    stoneType: item.stoneType,
    origin: item.origin,
    price: item.price,
    currency: "USD",
    unit: item.unit,
    stockModel: item.stockModel,
    ...(item.stockModel === "Quantity" ? { stockQuantity: item.stockQuantity } : {}),
    weightGram: item.weightGram,
    weightCarat: item.weightCarat ?? Math.round(item.weightGram * 5 * 10) / 10,
    dimensionsMm: item.dimensionsMm,
    condition: item.condition,
    status: statusMap[item.status] ?? "Available",
    tone: item.tone,
    description: item.description,
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

async function apiGet<T>(path: string, options?: { revalidate?: number }): Promise<T | null> {
  try {
    const response = await fetch(`${apiOrigin}${path}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      ...(options?.revalidate ? { next: { revalidate: options.revalidate } } : {}),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
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
  featured?: boolean;
  inStock?: boolean;
  sort?: "newest" | "oldest" | "price-asc" | "price-desc" | "name" | "weight-desc";
};

export async function getProducts(query: ProductQuery = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const result = await apiGet<{ items: ApiProduct[]; total: number; pageCount: number }>(`/api/products?${params.toString()}`);
  return {
    products: (result?.items ?? []).map(mapProduct),
    total: result?.total ?? 0,
    pageCount: result?.pageCount ?? 1,
  };
}

export async function getAllPublishedProducts() {
  const { products } = await getProducts({ pageSize: 100, sort: "newest" });
  return products;
}

export async function getProductBySlug(slug: string) {
  const item = await apiGet<ApiProduct>(`/api/products/${encodeURIComponent(slug)}`);
  return item ? mapProduct(item) : null;
}

export async function getRelatedProducts(slug: string, limit = 4) {
  const items = await apiGet<ApiProduct[]>(`/api/products/${encodeURIComponent(slug)}/related?limit=${limit}`);
  return (items ?? []).map(mapProduct);
}

export async function getCategories() {
  return (await apiGet<ApiCategory[]>("/api/categories")) ?? [];
}

export async function getCategory(slug: string) {
  return apiGet<ApiCategory>(`/api/categories/${encodeURIComponent(slug)}`);
}

export async function getBlogPosts(params: { page?: number; pageSize?: number; tag?: string; search?: string } = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const result = await apiGet<{ items: ApiBlogPost[]; total: number; pageCount: number }>(`/api/blog?${search.toString()}`);
  return { posts: result?.items ?? [], total: result?.total ?? 0, pageCount: result?.pageCount ?? 1 };
}

export async function getBlogPost(slug: string) {
  return apiGet<ApiBlogPost>(`/api/blog/${encodeURIComponent(slug)}`);
}

export async function getPages() {
  return (await apiGet<ApiPage[]>("/api/pages")) ?? [];
}

export async function getPage(slug: string) {
  return apiGet<ApiPage>(`/api/pages/${encodeURIComponent(slug)}`);
}

export async function getTestimonials() {
  return (await apiGet<ApiTestimonial[]>("/api/testimonials")) ?? [];
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
  ownerImage: "/images/rendi-virgo-owner.webp",
  ownerCtaLabel: "About Us",
  ownerCtaHref: "/about-us",
  shippingOverrideEnabled: false,
  shippingOverrideAmount: 48,
  freeShippingThreshold: 0,
};

export async function getSiteContent(): Promise<SiteContent> {
  const stored = await apiGet<Record<string, unknown>>("/api/site-content");
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
      currency: value("store.currency", "USD"),
      languages: value("store.languages", ["en", "id"]),
      address: value("store.address", "Bandung, West Java, Indonesia"),
      hours: value("store.hours", "Monday – Saturday, 09:00 – 18:00 (GMT+7)"),
      socials: value<Record<string, string>>("store.socials", {}),
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
