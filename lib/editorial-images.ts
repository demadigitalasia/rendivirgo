const defaultCovers: Record<string, string> = {
  "how-to-read-a-cabochon": "/social/moss-agate-editorial-generated.png",
  "from-indonesia-to-your-workbench": "/images/rendi-virgo-owner.webp",
  "caring-for-polished-stones": "/social/img-1878-aqua-stones-editorial.png",
  "why-origin-matters": "/images/rendi-virgo-hero-stones.webp",
  "cabochon-or-faceted": "/social/moss-agate-editorial-generated.png",
  "packing-fragile-stones": "/images/rendi-virgo-owner.webp",
};

export function journalFallback(slug: string) {
  return defaultCovers[slug] || "/images/rendi-virgo-hero-stones.webp";
}

export function journalCover(src: string | null | undefined, slug: string) {
  // Seed content points to these six SVGs, which are absent from the asset bundle.
  if (!src || (defaultCovers[slug] && src === `/images/blog/${slug}.svg`)) return journalFallback(slug);
  return src;
}
