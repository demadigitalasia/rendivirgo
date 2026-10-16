import type { Metadata } from "next";
import { SearchResults } from "@/components/search-results";
import { getProductsWithStatus } from "@/lib/storefront";
import { getRequestLanguage } from "@/lib/server-locale";
import { storefrontMetadata } from "@/lib/storefront-metadata";

export const dynamic = "force-dynamic";

export const generateMetadata = (): Promise<Metadata> => storefrontMetadata("search", "/search", { robots: { index: false, follow: true } });

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
  const language = await getRequestLanguage();
  const page = Math.max(1, Number(rawPage) || 1);

  const result = query
    ? await getProductsWithStatus({ search: query, page, pageSize: PAGE_SIZE }, { revalidate: 0, language })
    : { status: "ok" as const, products: [], total: 0, pageCount: 1 };

  return (
    <SearchResults
      query={query}
      products={result.status === "ok" ? result.products : []}
      total={result.status === "ok" ? result.total : 0}
      page={page}
      pageCount={result.status === "ok" ? result.pageCount : 1}
      unavailable={result.status === "unavailable"}
    />
  );
}
