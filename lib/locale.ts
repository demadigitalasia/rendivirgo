import type { Language } from "@/lib/i18n";
export type { Language } from "@/lib/i18n";

export const supportedLanguages: Language[] = ["en"];
export const languageCookieName = "rv_language";
export const languageHeaderName = "x-rv-language";
export const originalPathHeaderName = "x-rv-original-path";

export function normalizeLanguage(value: string | null | undefined): Language {
  void value;
  return "en";
}

export function stripLocalePrefix(pathname: string): string {
  const path = pathname.replace(/^\/(?:en|id)(?=\/|$)/, "") || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function localizedPath(pathname: string, language: Language): string {
  void language;
  const basePath = stripLocalePrefix(pathname);
  return basePath;
}

export function localizedHref(href: string, language: Language): string {
  if (
    !href.startsWith("/") ||
    href.startsWith("//") ||
    href.startsWith("/api/") ||
    href.startsWith("/_next/")
  ) {
    return href;
  }

  const boundary = href.search(/[?#]/);
  const pathname = boundary === -1 ? href : href.slice(0, boundary);
  const suffix = boundary === -1 ? "" : href.slice(boundary);
  return `${localizedPath(pathname || "/", language)}${suffix}`;
}

export function localizedAlternates(pathname: string, _language: Language, _hasIndonesianTranslation = true) {
  const basePath = stripLocalePrefix(pathname);
  return {
    canonical: basePath,
    languages: { en: basePath },
  };
}
