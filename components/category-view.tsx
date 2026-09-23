"use client";

import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { useCopy } from "@/components/providers";

export function CategoryView({ name, note, products }: { name: string; note: string; products: Product[] }) {
  const t = useCopy();

  return (
    <>
      <section className="page-hero">
        <div className="page-container">
          <div className="eyebrow eyebrow--light">{t.shop.eyebrow}</div>
          <h1>{name}</h1>
          <p>
            {note}. {t.shop.categoryIntro}
          </p>
        </div>
      </section>
      <section className="page-container section">
        <div className="section-heading">
          <h2>{t.shop.count(products.length)}</h2>
        </div>
        {products.length ? (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {t.shop.emptyCategory} <Link href="/shop" className="text-button">{t.shop.browseFull}</Link>
          </div>
        )}
      </section>
    </>
  );
}
