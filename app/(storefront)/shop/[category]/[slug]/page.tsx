import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/product-detail-client";
import { formatDimensions } from "@/lib/catalog";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";
import { getProductBySlug, getProductReviewSummary, getRelatedProducts, getAllPublishedProducts } from "@/lib/storefront";

export const revalidate = 60;

export async function generateStaticParams() {
  const products = await getAllPublishedProducts();
  return products.slice(0, 100).map((product) => ({ category: product.categorySlug, slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  const title = product.seo.metaTitle || `${product.name} — ${product.category} | RENDI VIRGO`;
  const description =
    product.seo.metaDescription ||
    `${product.description} ${product.stoneType} from ${product.origin}. ${product.weightGram} g, ${formatDimensions(product.dimensionsMm)}.`;
  return {
    title,
    description,
    alternates: { canonical: `/shop/${product.categorySlug}/${product.slug}` },
    openGraph: { title, description, type: "website", images: product.images.slice(0, 1) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.categorySlug !== category) notFound();

  const related = await getRelatedProducts(slug, 4);
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
      { "@type": "PropertyValue", name: "Origin", value: product.origin },
      { "@type": "PropertyValue", name: "Condition", value: product.condition },
      ...(product.mohsHardness ? [{ "@type": "PropertyValue", name: "Mohs hardness", value: product.mohsHardness }] : []),
    ],
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: product.price,
      availability: product.status === "Available" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: absoluteUrl(`/shop/${product.categorySlug}/${product.slug}`),
    },
  };
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
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
