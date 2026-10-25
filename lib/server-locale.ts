import { headers } from "next/headers";
import { languageHeaderName, normalizeLanguage } from "@/lib/locale";
import type { Language } from "@/lib/i18n";

export async function getRequestLanguage(): Promise<Language> {
  const requestHeaders = await headers();
  return normalizeLanguage(requestHeaders.get(languageHeaderName));
}
