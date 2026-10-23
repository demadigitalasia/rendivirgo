import { socialMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { dictionaries } from "@/lib/i18n";
import { localizedAlternates, localizedPath } from "@/lib/locale";
import { getRequestLanguage } from "@/lib/server-locale";

export type StorefrontMetadataKey =
  | "home" | "about" | "shop" | "contact" | "search" | "cart" | "checkout" | "wishlist"
  | "orders" | "track" | "returns" | "faq" | "shipping" | "privacy" | "terms";

export async function storefrontMetadata(
  key: StorefrontMetadataKey,
  path: string,
  options: Pick<Metadata, "robots"> = {},
): Promise<Metadata> {
  const language = await getRequestLanguage();
  const metadata = dictionaries[language].metadata;
  return {
    title: metadata[`${key}Title`],
    description: metadata[`${key}Description`],
    alternates: localizedAlternates(path, language),
    ...socialMetadata(metadata[`${key}Title`], metadata[`${key}Description`], localizedPath(path, language)),
    ...options,
  };
}
