import type { Metadata } from "next";
import { SearchResults } from "@/components/search-results";
import { getProducts } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search | RENDI VIRGO",
  description: "Search the RENDI VIRGO collection by stone name, type, category, or Indonesian origin.",
  robots: { index: false, follow: true },
};

const PAGE_SIZE = 12;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const query = (rawQuery ?? "").trim();
  const page = Math.max(1, Number(rawPage) || 1);

  const result = query
    ? await getProducts({ search: query, page, pageSize: PAGE_SIZE })
    : { products: [], total: 0, pageCount: 1 };

  return <SearchResults query={query} products={result.products} total={result.total} page={page} pageCount={result.pageCount} />;
}
