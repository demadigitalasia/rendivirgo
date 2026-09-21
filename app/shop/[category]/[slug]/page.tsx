import Link from "next/link";
import { ProductDetailClient } from "@/components/product-detail-client";
import { categories, getProduct, products } from "@/lib/catalog";

export function generateStaticParams() { return products.map((product) => ({ category: product.categorySlug, slug: product.slug })); }

export default async function ProductPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const product = getProduct(category, slug);
  if (!product) return <div className="page-container content-page"><h1>Piece not found</h1><p className="muted">This stone may have moved into a private collection.</p><Link href="/shop" className="button">Return to shop</Link></div>;
  return <ProductDetailClient product={product} />;
}
