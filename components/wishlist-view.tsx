"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { useCopy } from "@/components/providers";
import type { Product } from "@/lib/catalog";
import { mapProduct, type ApiProduct } from "@/lib/storefront";

export const WISHLIST_STORAGE_KEY = "rendi-virgo-wishlist";
export const WISHLIST_EVENT = "rv:wishlist-change";

const readIds = (): string[] => {
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
};

export function WishlistView() {
  const t = useCopy();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const ids = readIds();
      if (!ids.length) {
        setProducts([]);
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/products?ids=${ids.join(",")}&pageSize=100`, {
          headers: { accept: "application/json" },
        });
        const payload = response.ok ? ((await response.json()) as { items: ApiProduct[] }) : { items: [] };
        setProducts(payload.items.map(mapProduct));
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const onWishlistChange = () => {
      const ids = new Set(readIds());
      setProducts((current) => current.filter((product) => ids.has(product.id)));
    };
    window.addEventListener(WISHLIST_EVENT, onWishlistChange);
    return () => window.removeEventListener(WISHLIST_EVENT, onWishlistChange);
  }, []);

  const clearWishlist = () => {
    try {
      window.localStorage.removeItem(WISHLIST_STORAGE_KEY);
    } catch {
      // Storage unavailable — nothing else to clear.
    }
    setProducts([]);
  };

  return (
    <>
      <section className="page-hero">
        <div className="page-container">
          <div className="eyebrow eyebrow--light">{t.wishlist.eyebrow}</div>
          <h1>{t.wishlist.title}</h1>
          <p>{t.wishlist.intro}</p>
        </div>
      </section>
      <section className="page-container section">
        {loading ? null : products.length ? (
          <>
            <div className="catalog-toolbar">
              <span className="muted">{t.wishlist.count(products.length)}</span>
              <button type="button" className="text-button" onClick={clearWishlist}>
                {t.wishlist.clear}
              </button>
            </div>
            <div className="product-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>{t.wishlist.empty}</p>
            <p className="muted">{t.wishlist.emptyBody}</p>
            <Link href="/shop" className="button" style={{ marginTop: 16 }}>
              {t.wishlist.browse}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
