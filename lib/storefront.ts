import { DEFAULT_HERO, type HeroDocument } from "@/lib/hero-slides";
import type { Product, ProductStatus, ProductTone, ShippingClass, StockModel, Unit } from "@/lib/catalog";
import type { Language } from "@/lib/i18n";
import { defaultProductWatermark, type ProductWatermarkSettings } from "@/lib/product-watermark";
import { DEFAULT_LAPIDARY_PROCESS_PRESENTATION, type LapidaryProcessPresentation } from "@/lib/lapidary-process";

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
  updatedAt?: string;
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

export type LapidaryArtistProfile = {
  id: string;
  slug: string;
  name: string;
  signatureStyle: string;
  location: string | null;
  bio: string;
  experience: string;
  stoneExperience: string[];
  imageUrl: string | null;
  imageAlt: string;
  contentLocale?: Language;
  imagePosition: "left" | "center" | "right";
  portfolioImages: Array<{ url: string; altText: string; caption: string }>;
};

export type LapidaryArtistsPresentation = {
  eyebrowEn: string; eyebrowId: string; titleEn: string; titleId: string; introEn: string; introId: string;
  capabilityTitleEn: string; capabilityTitleId: string; capabilityBodyEn: string; capabilityBodyId: string;
  emptyTitleEn: string; emptyTitleId: string; emptyBodyEn: string; emptyBodyId: string;
  ctaLabelEn: string; ctaLabelId: string; heroImage: string; heroAltEn: string; heroAltId: string;
  ctaTarget: "customOrder" | "contact"; detailCtaTarget: "customOrder" | "contact";
  heroImagePosition: "left" | "center" | "right"; metaTitleEn: string; metaTitleId: string;
  metaDescriptionEn: string; metaDescriptionId: string; visualStyle: "mineral" | "forest" | "quartz"; motionEnabled: boolean;
};

export const DEFAULT_LAPIDARY_ARTISTS_PRESENTATION: LapidaryArtistsPresentation = {
  eyebrowEn: "THE PEOPLE BEHIND THE CRAFT", eyebrowId: "PARA PENGRAJIN DI BALIK KARYA",
  titleEn: "One craft. Distinct ways of seeing stone.", titleId: "Satu keahlian. Cara berbeda memahami batu.",
  introEn: "Meet the lapidary artists who bring their own point of view to natural material, from first assessment through the final finish.",
  introId: "Kenali para pengrajin lapidary yang membawa sudut pandang masing-masing pada material alami, dari penilaian awal hingga sentuhan akhir.",
  capabilityTitleEn: "Every artist, through every stage.", capabilityTitleId: "Setiap pengrajin menangani seluruh tahap.",
  capabilityBodyEn: "Our artists can guide a commission through material assessment, planning, shaping, cutting, polishing, and final review. Their individual character comes from the styles they favor and the stones they know well.",
  capabilityBodyId: "Setiap pengrajin dapat menangani pesanan dari penilaian material, perencanaan, pembentukan, pemotongan, pemolesan, hingga pemeriksaan akhir. Karakter masing-masing terlihat dari gaya yang disukai dan jenis batu yang mereka kenal.",
  emptyTitleEn: "Artist profiles are being prepared.", emptyTitleId: "Profil pengrajin sedang disiapkan.",
  emptyBodyEn: "Contact our studio with your project brief. We will help you find the right approach for your stone.",
  emptyBodyId: "Hubungi studio kami dengan brief proyek Anda. Kami akan membantu menentukan pendekatan yang sesuai untuk batu Anda.",
  ctaLabelEn: "Talk to the studio", ctaLabelId: "Hubungi studio", ctaTarget: "contact", detailCtaTarget: "customOrder",
  heroImage: "/images/lapidary/studio/studio-hero.jpg", heroAltEn: "Lapidary workbench in the RENDI VIRGO studio", heroAltId: "Meja kerja lapidary di studio RENDI VIRGO",
  heroImagePosition: "center", metaTitleEn: "Lapidary Artists — RENDI VIRGO", metaTitleId: "Pengrajin Lapidary — RENDI VIRGO",
  metaDescriptionEn: "Meet the RENDI VIRGO lapidary artists, their individual styles, and the natural stones they know well.",
  metaDescriptionId: "Kenali pengrajin lapidary RENDI VIRGO, gaya masing-masing, dan jenis batu alam yang mereka kenal.",
  visualStyle: "mineral", motionEnabled: true,
};

export type LapidaryPublicContent = {
  studioHeroImage: string;
  studioImages: LapidaryStudioImage[];
  studioPresentation: LapidaryStudioPresentation;
  processPresentation: LapidaryProcessPresentation;
  artistsPresentation: LapidaryArtistsPresentation;
  artists: LapidaryArtistProfile[];
};

export type LapidaryStudioImage = {
  url: string;
  altEn: string;
  altId: string;
  captionEn: string;
  captionId: string;
};

export type LapidaryStudioPresentation = {
  titleEn: string;
  titleId: string;
  introEn: string;
  introId: string;
  galleryTitleEn: string;
  galleryTitleId: string;
  eyebrowEn: string;
  eyebrowId: string;
  galleryEyebrowEn: string;
  galleryEyebrowId: string;
  ctaLabelEn: string;
  ctaLabelId: string;
  approachTitleEn: string;
  approachTitleId: string;
  approachEyebrowEn: string;
  approachEyebrowId: string;
  approachPointsEn: string[];
  approachPointsId: string[];
  photoCountLabelEn: string;
  photoCountLabelId: string;
  backLabelEn: string;
  backLabelId: string;
  ctaTarget: "customOrder" | "contact";
  heroImagePosition: "left" | "center" | "right";
  metaTitleEn: string;
  metaTitleId: string;
  metaDescriptionEn: string;
  metaDescriptionId: string;
  visualStyle: "mineral" | "forest" | "quartz";
  motionEnabled: boolean;
};

export const LAPIDARY_STUDIO_SAMPLE_IMAGES: LapidaryStudioImage[] = [
  { url: "/images/lapidary/studio/studio-overview.jpg", altEn: "Lapidary workshop with stone cutting and polishing equipment", altId: "Studio lapidary dengan alat pemotong dan pemoles batu", captionEn: "The lapidary workroom", captionId: "Ruang kerja lapidary" },
  { url: "/images/lapidary/studio/studio-cutting.jpg", altEn: "Lapidary cutter shaping a natural stone at a saw", altId: "Pengrajin lapidary membentuk batu alam dengan mesin potong", captionEn: "Careful shaping", captionId: "Pembentukan yang cermat" },
  { url: "/images/lapidary/studio/rough-selection.jpg", altEn: "Rough stones examined before a cut is planned", altId: "Batu rough diperiksa sebelum rencana pemotongan", captionEn: "Material selection", captionId: "Pemilihan material" },
  { url: "/images/lapidary/studio/faceting-machine.jpg", altEn: "Faceting machine prepared for precision gemstone cutting", altId: "Mesin faceting yang disiapkan untuk memotong batu permata dengan presisi", captionEn: "Precision cutting", captionId: "Pemotongan presisi" },
  { url: "/images/lapidary/studio/cabochon-polishing.jpg", altEn: "Natural stone cabochon being polished in the studio", altId: "Cabochon batu alam sedang dipoles di studio", captionEn: "Polishing the surface", captionId: "Memoles permukaan" },
  { url: "/images/lapidary/studio/tool-wall.jpg", altEn: "Lapidary hand tools arranged at the studio workbench", altId: "Peralatan lapidary tersusun di meja kerja studio", captionEn: "Tools of the craft", captionId: "Peralatan pengerjaan" },
  { url: "/images/lapidary/studio/studio-shaping-detail.jpg", altEn: "Close view of a stone being shaped by hand", altId: "Tampilan dekat batu yang sedang dibentuk dengan tangan", captionEn: "Shaping by hand", captionId: "Membentuk dengan tangan" },
  { url: "/images/lapidary/studio/stone-assessment.jpg", altEn: "Lapidary artist assessing a stone's natural structure", altId: "Pengrajin lapidary menilai struktur alami batu", captionEn: "Reading the stone", captionId: "Membaca karakter batu" },
  { url: "/images/lapidary/studio/dimension-review.jpg", altEn: "Stone dimensions checked before custom lapidary work", altId: "Dimensi batu diperiksa sebelum pengerjaan lapidary custom", captionEn: "Reviewing dimensions", captionId: "Memeriksa dimensi" },
  { url: "/images/lapidary/studio/studio-stone-review.jpg", altEn: "Finished and rough stones reviewed together at the studio", altId: "Batu hasil pengerjaan dan rough ditinjau bersama di studio", captionEn: "A final material review", captionId: "Peninjauan material akhir" },
  { url: "/images/lapidary/studio/finished-collection.jpg", altEn: "Polished natural stone pieces arranged after studio work", altId: "Batu alam yang telah dipoles dan ditata setelah pengerjaan studio", captionEn: "Finished pieces", captionId: "Batu hasil akhir" },
];

export const DEFAULT_LAPIDARY_STUDIO_HERO_IMAGE = "/images/lapidary/studio/studio-hero.jpg";

export const DEFAULT_LAPIDARY_STUDIO_PRESENTATION: LapidaryStudioPresentation = {
  titleEn: "The work, up close.",
  titleId: "Melihat proses dari dekat.",
  introEn: "A considered look at the tools, hands, and decisions that shape natural stone in the RENDI VIRGO lapidary studio.",
  introId: "Melihat lebih dekat alat, tangan, dan keputusan yang membentuk batu alam di studio lapidary RENDI VIRGO.",
  galleryTitleEn: "Inside the studio",
  galleryTitleId: "Suasana studio",
  eyebrowEn: "THE WORKROOM · RENDI VIRGO",
  eyebrowId: "RUANG KERJA · RENDI VIRGO",
  galleryEyebrowEn: "A LOOK INSIDE",
  galleryEyebrowId: "DARI RUANG KERJA",
  ctaLabelEn: "Start a custom request",
  ctaLabelId: "Mulai permintaan custom",
  approachTitleEn: "A material-first practice",
  approachTitleId: "Bekerja dengan memahami material",
  approachEyebrowEn: "OUR APPROACH",
  approachEyebrowId: "PENDEKATAN KAMI",
  approachPointsEn: ["Read the material before choosing a cut", "Discuss risks and natural inclusions openly", "Agree on scope and finish before work begins"],
  approachPointsId: ["Memahami material sebelum menentukan bentuk", "Membahas risiko dan inklusi alami secara terbuka", "Menyepakati lingkup dan hasil akhir sebelum pengerjaan"],
  photoCountLabelEn: "STUDIO VIEWS",
  photoCountLabelId: "SUASANA STUDIO",
  backLabelEn: "Lapidary",
  backLabelId: "Lapidary",
  ctaTarget: "customOrder",
  heroImagePosition: "center",
  metaTitleEn: "Lapidary Studio — RENDI VIRGO",
  metaTitleId: "Studio Lapidary — RENDI VIRGO",
  metaDescriptionEn: "Learn how the RENDI VIRGO studio assesses, shapes, and finishes natural stones.",
  metaDescriptionId: "Kenali pendekatan studio RENDI VIRGO dalam menilai, membentuk, dan memoles batu alam.",
  visualStyle: "mineral",
  motionEnabled: true,
};

export type SiteContent = {
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  ownerName: string;
  ownerRole: string;
  ownerBio: string;
  ownerImage: string;
  aboutRendiImage: string;
  aboutPajarImage: string;
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
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
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
    inStock: item.inStock,
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
    imageAlts: item.imageUrls.map(url => item.images.find(image => image.url === url)?.alt ?? ""),
    seo: {
      metaTitle: item.seo.metaTitle ?? `${item.name} — ${item.category.name} | RENDI VIRGO`,
      metaDescription: item.seo.metaDescription?.trim() || `${item.description} ${item.stoneType} from ${item.origin}. ${item.weightGram} g.`.slice(0, 160),
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

async function apiGetWithStatus<T>(path: string, options?: { revalidate?: number; language?: Language; tags?: string[]; seoAudit?: boolean }): Promise<ApiReadResult<T>> {
  try {
    const response = await fetch(`${apiOrigin}${path}`, {
      headers: { accept: "application/json", "x-rv-language": options?.language ?? "en", ...(options?.seoAudit ? { "x-rv-seo-audit": "1" } : {}) },
      next: { revalidate: options?.revalidate ?? 60, ...(options?.tags ? { tags: options.tags } : {}) },
    });
    if (response.status === 404) return { status: "not-found" };
    if (!response.ok) return { status: "unavailable", error: new Error(`The store API returned ${response.status}`) };
    return { status: "ok", data: (await response.json()) as T };
  } catch (error) {
    return { status: "unavailable", error: error instanceof Error ? error : new Error("The store API is unavailable") };
  }
}

async function apiGet<T>(path: string, options?: { revalidate?: number; strictError?: boolean; language?: Language; tags?: string[]; seoAudit?: boolean }): Promise<T | null> {
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

export async function getBlogTags(language: Language = "en") {
  return (await apiGet<string[]>("/api/blog/tags", { language, tags: ["blog-posts"] })) ?? [];
}

export async function getBlogPost(slug: string, language: Language = "en", seoAudit = false) {
  return apiGet<ApiBlogPost>(`/api/blog/${encodeURIComponent(slug)}`, { language, tags: ["blog-posts"], seoAudit });
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

export async function getHeroSlides(): Promise<HeroDocument> {
  return (await apiGet<HeroDocument>("/api/hero-slides", { tags: ["home-hero"] })) ?? DEFAULT_HERO;
}

export async function getBanners(placement?: ApiBanner["placement"]) {
  const path = placement ? `/api/banners?placement=${placement}` : "/api/banners";
  return (await apiGet<ApiBanner[]>(path)) ?? [];
}

export async function getLapidaryContent(language: Language = "en"): Promise<LapidaryPublicContent> {
  const content = await apiGet<Partial<LapidaryPublicContent>>("/api/lapidary/content", { language, tags: ["lapidary-content"] });
  const rawImages = Array.isArray(content?.studioImages) ? content.studioImages as unknown[] : [];
  const normalizedImages = rawImages.flatMap((entry, index) => {
    if (typeof entry === "string") {
      const fallback = LAPIDARY_STUDIO_SAMPLE_IMAGES.find((image) => image.url === entry) ?? LAPIDARY_STUDIO_SAMPLE_IMAGES[index % LAPIDARY_STUDIO_SAMPLE_IMAGES.length];
      return [{ ...fallback, url: entry }];
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || !("url" in entry) || typeof entry.url !== "string") return [];
    const url = entry.url;
    const fallback = LAPIDARY_STUDIO_SAMPLE_IMAGES.find((image) => image.url === url) ?? LAPIDARY_STUDIO_SAMPLE_IMAGES[index % LAPIDARY_STUDIO_SAMPLE_IMAGES.length];
    const saved = entry as Partial<LapidaryStudioImage>;
    return [{
      url,
      altEn: saved.altEn || fallback.altEn,
      altId: saved.altId || fallback.altId,
      captionEn: saved.captionEn ?? fallback.captionEn,
      captionId: saved.captionId ?? fallback.captionId,
    }];
  }).filter((image, index, all) => all.findIndex((candidate) => candidate.url === image.url) === index).slice(0, 24);
  for (const fallback of LAPIDARY_STUDIO_SAMPLE_IMAGES) {
    if (normalizedImages.length >= 11) break;
    if (!normalizedImages.some((image) => image.url === fallback.url)) normalizedImages.push(fallback);
  }
  return {
    studioHeroImage: content?.studioHeroImage || DEFAULT_LAPIDARY_STUDIO_HERO_IMAGE,
    studioImages: normalizedImages.length ? normalizedImages : LAPIDARY_STUDIO_SAMPLE_IMAGES,
    studioPresentation: { ...DEFAULT_LAPIDARY_STUDIO_PRESENTATION, ...content?.studioPresentation },
    processPresentation: content?.processPresentation ?? DEFAULT_LAPIDARY_PROCESS_PRESENTATION,
    artistsPresentation: { ...DEFAULT_LAPIDARY_ARTISTS_PRESENTATION, ...content?.artistsPresentation },
    artists: content?.artists ?? [],
  };
}

const defaultSiteContent: SiteContent = {
  metaTitle: "",
  metaDescription: "",
  heroTitle: "Explore the Collection",
  heroSubtitle: "Rare semi-precious stones from Indonesia, selected for collectors, makers, and quiet moments of wonder.",
  heroImage: "/images/rendi-virgo-hero-stones.webp",
  ownerName: "RENDI VIRGO",
  ownerRole: "Founder & Curator",
  ownerBio:
    "A lifelong passion for Indonesia's natural treasures. RENDI VIRGO is dedicated to sharing the beauty and authenticity of our local stones with the world.",
  ownerImage: "/images/rendi-virgo-owner-cutout.png",
  aboutRendiImage: "/images/rendi-virgo-owner-cutout.png",
  aboutPajarImage: "/images/pajar-agung-owner-cutout.png",
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
    metaTitle: value("home.metaTitle", ""),
    metaDescription: value("home.metaDescription", ""),
    heroTitle: value("home.heroTitle", defaultSiteContent.heroTitle),
    heroSubtitle: value("home.heroSubtitle", defaultSiteContent.heroSubtitle),
    heroImage: value("home.heroImage", defaultSiteContent.heroImage) || defaultSiteContent.heroImage,
    ownerName: value("home.ownerName", defaultSiteContent.ownerName),
    ownerRole: value("home.ownerRole", defaultSiteContent.ownerRole),
    ownerBio: value("home.ownerBio", defaultSiteContent.ownerBio),
    ownerImage: value("home.ownerImage", defaultSiteContent.ownerImage) || defaultSiteContent.ownerImage,
    aboutRendiImage: value("about.rendiImage", "") || value("home.ownerImage", defaultSiteContent.ownerImage) || defaultSiteContent.ownerImage,
    aboutPajarImage: value("about.pajarImage", "") || "/images/pajar-agung-owner-cutout.png",
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
