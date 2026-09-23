"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ProductCard } from "@/components/product-card";
import { useCopy } from "@/components/providers";
import type { Product } from "@/lib/catalog";

export function ShopCatalog({
  products,
  categories,
  stoneTypes,
}: {
  products: Product[];
  categories: Array<{ slug: string; name: string }>;
  stoneTypes: string[];
}) {
  const t = useCopy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? "all";
  const stone = searchParams.get("stone") ?? "all";
  const price = searchParams.get("price") ?? "all";
  const weight = searchParams.get("weight") ?? "all";
  const origin = searchParams.get("origin") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const sort = searchParams.get("sort") ?? "featured";

  const origins = useMemo(() => [...new Set(products.map((product) => product.origin))].sort(), [products]);

  const setParam = (key: string, value: string, defaultValue = "all") => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `/shop?${query}` : "/shop", { scroll: false });
  };

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesCategory = category === "all" || product.categorySlug === category;
      const matchesStone = stone === "all" || product.stoneType === stone;
      const matchesOrigin = origin === "all" || product.origin === origin;
      const matchesStatus = status === "all" || product.status === status;
      const matchesPrice =
        price === "all" ||
        (price === "under100" && product.price < 100) ||
        (price === "100to250" && product.price >= 100 && product.price <= 250) ||
        (price === "over250" && product.price > 250);
      const matchesWeight =
        weight === "all" ||
        (weight === "under100" && product.weightGram < 100) ||
        (weight === "100to500" && product.weightGram >= 100 && product.weightGram <= 500) ||
        (weight === "over500" && product.weightGram > 500);
      return matchesCategory && matchesStone && matchesOrigin && matchesStatus && matchesPrice && matchesWeight;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "price-low") return a.price - b.price;
      if (sort === "price-high") return b.price - a.price;
      if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    });
  }, [products, category, stone, price, weight, origin, status, sort]);

  const hasActiveFilters = [category, stone, price, weight, origin, status].some((value) => value !== "all");
  const statusOptions = [
    { value: "Available", label: t.common.available },
    { value: "Reserved", label: t.common.reserved },
    { value: "Sold", label: t.common.sold },
  ];

  return (
    <>
      <section className="page-hero">
        <div className="page-container">
          <div className="eyebrow eyebrow--light">{t.shop.eyebrow}</div>
          <h1>{t.shop.title}</h1>
          <p>{t.shop.intro}</p>
        </div>
      </section>
      <section className="page-container section">
        <div className="catalog-toolbar">
          <span className="muted" aria-live="polite">
            {t.shop.count(visibleProducts.length)}
          </span>
          <div className="catalog-toolbar__controls">
            <select
              className="select-control"
              value={stone}
              onChange={(event) => setParam("stone", event.target.value)}
              aria-label={t.shop.filterStone}
            >
              <option value="all">{t.shop.allStones}</option>
              {stoneTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              className="select-control"
              value={sort}
              onChange={(event) => setParam("sort", event.target.value, "featured")}
              aria-label={t.shop.sortLabel}
            >
              <option value="featured">{t.shop.sortFeatured}</option>
              <option value="newest">{t.shop.sortNewest}</option>
              <option value="price-low">{t.shop.sortPriceLow}</option>
              <option value="price-high">{t.shop.sortPriceHigh}</option>
            </select>
          </div>
        </div>
        <div className="catalog-layout">
          <aside className="filter-panel">
            <h2>{t.shop.browse}</h2>
            <div className="filter-group">
              <label>
                <input
                  type="radio"
                  name="category-filter"
                  checked={category === "all"}
                  onChange={() => setParam("category", "all")}
                />
                {t.shop.allPieces}
              </label>
              {categories.map((item) => (
                <label key={item.slug}>
                  <input
                    type="radio"
                    name="category-filter"
                    checked={category === item.slug}
                    onChange={() => setParam("category", item.slug)}
                  />
                  {item.name}
                </label>
              ))}
            </div>
            <div className="filter-field">
              <label htmlFor="filter-price">{t.shop.filterPrice}</label>
              <select
                id="filter-price"
                className="select-control"
                value={price}
                onChange={(event) => setParam("price", event.target.value)}
              >
                <option value="all">{t.shop.allPrices}</option>
                <option value="under100">{t.shop.priceUnder100}</option>
                <option value="100to250">{t.shop.price100to250}</option>
                <option value="over250">{t.shop.priceOver250}</option>
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="filter-weight">{t.shop.filterWeight}</label>
              <select
                id="filter-weight"
                className="select-control"
                value={weight}
                onChange={(event) => setParam("weight", event.target.value)}
              >
                <option value="all">{t.shop.allWeights}</option>
                <option value="under100">{t.shop.weightUnder100}</option>
                <option value="100to500">{t.shop.weight100to500}</option>
                <option value="over500">{t.shop.weightOver500}</option>
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="filter-origin">{t.shop.filterOrigin}</label>
              <select
                id="filter-origin"
                className="select-control"
                value={origin}
                onChange={(event) => setParam("origin", event.target.value)}
              >
                <option value="all">{t.shop.allOrigins}</option>
                {origins.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="filter-status">{t.shop.filterStatus}</label>
              <select
                id="filter-status"
                className="select-control"
                value={status}
                onChange={(event) => setParam("status", event.target.value)}
              >
                <option value="all">{t.shop.allStatuses}</option>
                {statusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button type="button" className="text-button" onClick={() => router.replace("/shop", { scroll: false })}>
                {t.shop.clearFilters}
              </button>
            )}
          </aside>
          <div>
            {visibleProducts.length ? (
              <div className="product-grid">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="empty-state">{t.shop.empty}</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
