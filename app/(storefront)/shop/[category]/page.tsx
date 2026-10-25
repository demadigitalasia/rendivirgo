import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryView } from "@/components/category-view";
import { breadcrumbJsonLd, socialMetadata } from "@/lib/seo";
import { getCategory, getProducts } from "@/lib/storefront";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates, localizedPath } from "@/lib/locale";
import { dictionaries } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const [language, query] = await Promise.all([getRequestLanguage(), searchParams]);
  const [category, translatedCategory] = await Promise.all([
    getCategory(slug, language),
    language === "en" ? getCategory(slug, "id") : Promise.resolve(null),
  ]);
  if (!category) return {};
  const englishFallback = language === "id" && category.contentLocale === "en";
  const hasIndonesianTranslation = language === "id" ? !englishFallback : translatedCategory?.contentLocale === "id";
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = Math.max(1, Number(rawPage) || 1);
  const path = `/shop/${category.slug}${page > 1 ? `?page=${page}` : ""}`;
  const note = category.description ?? (language === "id" ? "Batu alam dari Indonesia" : "Indonesian natural stones");
  const title = (!englishFallback && category.metaTitle?.trim()) || `${category.name} | RENDI VIRGO`;
  const description = englishFallback
    ? `${dictionaries.id.draft.fallback} ${category.name}. ${note}.`
    : category.metaDescription?.trim() || `${category.name} from RENDI VIRGO. ${note}`.slice(0, 160);
  return {
    title,
    description,
    alternates: localizedAlternates(path, language, hasIndonesianTranslation),
    ...socialMetadata(title, description, hasIndonesianTranslation ? localizedPath(path, language) : path, category.imageUrl || undefined),
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
