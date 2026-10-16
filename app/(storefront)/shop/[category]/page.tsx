import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryView } from "@/components/category-view";
import { breadcrumbJsonLd } from "@/lib/seo";
import { getCategory, getProducts } from "@/lib/storefront";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates } from "@/lib/locale";
import { dictionaries } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params;
  const language = await getRequestLanguage();
  const category = await getCategory(slug, language);
  if (!category) return {};
  const englishFallback = language === "id" && category.contentLocale === "en";
  const note = category.description ?? (language === "id" ? "Batu alam dari Indonesia" : "Indonesian natural stones");
  const title = englishFallback ? `${category.name} | RENDI VIRGO` : `${category.name} — ${note} | RENDI VIRGO`;
  const description = englishFallback
    ? `${dictionaries.id.draft.fallback} ${category.name}. ${note}.`
    : `${category.name} from RENDI VIRGO. ${note}. Every piece is documented with its origin, condition, weight, and availability.`;
  return {
    title,
    description,
    alternates: localizedAlternates(`/shop/${category.slug}`, language),
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
  const language = await getRequestLanguage();
  const query = await searchParams;
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = Math.max(1, Number(rawPage) || 1);

  const [category, result] = await Promise.all([
    getCategory(slug, language),
    getProducts({ category: slug, page, pageSize: PAGE_SIZE, sort: "featured" }, language),
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
        contentLocale={category.contentLocale}
        note={category.description ?? (language === "id" ? "Batu alam Indonesia" : "Indonesian natural stones")}
        imageUrl={category.imageUrl}
        products={result.products}
        total={result.total}
        page={page}
        pageCount={result.pageCount}
      />
    </>
  );
}
