import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/product-detail-client";
import { formatDimensions } from "@/lib/catalog";
import { absoluteUrl, breadcrumbJsonLd, socialMetadata } from "@/lib/seo";
import { getProductBySlug, getProductReviewSummary, getRelatedProducts } from "@/lib/storefront";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates, localizedPath } from "@/lib/locale";
import { dictionaries } from "@/lib/i18n";

// Product content is localized from request headers, so render each detail page at request time.
// The underlying API fetches keep their own 60-second cache.
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const language = await getRequestLanguage();
  const [product, translatedProduct] = await Promise.all([
    getProductBySlug(slug, language),
    language === "en" ? getProductBySlug(slug, "id") : Promise.resolve(null),
  ]);
  if (!product) return {};
  const englishFallback = language === "id" && product.contentLocale === "en";
  const hasIndonesianTranslation = language === "id" ? !englishFallback : translatedProduct?.contentLocale === "id";
  const path = `/shop/${product.categorySlug}/${product.slug}`;
  const title = englishFallback
    ? `${product.name} | RENDI VIRGO`
    : product.seo.metaTitle || `${product.name} — ${product.category} | RENDI VIRGO`;
  const description = englishFallback
    ? `${dictionaries.id.draft.fallback} ${product.name}. ${product.stoneType}${product.origin ? ` dari ${product.origin}` : ""}. Berat ${product.weightGram} g.`
    : product.seo.metaDescription ||
      [product.description, product.stoneType, product.origin ? `from ${product.origin}` : "", `${product.weightGram} g`, formatDimensions(product.dimensionsMm)]
        .filter(Boolean)
        .join(" ").slice(0, 160);
  return {
    title,
    description,
    alternates: localizedAlternates(path, language, hasIndonesianTranslation),
    ...socialMetadata(title, description, hasIndonesianTranslation ? localizedPath(path, language) : path, product.images[0]),
  };
}

export default async function ProductPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const language = await getRequestLanguage();
  const product = await getProductBySlug(slug, language);
  if (!product || product.categorySlug !== category) notFound();

  const related = await getRelatedProducts(slug, 4, language);
  const reviewSummary = await getProductReviewSummary(slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.description,
    category: product.category,
    image: product.images.slice(0, 4).map((image) => absoluteUrl(image)),
    brand: { "@type": "Brand", name: "RENDI VIRGO" },
    weight: { "@type": "QuantitativeValue", value: product.weightGram, unitCode: "GRM" },
    ...(reviewSummary.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviewSummary.rating,
            reviewCount: reviewSummary.count,
          },
        }
      : {}),
    additionalProperty: [
      { "@type": "PropertyValue", name: "Stone type", value: product.stoneType },
      ...(product.origin ? [{ "@type": "PropertyValue", name: "Origin", value: product.origin }] : []),
      { "@type": "PropertyValue", name: "Condition", value: product.condition },
      ...(product.mohsHardness ? [{ "@type": "PropertyValue", name: "Mohs hardness", value: product.mohsHardness }] : []),
    ],
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: product.price,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: absoluteUrl(localizedPath(`/shop/${product.categorySlug}/${product.slug}`, language)),
    },
  };
  const breadcrumbs = breadcrumbJsonLd([
    { name: dictionaries[language].nav.home, path: "/" },
    { name: dictionaries[language].nav.shop, path: "/shop" },
    { name: product.category, path: `/shop/${product.categorySlug}` },
    { name: product.name, path: `/shop/${product.categorySlug}/${product.slug}` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c") }} />
      <ProductDetailClient product={product} related={related} />
    </>
  );
}
