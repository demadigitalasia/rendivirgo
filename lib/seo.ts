import type { Metadata } from "next";

export function socialMetadata(title: string, description: string, path: string, image = "/images/rendi-virgo-hero-stones.webp"): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: { type: "website", locale: /^\/id(?:\/|$)/.test(path) ? "id_ID" : "en_GB", siteName: "RENDI VIRGO", title, description, url: absoluteUrl(path), images: [absoluteUrl(image)] },
    twitter: { card: "summary_large_image", title, description, images: [absoluteUrl(image)] },
  };
}

export const siteUrl = (): string =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://rendivirgo.com").replace(/\/+$/, "");

export const absoluteUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
};

export type Crumb = { name: string; path: string };

export const breadcrumbJsonLd = (items: Crumb[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
});
