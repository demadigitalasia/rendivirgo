import type { Metadata } from "next";
import { HomeContent } from "@/components/home-content";
import { absoluteUrl, siteUrl, socialMetadata } from "@/lib/seo";
import { getHeroSlides, getBlogPosts, getCategories, getProducts, getPublicSettings, getSiteContent, getTestimonials } from "@/lib/storefront";
import { dictionaries } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates, localizedPath } from "@/lib/locale";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();
  const [content, translatedContent, heroDocument] = await Promise.all([
    getSiteContent(language),
    language === "en" ? getSiteContent("id") : Promise.resolve(null),
    getHeroSlides(),
  ]);
  const hasIndonesianTranslation = language === "id" ? content.contentLocale === "id" : translatedContent?.contentLocale === "id";
  const translated = language !== "id" || content.contentLocale === "id";
  const title = (translated && content.metaTitle?.trim()) || `RENDI VIRGO | ${dictionaries[language].metadata.homeTitle}`;
  const description = (translated && content.metaDescription?.trim()) || dictionaries[language].metadata.homeDescription;
  return {
    title,
    description,
    ...socialMetadata(title, description, hasIndonesianTranslation ? localizedPath("/", language) : "/", heroDocument.slides.find(slide => slide.isActive)?.imageUrl || content.heroImage),
    alternates: localizedAlternates("/", language, hasIndonesianTranslation),
  };
}

export default async function HomePage() {
  const language = await getRequestLanguage();
  const [featuredResult, categories, siteContent, testimonials, store, heroDocument, journalResult] = await Promise.all([
    getProducts({ featured: true, pageSize: 4 }, language),
    getCategories(language),
    getSiteContent(language),
    getTestimonials(language),
    getPublicSettings(),
    getHeroSlides(),
    getBlogPosts({ pageSize: 3 }, language),
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
    logo: absoluteUrl("/brand/rendi-virgo-primary.webp"),
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
        heroDocument={heroDocument}
        featured={featured}
        categories={categories
          .slice(0, 5)
          .map((category) => ({ slug: category.slug, name: category.name, imageUrl: category.imageUrl, contentLocale: category.contentLocale }))}
        siteContent={siteContent}
        testimonials={testimonials}
        articles={journalResult.posts}
        whatsapp={store.store.whatsapp}
        whatsappSecondary={store.store.whatsappSecondary}
      />
    </>
  );
}
