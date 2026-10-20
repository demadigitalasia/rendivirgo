"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { Pagination } from "@/components/pagination";
import { ProductCard } from "@/components/product-card";
import { FilterDropdown } from "@/components/filter-dropdown";
import { CloseIcon } from "@/components/icons";
import { useCopy } from "@/components/providers";
import type { Product } from "@/lib/catalog";

export function ShopCatalog({
  products,
  total,
  page,
  pageCount,
  categories,
  stoneTypes,
  origins,
}: {
  products: Product[];
  total: number;
  page: number;
  pageCount: number;
  categories: Array<{ slug: string; name: string }>;
  stoneTypes: string[];
  origins: string[];
}) {
  const t = useCopy();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLElement>(null);
  const category = searchParams.get("category") ?? "all";
  const stone = searchParams.get("stone") ?? "all";
  const price = searchParams.get("price") ?? "all";
  const weight = searchParams.get("weight") ?? "all";
  const origin = searchParams.get("origin") ?? "all";
  const sort = searchParams.get("sort") ?? "featured";

  const setParam = (key: string, value: string, defaultValue = "all") => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const hasActiveFilters = [category, stone, price, weight, origin].some((value) => value !== "all");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => { setMobileFilters(media.matches); if (!media.matches) setFiltersOpen(false); };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!filtersOpen || !mobileFilters) return;
    const panel = filterPanelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
      if (event.key !== "Tab" || !panel) return;
      const controls = Array.from(panel.querySelectorAll<HTMLElement>("button, input, select, a[href]"));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      filterButtonRef.current?.focus();
    };
  }, [filtersOpen, mobileFilters]);

  return (
    <>
      <section className="page-hero page-hero--shop">
        <div className="page-container">
          <Breadcrumb contained={false} tone="light" items={[{ key: "shop" }]} />
          <div className="eyebrow eyebrow--light">{t.shop.eyebrow}</div>
          <h1>{t.shop.title}</h1>
          <p>{t.shop.intro}</p>
        </div>
      </section>
      <section className="page-container section">
        <button
          ref={filterButtonRef}
          className="filter-toggle"
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="shop-filters"
          onClick={() => setFiltersOpen(true)}
        >
          {t.shop.filterToggle}
          {hasActiveFilters ? <span className="filter-toggle__count" aria-hidden="true">•</span> : null}
        </button>
        {filtersOpen ? (
          <button className="filter-overlay" type="button" aria-label={t.shop.filterClose} onClick={() => setFiltersOpen(false)} />
        ) : null}
        <div className="catalog-toolbar">
          <span className="muted" aria-live="polite">
            {t.shop.count(total)}
          </span>
          <div className="catalog-toolbar__controls">
            <FilterDropdown
              id="filter-stone-type"
              value={stone}
              ariaLabel={t.shop.filterStone}
              compact
              wideMenu
              onChange={(value) => setParam("stone", value)}
              options={[
                { value: "all", label: t.shop.allStones },
                ...stoneTypes.map((item) => ({ value: item, label: item })),
              ]}
            />
            <FilterDropdown
              id="filter-sort"
              value={sort}
              ariaLabel={t.shop.sortLabel}
              compact
              onChange={(value) => setParam("sort", value, "featured")}
              options={[
                { value: "featured", label: t.shop.sortFeatured },
                { value: "newest", label: t.shop.sortNewest },
                { value: "price-asc", label: t.shop.sortPriceLow },
                { value: "price-desc", label: t.shop.sortPriceHigh },
              ]}
            />
          </div>
        </div>
        <div className="catalog-layout">
          <aside ref={filterPanelRef} id="shop-filters" className={`filter-panel${filtersOpen ? " is-open" : ""}`}
            inert={mobileFilters && !filtersOpen}
            role={mobileFilters && filtersOpen ? "dialog" : undefined}
            aria-modal={mobileFilters && filtersOpen ? true : undefined}
            aria-label={t.shop.browse}>
            <div className="filter-panel__head">
              <h2>{t.shop.browse}</h2>
              <button className="filter-panel__close" type="button" aria-label={t.shop.filterClose} onClick={() => setFiltersOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <div className="filter-group filter-group--options">
              <label className={category === "all" ? "is-selected" : undefined}>
                <input
                  type="radio"
                  name="category-filter"
                  checked={category === "all"}
                  onChange={() => setParam("category", "all")}
                />
                {t.shop.allPieces}
              </label>
              {categories.map((item) => (
                <label key={item.slug} className={category === item.slug ? "is-selected" : undefined}>
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
            <FilterDropdown
              id="filter-price"
              label={t.shop.filterPrice}
              value={price}
              adornment="$"
              onChange={(value) => setParam("price", value)}
              options={[
                { value: "all", label: t.shop.allPrices },
                { value: "under100", label: t.shop.priceUnder100 },
                { value: "100to250", label: t.shop.price100to250 },
                { value: "over250", label: t.shop.priceOver250 },
              ]}
            />
            <FilterDropdown
              id="filter-weight"
              label={t.shop.filterWeight}
              value={weight}
              adornment="g"
              onChange={(value) => setParam("weight", value)}
              options={[
                { value: "all", label: t.shop.allWeights },
                { value: "under100", label: t.shop.weightUnder100 },
                { value: "100to500", label: t.shop.weight100to500 },
                { value: "over500", label: t.shop.weightOver500 },
              ]}
            />
            <FilterDropdown
              id="filter-origin"
              label={t.shop.filterOrigin}
              value={origin}
              wideMenu
              onChange={(value) => setParam("origin", value)}
              options={[
                { value: "all", label: t.shop.allOrigins },
                ...origins.map((item) => ({ value: item, label: item })),
              ]}
            />
            {hasActiveFilters && (
              <button type="button" className="text-button" onClick={() => router.replace(pathname, { scroll: false })}>
                {t.shop.clearFilters}
              </button>
            )}
          </aside>
          <div>
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
              <div className="empty-state">{t.shop.empty}</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
