import defaults from "@/api/src/content/hero-defaults.json";

export type HeroCopy = {
  label: string; eyebrow: string; title: string; description: string; ctaLabel: string;
  secondaryLabel: string; alt: string; cardTitle: string; cardDetail: string;
};
export type HeroProduct = { name: string; nameId: string; price: number; detail: string; href: string };
export type HeroSlide = {
  id: string; name: string; isActive: boolean; translationStatus: "Missing" | "Draft" | "Review" | "Ready";
  en: HeroCopy; idCopy: HeroCopy; imageUrl: string; mobileImageUrl: string;
  focalX: number; focalY: number; mobileFocalX: number; mobileFocalY: number;
  overlay: number; alignment: "left" | "center" | "right";
  ctaHref: string; secondaryHref: string; cardType: "none" | "product" | "info";
  productId: string; cardHref: string; product?: HeroProduct | null;
};
export type HeroSettings = { autoplay: boolean; duration: number; transitionMs: number; textAnimation: "fade-up" | "fade" | "none"; imageMotion: boolean };
export type HeroDocument = { version: string; settings: HeroSettings; slides: HeroSlide[] };
export const DEFAULT_HERO = defaults as HeroDocument;
export function heroCopy(slide: HeroSlide, language: "en" | "id") {
  return language === "id" && slide.translationStatus === "Ready" ? slide.idCopy : slide.en;
}
