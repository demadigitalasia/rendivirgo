"use client";

import Link from "@/components/localized-link";
import Image from "next/image";
import type { Product } from "@/lib/catalog";
import { Breadcrumb } from "@/components/breadcrumb";
import { Pagination } from "@/components/pagination";
import { ProductCard } from "@/components/product-card";
import { useCopy, useLanguage } from "@/components/providers";

export function CategoryView({
  name,
  contentLocale,
  note,
  imageUrl,
  products,
  total,
  page,
  pageCount,
}: {
  name: string;
  contentLocale: "en" | "id";
  note: string;
  imageUrl?: string | null;
  products: Product[];
  total: number;
  page: number;
  pageCount: number;
}) {
  const t = useCopy();
  const { language } = useLanguage();

  return (
    <>
      <section className={`page-hero ${imageUrl ? "page-hero--image" : ""}`}>
        {imageUrl ? (
          <Image className="page-hero__image" src={imageUrl} alt="" fill sizes="100vw" unoptimized />
        ) : null}
        <div className="page-container page-hero__content">
          <Breadcrumb contained={false} tone="light" items={[{ key: "shop", href: "/shop" }, { label: name }]} />
          <div className="eyebrow eyebrow--light">{t.shop.eyebrow}</div>
          {language === "id" && contentLocale === "en" ? <p className="muted" role="note">{t.draft.fallback}</p> : null}
          <h1 lang={contentLocale}>{name}</h1>
          <p><span lang={contentLocale}>{note}.</span> <span lang={language}>{t.shop.categoryIntro}</span></p>
        </div>
      </section>
      <section className="page-container section">
        <div className="section-heading">
          <h2>{t.shop.count(total)}</h2>
        </div>
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
            {t.shop.emptyCategory} <Link href="/shop" className="text-button">{t.shop.browseFull}</Link>
          </div>
        )}
      </section>
    </>
  );
}
