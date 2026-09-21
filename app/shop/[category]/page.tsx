import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { categories, products, getCategory } from "@/lib/catalog";

export function generateStaticParams() { return categories.map((category) => ({ category: category.slug })); }

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = getCategory(slug);
  const items = products.filter((product) => product.categorySlug === slug);
  if (!category) return <div className="page-container content-page"><h1>Collection not found</h1><Link href="/shop" className="button">Back to shop</Link></div>;
  return <><section className="page-hero"><div className="page-container"><div className="eyebrow eyebrow--light">Shop by category</div><h1>{category.name}</h1><p>{category.note}. Each piece is represented with its origin, condition, weight, and availability.</p></div></section><section className="page-container section"><div className="section-heading"><h2>{items.length} pieces</h2></div>{items.length ? <div className="product-grid">{items.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state">This category is being curated. <Link href="/shop" className="text-button">Browse the full collection</Link></div>}</section></>;
}
