import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopCatalog } from "@/components/shop-catalog";
import { getCategories, getProductFilters, getProducts } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop Natural Indonesian Stones | RENDI VIRGO",
  description:
    "Browse cabochons, pairs, rough, slabs, specimens, tumbled stones, beads, and faceted gemstones. Every piece is documented with origin, condition, weight, and availability.",
  alternates: { canonical: "/shop" },
};

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
    }),
    getCategories(),
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
