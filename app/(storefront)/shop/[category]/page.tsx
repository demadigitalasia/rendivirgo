import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryView } from "@/components/category-view";
import { breadcrumbJsonLd } from "@/lib/seo";
import { getCategory, getProducts } from "@/lib/storefront";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

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

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category: slug } = await params;
  const query = await searchParams;
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = Math.max(1, Number(rawPage) || 1);

  const [category, result] = await Promise.all([
    getCategory(slug),
    getProducts({ category: slug, page, pageSize: PAGE_SIZE, sort: "featured" }),
  ]);
  if (!category) notFound();

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
    { name: category.name, path: `/shop/${category.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c") }}
      />
      <CategoryView
        name={category.name}
        note={category.description ?? "Indonesian natural stones"}
        imageUrl={category.imageUrl}
        products={result.products}
        total={result.total}
        page={page}
        pageCount={result.pageCount}
      />
    </>
  );
}
