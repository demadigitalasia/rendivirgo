import { normalizeLanguage } from "@/lib/locale";
import type { Language } from "@/lib/i18n";

// The storefront is English-only; the per-request language header belonged to the
// retired locale system. Keep the async shape so callers stay untouched, and keep
// this header-free so storefront routes can be prerendered/ISR instead of dynamic.
export async function getRequestLanguage(): Promise<Language> {
  return normalizeLanguage(null);
}
