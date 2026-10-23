import type { Metadata } from "next";
import { HomeContent } from "@/components/home-content";
import { absoluteUrl, siteUrl, socialMetadata } from "@/lib/seo";
import { getCategories, getProducts, getPublicSettings, getSiteContent, getTestimonials } from "@/lib/storefront";
import { dictionaries } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates, localizedPath } from "@/lib/locale";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();
  const content = await getSiteContent(language);
  const translated = language !== "id" || content.contentLocale === "id";
  const title = (translated && content.metaTitle?.trim()) || `RENDI VIRGO | ${dictionaries[language].metadata.homeTitle}`;
  const description = (translated && content.metaDescription?.trim()) || dictionaries[language].metadata.homeDescription;
  return {
    title,
    description,
    ...socialMetadata(title, description, localizedPath("/", language), content.heroImage),
    alternates: localizedAlternates("/", language),
  };
}

export default async function HomePage() {
  const language = await getRequestLanguage();
  const [featuredResult, categories, siteContent, testimonials, store] = await Promise.all([
    getProducts({ featured: true, pageSize: 4 }, language),
    getCategories(language),
    getSiteContent(language),
    getTestimonials(language),
    getPublicSettings(),
  ]);

  let featured = featuredResult.products;
  if (!featured.length) {
    const latest = await getProducts({ pageSize: 4, sort: "newest" }, language);
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website).replace(/</g, "\\u003c") }} />
      <HomeContent
        featured={featured}
        categories={categories
          .slice(0, 5)
          .map((category) => ({ slug: category.slug, name: category.name, imageUrl: category.imageUrl, contentLocale: category.contentLocale }))}
        siteContent={siteContent}
        testimonials={testimonials}
        whatsapp={store.store.whatsapp}
        whatsappSecondary={store.store.whatsappSecondary}
      />
    </>
  );
}
