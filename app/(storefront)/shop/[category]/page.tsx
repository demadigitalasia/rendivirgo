import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryView } from "@/components/category-view";
import { getCategory, getProducts } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};
  const note = category.description ?? "Indonesian natural stones";
  return {
    title: `${category.name} — ${note} | RENDI VIRGO`,
    description: `${category.name} from RENDI VIRGO. ${note}. Every piece is documented with its origin, condition, weight, and availability.`,
    alternates: { canonical: `/shop/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const [category, result] = await Promise.all([getCategory(slug), getProducts({ category: slug, pageSize: 100 })]);
  if (!category) notFound();

  return (
    <CategoryView
      name={category.name}
      note={category.description ?? "Indonesian natural stones"}
      products={result.products}
    />
  );
}
