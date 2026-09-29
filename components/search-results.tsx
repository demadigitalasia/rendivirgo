"use client";

import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { Breadcrumb } from "@/components/breadcrumb";
import { Pagination } from "@/components/pagination";
import { ProductCard } from "@/components/product-card";
import { useCopy } from "@/components/providers";

export function SearchResults({
  query,
  products,
  total,
  page,
  pageCount,
}: {
  query: string;
  products: Product[];
  total: number;
  page: number;
  pageCount: number;
}) {
  const t = useCopy();

  return (
    <>
      <section className="page-hero">
        <div className="page-container">
          <Breadcrumb contained={false} tone="light" items={[{ key: "search" }]} />
          <div className="eyebrow eyebrow--light">{t.search.eyebrow}</div>
          <h1>{t.search.title}</h1>
          <p>{t.search.intro}</p>
        </div>
      </section>
      <section className="page-container section">
        {!query ? (
          <p className="muted">{t.search.prompt}</p>
        ) : (
          <>
            <div className="section-heading">
              <h2>{t.search.query(query)}</h2>
            </div>
            <p className="muted" aria-live="polite" style={{ marginBottom: 18 }}>
              {t.search.count(total)}
            </p>
            {products.length ? (
              <>
                <div className="product-grid">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                <Pagination page={page} pageCount={pageCount} />
              </>
            ) : (
              <div className="empty-state">
                {t.search.empty} <Link href="/shop" className="text-button">{t.shop.browseFull}</Link>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
