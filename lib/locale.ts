import type { Language } from "@/lib/i18n";
export type { Language } from "@/lib/i18n";

export const supportedLanguages: Language[] = ["en", "id"];
export const languageCookieName = "rv_language";
export const languageHeaderName = "x-rv-language";
export const originalPathHeaderName = "x-rv-original-path";
export const languageCookiePresentHeaderName = "x-rv-language-cookie-present";

export function normalizeLanguage(value: string | null | undefined): Language {
  return value === "id" ? "id" : "en";
}

export function stripLocalePrefix(pathname: string): string {
  const path = pathname.replace(/^\/(?:en|id)(?=\/|$)/, "") || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function localizedPath(pathname: string, language: Language): string {
  const basePath = stripLocalePrefix(pathname);
  if (language === "en") return basePath;
  return basePath === "/" ? "/id" : `/id${basePath}`;
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

export function localizedAlternates(pathname: string, language: Language) {
  const basePath = stripLocalePrefix(pathname);
  return {
    canonical: localizedPath(basePath, language),
    languages: { en: basePath, id: localizedPath(basePath, "id") },
  };
}
