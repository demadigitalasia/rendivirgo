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
