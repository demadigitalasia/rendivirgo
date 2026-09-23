import type { Metadata } from "next";
import { SearchResults } from "@/components/search-results";
import { getProducts } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search | RENDI VIRGO",
  description: "Search the RENDI VIRGO collection by stone name, type, category, or Indonesian origin.",
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (rawQuery ?? "").trim();
  const { products } = query ? await getProducts({ search: query, pageSize: 48 }) : { products: [] };

  return <SearchResults query={query} products={products} />;
}
