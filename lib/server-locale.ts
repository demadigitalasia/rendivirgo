import { headers } from "next/headers";
import { languageCookiePresentHeaderName, languageHeaderName, normalizeLanguage } from "@/lib/locale";
import type { Language } from "@/lib/i18n";

export async function getRequestLanguage(): Promise<Language> {
  const requestHeaders = await headers();
  return normalizeLanguage(requestHeaders.get(languageHeaderName));
}

export async function hasLanguagePreferenceCookie(): Promise<boolean> {
  const requestHeaders = await headers();
  return requestHeaders.get(languageCookiePresentHeaderName) === "1";
}
