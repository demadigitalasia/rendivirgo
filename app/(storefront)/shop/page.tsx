import { socialMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopCatalog } from "@/components/shop-catalog";
import { getCategories, getProductFilters, getProducts } from "@/lib/storefront";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates, localizedPath } from "@/lib/locale";
import { dictionaries } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [language, params] = await Promise.all([getRequestLanguage(), searchParams]);
  const t = dictionaries[language].metadata;
  const get = (key: string) => Array.isArray(params[key]) ? params[key]?.[0] : params[key];
  const page = Math.max(1, Number(get("page")) || 1);
  const hasFilters = (get("category") && get("category") !== "all") ||
    (get("stone") && get("stone") !== "all") ||
    (get("price") && get("price") !== "all") ||
    (get("weight") && get("weight") !== "all") ||
    (get("origin") && get("origin") !== "all") ||
    (get("sort") && get("sort") !== "featured");
  const path = !hasFilters && page > 1 ? `/shop?page=${page}` : "/shop";
  return {
    title: t.shopTitle,
    description: t.shopDescription,
    alternates: hasFilters
      ? { canonical: localizedPath("/shop", language) }
      : page > 1
        ? {
            canonical: localizedPath(path, language),
            languages: { en: path, id: localizedPath(path, "id") },
          }
        : localizedAlternates("/shop", language),
    ...(hasFilters ? { robots: { index: false, follow: true } } : {}),
    ...socialMetadata(t.shopTitle, t.shopDescription, localizedPath(path, language)),
  };
}

const PAGE_SIZE = 12;

type ShopSearchParams = Record<string, string | string[] | undefined>;

const priceRange = (value: string) => {
  if (value === "under100") return { maxPrice: 99.99 };
  if (value === "100to250") return { minPrice: 100, maxPrice: 250 };
  if (value === "over250") return { minPrice: 250.01 };
  return {};
};

const weightRange = (value: string) => {
  if (value === "under100") return { maxWeightGram: 99 };
  if (value === "100to500") return { minWeightGram: 100, maxWeightGram: 500 };
  if (value === "over500") return { minWeightGram: 501 };
  return {};
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<ShopSearchParams> }) {
  const params = await searchParams;
  const language = await getRequestLanguage();
  const get = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const page = Math.max(1, Number(get("page")) || 1);
  const category = get("category") ?? "all";
  const stone = get("stone") ?? "all";
  const price = get("price") ?? "all";
  const weight = get("weight") ?? "all";
  const origin = get("origin") ?? "all";
  const sort = get("sort") ?? "featured";

  const [result, categories, filters] = await Promise.all([
    getProducts({
      page,
      pageSize: PAGE_SIZE,
      sort: sort as "featured",
      ...(category !== "all" ? { category } : {}),
      ...(stone !== "all" ? { stoneType: stone } : {}),
      ...(origin !== "all" ? { origin } : {}),
      ...priceRange(price),
      ...weightRange(weight),
    }, language),
    getCategories(language),
    getProductFilters(),
  ]);

  return (
    <Suspense fallback={<div className="page-container section" style={{ minHeight: 420 }} />}>
      <ShopCatalog
        products={result.products}
        total={result.total}
        page={page}
        pageCount={result.pageCount}
        categories={categories.map((entry) => ({ slug: entry.slug, name: entry.name }))}
        stoneTypes={filters.stoneTypes}
        origins={filters.origins}
      />
    </Suspense>
  );
}
