export type ContentStatus = "Draft" | "Published" | "Scheduled" | "Archived";
export type TranslationStatus = "Missing" | "Draft" | "Review" | "Ready";
export type BlogAuthorType = "Person" | "Organization";

export const translationStatusOptions: Array<{ value: TranslationStatus; label: string }> = [
  { value: "Missing", label: "Missing" },
  { value: "Draft", label: "Draft" },
  { value: "Review", label: "Ready for review" },
  { value: "Ready", label: "Ready to publish" },
];

export const contentStatusOptions: Array<{ value: ContentStatus; label: string }> = [
  { value: "Draft", label: "Draft" },
  { value: "Published", label: "Published" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Archived", label: "Archived" },
];

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string | null;
  coverAlt: string | null;
  coverAltId: string | null;
  tags: string[];
  status: ContentStatus;
  author: string;
  authorType: BlogAuthorType;
  authorUrl: string | null;
  readMinutes: number;
  views: number;
  metaTitle: string | null;
  metaDescription: string | null;
  titleId: string | null;
  excerptId: string | null;
  bodyId: string | null;
  tagsId: string[];
  metaTitleId: string | null;
  metaDescriptionId: string | null;
  idTranslationStatus: TranslationStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentPage = {
  id: string;
  slug: string;
  title: string;
  body: string;
  status: ContentStatus;
  showInFooter: boolean;
  sortOrder: number;
  metaTitle: string | null;
  metaDescription: string | null;
  titleId: string | null;
  bodyId: string | null;
  metaTitleId: string | null;
  metaDescriptionId: string | null;
  idTranslationStatus: TranslationStatus;
  createdAt: string;
  updatedAt: string;
};

export type Testimonial = {
  id: string;
  customerName: string;
  location: string | null;
  quote: string;
  quoteId: string | null;
  idTranslationStatus: TranslationStatus;
  rating: number;
  productId: string | null;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type BannerPlacement = "HomeHero" | "HomeOwner" | "Promo";

export const bannerPlacementOptions: Array<{ value: BannerPlacement; label: string }> = [
  { value: "HomeHero", label: "Home hero" },
  { value: "HomeOwner", label: "Home owner" },
  { value: "Promo", label: "Promo" },
];

export const bannerPlacementTones: Record<BannerPlacement, "bronze" | "green" | "blue"> = {
  HomeHero: "bronze",
  HomeOwner: "green",
  Promo: "blue",
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  placement: BannerPlacement;
  focalX: number | null;
  focalY: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function truncate(value: string, length = 90): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
