import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopCatalog } from "@/components/shop-catalog";
import { getCategories, getProducts } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop Natural Indonesian Stones | RENDI VIRGO",
  description:
    "Browse cabochons, pairs, rough, slabs, specimens, tumbled stones, beads, and faceted gemstones. Every piece is documented with origin, condition, weight, and availability.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const [result, categories] = await Promise.all([getProducts({ pageSize: 100, sort: "newest" }), getCategories()]);
  const stoneTypes = [...new Set(result.products.map((product) => product.stoneType))].sort();

  return (
    <Suspense fallback={<div className="page-container section" style={{ minHeight: 420 }} />}>
      <ShopCatalog
        products={result.products}
        categories={categories.map((category) => ({ slug: category.slug, name: category.name }))}
        stoneTypes={stoneTypes}
      />
    </Suspense>
  );
}
