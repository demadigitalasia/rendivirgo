import type { Metadata } from "next";
import { HomeContent } from "@/components/home-content";
import { absoluteUrl, siteUrl } from "@/lib/seo";
import { getCategories, getProducts, getPublicSettings, getSiteContent, getTestimonials } from "@/lib/storefront";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "RENDI VIRGO | Authentic Indonesian Stones",
  description:
    "Natural semi-precious stones from Indonesia — cabochons, rough, slabs, beads, and one-of-a-kind specimens selected for collectors and makers worldwide.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [featuredResult, categories, siteContent, testimonials, store] = await Promise.all([
    getProducts({ featured: true, pageSize: 4 }),
    getCategories(),
    getSiteContent(),
    getTestimonials(),
    getPublicSettings(),
  ]);

  let featured = featuredResult.products;
  if (!featured.length) {
    const latest = await getProducts({ pageSize: 4, sort: "newest" });
    featured = latest.products;
  }

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: store.store.name || "RENDI VIRGO",
    url: siteUrl(),
    logo: absoluteUrl("/brand/rendi-virgo-logo-black-silver.webp"),
    email: store.store.email || undefined,
    address: store.store.address
      ? { "@type": "PostalAddress", streetAddress: store.store.address }
      : undefined,
    sameAs: Object.values(store.store.socials ?? {}).filter(Boolean),
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: store.store.name || "RENDI VIRGO",
    url: siteUrl(),
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl()}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }} />
      <HomeContent
        featured={featured}
        categories={categories.slice(0, 5).map((category) => ({ slug: category.slug, name: category.name }))}
        siteContent={siteContent}
        testimonials={testimonials}
      />
    </>
  );
}
