import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/product-detail-client";
import { formatDimensions } from "@/lib/catalog";
import { getProductBySlug, getRelatedProducts } from "@/lib/storefront";

export const dynamic = "force-dynamic";

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.description,
    category: product.category,
    brand: { "@type": "Brand", name: "RENDI VIRGO" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: product.price,
      availability: product.status === "Available" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `https://rendivirgo.com/shop/${product.categorySlug}/${product.slug}`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductDetailClient product={product} related={related} />
    </>
  );
}
