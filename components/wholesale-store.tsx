"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { ArrowIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon, ChevronIcon, CloseIcon, PlusIcon, RefreshIcon, SearchIcon, SparkleIcon } from "@/components/icons";
import { WholesaleApplication } from "@/components/wholesale-application";
import { FilterDropdown } from "@/components/filter-dropdown";
import { useCart, useCopy } from "@/components/providers";
import { LocalizedLink as Link } from "@/components/localized-link";
import type { Product, ProductTone } from "@/lib/catalog";
import { formatUSD } from "@/lib/catalog";

type WholesaleVariant = {
  id: string;
  name: string;
  sku: string;
  availableQuantity: number;
  wholesalePrice: number | null;
  wholesalePiecesPerUnit: number | null;
  weightGram: number;
};
type WholesaleProduct = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  categorySlug: string;
  categoryName: string;
  stoneType: string;
  origin: string;
  tone: ProductTone;
  description: string;
  condition: string;
  unit: Product["unit"];
  stockModel: Product["stockModel"];
  availableQuantity: number;
  imageUrl: string | null;
  wholesalePrice: number | null;
  wholesaleFromPrice?: number | null;
  wholesalePiecesPerUnit: number | null;
  weightGram: number;
  shippingClass: string;
  fragile: boolean;
  variants: WholesaleVariant[];
};
type WholesaleCategory = { slug: string; name: string; count: number };
type CatalogResponse = {
  items: WholesaleProduct[];
  categories: WholesaleCategory[];
  stoneTypes: string[];
  origins: string[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};
type Minimums = { minimumSubtotalUsd: number; minimumPieces: number };
type FilterChipKey = "search" | "category" | "stoneType" | "origin" | "availability" | "price";

const DEMO_GEM_PHOTO_POSITION: Record<string, { column: number; row: number }> = {
  "moss agate": { column: 0, row: 0 },
  labradorite: { column: 1, row: 0 },
  "green aventurine": { column: 2, row: 0 },
  "rose quartz": { column: 3, row: 0 },
  sodalite: { column: 0, row: 1 },
  jasper: { column: 1, row: 1 },
  citrine: { column: 2, row: 1 },
  "tiger eye": { column: 3, row: 1 },
  moonstone: { column: 0, row: 2 },
  garnet: { column: 1, row: 2 },
  "clear quartz": { column: 2, row: 2 },
  fluorite: { column: 3, row: 2 },
  carnelian: { column: 0, row: 3 },
  aquamarine: { column: 1, row: 3 },
  "black tourmaline": { column: 2, row: 3 },
  amethyst: { column: 3, row: 3 },
  "lapis lazuli": { column: 0, row: 4 },
  "smoky quartz": { column: 1, row: 4 },
  sunstone: { column: 2, row: 4 },
  obsidian: { column: 3, row: 4 },
};

function demoPhotoPosition(item: WholesaleProduct) {
  if (!item.sku.startsWith("DEMO-WH-")) return null;
  return DEMO_GEM_PHOTO_POSITION[item.stoneType.trim().toLocaleLowerCase()] ?? null;
}

function toCartProduct(item: WholesaleProduct): Product {
  const variants = item.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    price: Number(variant.wholesalePrice ?? item.wholesalePrice ?? 0),
    wholesale: true,
    wholesalePiecesPerUnit: variant.wholesalePiecesPerUnit,
    stockQuantity: variant.availableQuantity,
    weightGram: variant.weightGram,
    dimensionsMm: { length: 0, width: 0, height: 0 },
    shippingProfileId: "",
  }));
  return {
    id: item.id,
    slug: item.slug,
    sku: item.sku,
    name: item.name,
    contentLocale: "en",
    category: item.categoryName,
    categoryContentLocale: "en",
    categorySlug: item.categorySlug,
    stoneType: item.stoneType,
    origin: item.origin,
    price: Number(item.wholesalePrice ?? variants[0]?.price ?? 0),
    wholesale: true,
    wholesalePiecesPerUnit: item.wholesalePiecesPerUnit,
    currency: "USD",
    unit: item.unit,
    stockModel: item.stockModel,
    stockQuantity: item.availableQuantity,
    weightGram: item.weightGram,
    weightCarat: 0,
    dimensionsMm: { length: 0, width: 0, height: 0 },
    condition: item.condition,
    status: item.availableQuantity > 0 ? "Available" : "Sold",
    tone: item.tone,
    description: item.description,
    images: item.imageUrl ? [item.imageUrl] : [],
    seo: { metaTitle: item.name, metaDescription: "" },
    shipping: {
      packageWeightGram: item.weightGram,
      packageDimensionsMm: { length: 0, width: 0, height: 0 },
      shippingProfileId: "",
      shippingClass: item.shippingClass as Product["shipping"]["shippingClass"],
      calculationMethod: "AdminOverride",
      packageModel: "SinglePackageTotalWeight",
    },
    fragile: item.fragile,
    variants,
    createdAt: "",
    updatedAt: "",
  };
}

function WholesaleCard({ item }: { item: WholesaleProduct }) {
  const { addToCart, quantityInCart } = useCart();
  const variantDropdownId = `wholesale-variant-${useId().replace(/:/g, "")}`;
  const [variantId, setVariantId] = useState(() => [...item.variants].sort((a, b) => (a.wholesalePrice ?? item.wholesalePrice ?? Infinity) - (b.wholesalePrice ?? item.wholesalePrice ?? Infinity))[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const product = useMemo(() => toCartProduct(item), [item]);
  const variant = item.variants.find((entry) => entry.id === variantId);
  const available = variant?.availableQuantity ?? item.availableQuantity;
  const price = variant?.wholesalePrice ?? item.wholesalePrice;
  const selectedInCart = quantityInCart(item.id, variantId || undefined, true);
  const canAdd = available > 0 && price !== null && quantity > 0 && quantity <= available;
  const demoPosition = demoPhotoPosition(item);

  return (
    <article className="wholesale-product">
      <div className="wholesale-product__visual">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} loading="lazy" />
        ) : demoPosition ? (
          <div
            className="wholesale-product__photo"
            role="img"
            aria-label={`Illustrative demo photo of ${item.stoneType}`}
            style={{ backgroundPosition: `${(demoPosition.column / 3) * 100}% ${(demoPosition.row / 4) * 100}%` }}
          >
            <span>Demo image</span>
          </div>
        ) : (
          <div className={`wholesale-product__placeholder wholesale-product__placeholder--${item.tone}`} role="img" aria-label={`${item.stoneType} product image unavailable`}>
            <span className="wholesale-product__visual-label">RENDI VIRGO · WHOLESALE</span>
            <span className="wholesale-product__stone">{item.stoneType}</span>
            <span className="wholesale-product__visual-mark"><SparkleIcon size={28} /></span>
          </div>
        )}
        <span className={`wholesale-product__availability${available <= 0 ? " is-out" : ""}`}>
          <span aria-hidden="true" />{available > 0 ? `${available} available` : "Out of stock"}
        </span>
      </div>
      <div className="wholesale-product__body">
        <div className="wholesale-product__meta"><span>{item.categoryName}</span><span>SKU {variant?.sku ?? item.sku}</span></div>
        <h2>{item.name}</h2>
        <p className="wholesale-product__origin">{item.stoneType} <span aria-hidden="true">·</span> {item.origin}</p>
        <p className="wholesale-product__price">
          {price === null ? "Price unavailable" : formatUSD(price)}
          {price !== null ? <span> / {item.unit}</span> : null}
        </p>
        {item.variants.length && item.wholesaleFromPrice != null ? <small>From {formatUSD(item.wholesaleFromPrice)} / {item.unit} · final price depends on the selected option</small> : null}
        {item.variants.length ? (
          <div className="wholesale-product__field">
            <label htmlFor={variantDropdownId}>Option</label>
            <FilterDropdown
              id={variantDropdownId}
              value={variantId}
              compact
              wideMenu
              ariaLabel={`Option for ${item.name}`}
              onChange={(nextVariantId) => { setVariantId(nextVariantId); setQuantity(1); }}
              options={item.variants.map((option) => ({
                value: option.id,
                label: `${option.name} · ${formatUSD(option.wholesalePrice ?? item.wholesalePrice ?? 0)}`,
              }))}
            />
          </div>
        ) : null}
        <div className="wholesale-product__controls">
          <label className="wholesale-product__field wholesale-product__quantity">
            <span>Qty</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, available)}
              step={1}
              value={quantity}
              aria-label={`Quantity for ${item.name}`}
              onChange={(event) => {
                const next = Number(event.target.value);
                setQuantity(Number.isFinite(next) ? Math.min(Math.max(1, Math.trunc(next)), Math.max(1, available)) : 1);
              }}
            />
          </label>
          <button
            className="wholesale-product__add"
            type="button"
            disabled={!canAdd}
            onClick={() => addToCart(product, quantity, variantId || undefined, variant?.name)}
          >
            <span>{selectedInCart ? `In order · ${selectedInCart}` : "Add to order"}</span><PlusIcon size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductSkeleton() {
  return <article className="wholesale-product wholesale-product--skeleton" aria-hidden="true"><div /><div><i /><i /><i /></div></article>;
}

function WholesalePagination({
  page,
  pageCount,
  pageNumbers,
  onNavigate,
  position,
}: {
  page: number;
  pageCount: number;
  pageNumbers: number[];
  onNavigate: (target: number) => void;
  position: "top" | "bottom";
}) {
  return (
    <nav className={`wholesale-pagination${position === "top" ? " is-top" : ""}`} aria-label={`Wholesale catalog ${position} pagination`}>
      <button type="button" aria-label="Previous catalog page" disabled={page <= 1} onClick={() => onNavigate(page - 1)}><ArrowLeftIcon size={15} /><span>Previous</span></button>
      <div>{pageNumbers.map((number) => <button key={number} type="button" className={number === page ? "is-current" : ""} aria-current={number === page ? "page" : undefined} onClick={() => onNavigate(number)}>{number}</button>)}</div>
      <button type="button" aria-label="Next catalog page" disabled={page >= pageCount} onClick={() => onNavigate(page + 1)}><span>Next</span><ArrowRightIcon size={15} /></button>
      <small>Page {page} of {pageCount.toLocaleString("en-US")}</small>
    </nav>
  );
}

export function WholesaleStore() {
  const router = useRouter();
  const t = useCopy();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const currentSearch = searchParams.get("search") ?? "";
  const currentMin = searchParams.get("minPrice") ?? "";
  const currentMax = searchParams.get("maxPrice") ?? "";
  const category = searchParams.get("category") ?? "all";
  const stoneType = searchParams.get("stoneType") ?? "all";
  const origin = searchParams.get("origin") ?? "all";
  const availability = searchParams.get("availability") ?? "all";
  const sort = searchParams.get("sort") ?? "featured";
  const pageSize = searchParams.get("pageSize") ?? "24";
  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const { lines, hydrated, clearCart } = useCart();
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [minimums, setMinimums] = useState<Minimums | null>(null);
  const [searchDraft, setSearchDraft] = useState(currentSearch);
  const [priceDraft, setPriceDraft] = useState({ min: currentMin, max: currentMax });
  const [categorySearch, setCategorySearch] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [accessState, setAccessState] = useState<"checking" | "guest" | "pending" | "approved" | "unavailable">("checking");
  const [accessRequestSent, setAccessRequestSent] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const wholesaleLines = lines.filter((line) => line.wholesale);
  const wholesaleSubtotal = wholesaleLines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const wholesaleCount = wholesaleLines.reduce((sum, line) => sum + line.quantity, 0);
  const pieceCount = wholesaleLines.reduce((sum, line) => {
    const factor = line.wholesalePiecesPerUnit ?? (line.unit === "piece" ? 1 : 0);
    return sum + factor * line.quantity;
  }, 0);
  const belowMinimum = !minimums || (wholesaleSubtotal < minimums.minimumSubtotalUsd && pieceCount < minimums.minimumPieces);
  const subtotalProgress = minimums ? Math.min(100, wholesaleSubtotal / Math.max(1, minimums.minimumSubtotalUsd) * 100) : 0;
  const pieceProgress = minimums ? Math.min(100, pieceCount / Math.max(1, minimums.minimumPieces) * 100) : 0;
  const minimumProgress = Math.max(subtotalProgress, pieceProgress);
  const minimumProgressLabel = subtotalProgress >= pieceProgress ? "merchandise minimum" : "piece minimum";
  const activeFilterCount = [Boolean(currentSearch), category !== "all", stoneType !== "all", origin !== "all", availability !== "all", Boolean(currentMin || currentMax)].filter(Boolean).length;
  const matchingCategories = (catalog?.categories ?? []).filter((entry) => {
    const query = categorySearch.trim().toLocaleLowerCase();
    return !query || entry.name.toLocaleLowerCase().includes(query) || entry.slug.toLocaleLowerCase().includes(query);
  });
  const selectedCategory = matchingCategories.find((entry) => entry.slug === category);
  const visibleCategories = showAllCategories || categorySearch.trim()
    ? matchingCategories
    : [...matchingCategories.slice(0, 8), ...(selectedCategory && !matchingCategories.slice(0, 8).some((entry) => entry.slug === category) ? [selectedCategory] : [])];
  const startResult = catalog?.total ? ((catalog.page - 1) * catalog.pageSize) + 1 : 0;
  const endResult = catalog ? Math.min(catalog.page * catalog.pageSize, catalog.total) : 0;
  const priceRangeInvalid = Boolean(priceDraft.min && priceDraft.max && Number(priceDraft.max) < Number(priceDraft.min));

  useEffect(() => setSearchDraft(currentSearch), [currentSearch]);
  useEffect(() => setPriceDraft({ min: currentMin, max: currentMax }), [currentMin, currentMax]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = searchDraft.trim();
      if (value === currentSearch) return;
      const params = new URLSearchParams(queryString);
      params.delete("page");
      if (value) params.set("search", value);
      else params.delete("search");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [currentSearch, pathname, queryString, router, searchDraft]);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    const params = new URLSearchParams(queryString);
    if (!params.has("pageSize")) params.set("pageSize", "24");
    fetch(`/api/wholesale/catalog?${params.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (response.status === 401) {
        clearCart("wholesale");
        setAccessState("guest");
        return null;
      }
      if (response.status === 403) {
        clearCart("wholesale");
        setCatalog(null);
        try {
          const profileResponse = await fetch("/api/customer-account/me", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
          if (profileResponse.status === 401) {
            setAccessState("guest");
          } else if (profileResponse.ok) {
            const customer = await profileResponse.json();
            setAccessRequestSent(customer?.wholesaleStatus === "Pending");
            setAccessState(customer?.wholesaleAccess === true ? "unavailable" : "pending");
          } else {
            setAccessState("unavailable");
          }
        } catch {
          if (!controller.signal.aborted) setAccessState("unavailable");
        }
        return null;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Wholesale catalog is unavailable");
      return data as CatalogResponse;
    }).then((data) => {
      if (data) {
        setCatalog(data);
        setAccessState("approved");
      }
    }).catch((caught) => {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "Wholesale catalog is unavailable");
      void fetch("/api/customer-account/me", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
        .then(async (profileResponse) => {
          if (controller.signal.aborted) return;
          if (profileResponse.status === 401) {
            setAccessState("guest");
            return;
          }
          if (!profileResponse.ok) {
            setAccessState("unavailable");
            return;
          }
          const customer = await profileResponse.json();
          if (controller.signal.aborted) return;
          setAccessRequestSent(customer?.wholesaleStatus === "Pending");
          setAccessState(customer?.wholesaleAccess === true ? "unavailable" : "pending");
        })
        .catch(() => {
          if (!controller.signal.aborted) setAccessState("unavailable");
        });
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => controller.abort();
  }, [clearCart, queryString, reloadKey, router]);

  useEffect(() => {
    if (accessState !== "approved") return;
    const controller = new AbortController();
    fetch("/api/wholesale/minimums", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (response.ok) setMinimums(data);
      }).catch(() => undefined);
    return () => controller.abort();
  }, [accessState]);

  const applyPriceRange = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (priceRangeInvalid) return;
    const params = new URLSearchParams(queryString);
    params.delete("page");
    if (priceDraft.min.trim()) params.set("minPrice", priceDraft.min.trim());
    else params.delete("minPrice");
    if (priceDraft.max.trim()) params.set("maxPrice", priceDraft.max.trim());
    else params.delete("maxPrice");
    const query = params.toString();
    if (query !== queryString) router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const clearFilters = () => {
    setSearchDraft("");
    setPriceDraft({ min: "", max: "" });
    router.push(pathname, { scroll: false });
  };


  const pageCount = catalog?.pageCount ?? 1;
  const page = catalog?.page ?? currentPage;
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => {
    const start = Math.min(Math.max(page - 2, 1), Math.max(1, pageCount - 4));
    return start + index;
  });
  const activeFilterChips: Array<{ key: FilterChipKey; label: string }> = [
    currentSearch ? { key: "search", label: `Search: “${currentSearch}”` } : null,
    category !== "all" ? { key: "category", label: `Category: ${catalog?.categories.find((entry) => entry.slug === category)?.name ?? category}` } : null,
    stoneType !== "all" ? { key: "stoneType", label: `Stone: ${stoneType}` } : null,
    origin !== "all" ? { key: "origin", label: `Origin: ${origin}` } : null,
    availability !== "all" ? { key: "availability", label: `Stock: ${availability === "in-stock" ? "In stock" : "Out of stock"}` } : null,
    currentMin || currentMax ? {
      key: "price",
      label: `${currentMin ? formatUSD(Number(currentMin)) : "$0"} – ${currentMax ? formatUSD(Number(currentMax)) : "Any price"}`,
    } : null,
  ].filter((chip): chip is { key: FilterChipKey; label: string } => chip !== null);

  const removeFilter = (key: FilterChipKey) => {
    if (key === "search") setSearchDraft("");
    if (key === "price") setPriceDraft({ min: "", max: "" });
    const params = new URLSearchParams(queryString);
    if (key === "price") {
      params.delete("minPrice");
      params.delete("maxPrice");
    } else {
      params.delete(key);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const updateParam = (key: string, value: string, resetPage = true) => {
    const params = new URLSearchParams(queryString);
    if (resetPage && key !== "page") params.delete("page");
    if (!value || value === "all" || (key === "sort" && value === "featured") || (key === "pageSize" && value === "24")) params.delete(key);
    else params.set(key, value);
    const query = params.toString();
    if (query !== queryString) router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const navigateCatalogPage = (target: number) => {
    updateParam("page", String(target), false);
    window.requestAnimationFrame(() => document.getElementById("wholesale-results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  if (accessState === "checking" || accessState === "guest" || accessState === "pending" || accessState === "unavailable") {
    const copy = t.wholesaleAccess;
    const isPending = accessState === "pending";
    const isUnavailable = accessState === "unavailable";
    const requestSubmitted = isPending && accessRequestSent;
    return (
      <section className="wholesale-access page-container" aria-labelledby="wholesale-access-title">
        <div className="wholesale-access__panel">
          <p className="wholesale-access__eyebrow"><span aria-hidden="true" />{copy.eyebrow}</p>
          <h1 id="wholesale-access-title">{isUnavailable ? copy.unavailableTitle : requestSubmitted ? copy.requestPendingTitle : isPending ? copy.pendingTitle : copy.title}</h1>
          <p className="wholesale-access__description">{isUnavailable ? copy.unavailableBody : requestSubmitted ? copy.requestPendingBody : isPending ? copy.pendingBody : copy.body}</p>
          {!isUnavailable ? <ol className="wholesale-access__steps">
            {(requestSubmitted ? copy.requestPendingSteps : isPending ? copy.pendingSteps : copy.steps).map((step, index) => <li key={step}><span aria-hidden="true">0{index + 1}</span><p>{step}</p></li>)}
          </ol> : null}
          {accessState === "checking" ? (
            <p className="wholesale-access__checking" role="status">{copy.checking}</p>
          ) : (
            <div className="wholesale-access__actions">
              {isUnavailable ? (
                <button className="button button--light" type="button" onClick={() => setReloadKey((key) => key + 1)}>{copy.retry}<RefreshIcon size={16} /></button>
              ) : isPending ? (
                <WholesaleApplication onApproved={() => setReloadKey((key) => key + 1)} onStatusChange={(status) => setAccessRequestSent(status === "Pending")} />
              ) : (
                <>
                  <Link className="button button--light" href="/account/login?next=%2Fwholesale%2Ffinished">{copy.signIn}<ArrowIcon size={16} /></Link>
                  <Link className="button button--outline" href="/account/register?next=%2Fwholesale%2Ffinished">{copy.register}</Link>
                </>
              )}
              <Link className="wholesale-access__shop-link" href="/shop">{copy.shopLink}<ArrowUpRightIcon size={15} /></Link>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="wholesale-store page-container">
      <header className="wholesale-store__hero">
        <div className="wholesale-store__hero-copy">
          <p className="customer-account__eyebrow"><span aria-hidden="true" /> APPROVED CUSTOMER COLLECTION</p>
          <h1>Finished Products</h1>
          <p>A focused collection for your next order, with member pricing and live availability.</p>
        </div>
        <div className="wholesale-store__hero-glow" aria-hidden="true" />
      </header>

      {minimums ? (
        <section className={`wholesale-minimum${belowMinimum ? " is-pending" : " is-ready"}`} aria-label="Wholesale minimum order">
          <div className="wholesale-minimum__copy">
            <p className="wholesale-minimum__eyebrow">ORDER REQUIREMENT</p>
            <h2>{belowMinimum ? "Build your wholesale order" : "Your order meets the minimum"}</h2>
            <p>Reach either the merchandise subtotal or piece-equivalent threshold to continue.</p>
            <div className="wholesale-minimum__progress-label"><span>Progress toward</span><strong>{minimumProgressLabel}</strong></div>
            <div className="wholesale-minimum__progress" role="progressbar" aria-label={`Progress toward ${minimumProgressLabel}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(minimumProgress)}>
              <span style={{ width: `${minimumProgress}%` }} />
            </div>
          </div>
          <div className="wholesale-minimum__targets">
            <div><span>Merchandise minimum</span><strong>{formatUSD(minimums.minimumSubtotalUsd)}</strong><small>{formatUSD(wholesaleSubtotal)} in your order</small></div>
            <span className="wholesale-minimum__or">OR</span>
            <div><span>Piece minimum</span><strong>{minimums.minimumPieces} pcs</strong><small>{pieceCount} piece equivalents</small></div>
          </div>
        </section>
      ) : null}

      <div className="wholesale-store__workspace">
        <aside className={`wholesale-filters${mobileFiltersOpen ? " is-open" : ""}`}>
          <div className="wholesale-filters__header">
            <div><p>CATALOG FILTERS</p><h2>Refine collection</h2></div>
            {activeFilterCount > 0 ? <button type="button" onClick={clearFilters} aria-label={`Clear ${activeFilterCount} active filters`}>{activeFilterCount} active <CloseIcon size={13} /></button> : <span>Browse all</span>}
          </div>
          <button className="wholesale-filters__mobile-toggle" type="button" aria-expanded={mobileFiltersOpen} aria-controls="wholesale-filter-content" onClick={() => setMobileFiltersOpen((open) => !open)}>
            <span>{mobileFiltersOpen ? "Hide filters" : "Show filters"}</span>
            {activeFilterCount > 0 ? <span className="wholesale-filters__mobile-count">{activeFilterCount} active</span> : null}
            <span className="wholesale-filters__mobile-chevron"><ChevronIcon size={17} /></span>
          </button>
          <div className="wholesale-filters__content" id="wholesale-filter-content">
            <div className="wholesale-filters__section">
              <div className="wholesale-filters__section-head"><h3>Categories</h3><span>{catalog?.categories.length ?? 0}</span></div>
              <label className="wholesale-category-search">
                <SearchIcon />
                <input type="search" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Find a category" aria-label="Find a wholesale category" />
                {categorySearch ? <button type="button" aria-label="Clear category search" onClick={() => setCategorySearch("")}><CloseIcon size={13} /></button> : null}
              </label>
              <div className="wholesale-filters__categories">
                <button type="button" className={category === "all" ? "is-active" : ""} aria-pressed={category === "all"} onClick={() => updateParam("category", "all")}>
                  <span>All products</span><span>{catalog?.categories.reduce((sum, entry) => sum + entry.count, 0) ?? "—"}</span>
                </button>
                {visibleCategories.map((entry) => (
                  <button key={entry.slug} type="button" className={category === entry.slug ? "is-active" : ""} aria-pressed={category === entry.slug} onClick={() => updateParam("category", entry.slug)}>
                    <span>{entry.name}</span><span>{entry.count}</span>
                  </button>
                ))}
                {categorySearch.trim() && visibleCategories.length === 0 ? <p className="wholesale-filters__no-categories">No categories match “{categorySearch.trim()}”.</p> : null}
              </div>
              {!categorySearch.trim() && matchingCategories.length > 8 ? <button className="wholesale-filters__show-categories" type="button" onClick={() => setShowAllCategories((show) => !show)}>{showAllCategories ? "Show fewer" : `Show all ${matchingCategories.length} categories`}<ChevronIcon className={showAllCategories ? "is-up" : undefined} size={15} /></button> : null}
            </div>
            <div className="wholesale-filters__section">
              <div className="wholesale-filters__section-head"><h3>Availability</h3></div>
              <div className="wholesale-filters__select-label">
                <FilterDropdown id="wholesale-stock-filter" label="Stock status" value={availability} onChange={(value) => updateParam("availability", value)} options={[
                  { value: "all", label: "All stock levels" },
                  { value: "in-stock", label: "In stock" },
                  { value: "out-of-stock", label: "Out of stock" },
                ]} />
              </div>
            </div>
            <div className="wholesale-filters__section">
              <div className="wholesale-filters__section-head"><h3>Stone type</h3></div>
              <div className="wholesale-filters__select-label">
                <FilterDropdown id="wholesale-stone-filter" label="Material" value={stoneType} searchable={(catalog?.stoneTypes.length ?? 0) > 8} searchPlaceholder="Find a stone type…" onChange={(value) => updateParam("stoneType", value)} options={[
                  { value: "all", label: "All stone types" },
                  ...(catalog?.stoneTypes ?? []).map((entry) => ({ value: entry, label: entry })),
                ]} />
              </div>
            </div>
            <div className="wholesale-filters__section">
              <div className="wholesale-filters__section-head"><h3>Origin</h3></div>
              <div className="wholesale-filters__select-label">
                <FilterDropdown id="wholesale-origin-filter" label="Country of origin" value={origin} searchable={(catalog?.origins.length ?? 0) > 8} searchPlaceholder="Find an origin…" onChange={(value) => updateParam("origin", value)} options={[
                  { value: "all", label: "All origins" },
                  ...(catalog?.origins ?? []).map((entry) => ({ value: entry, label: entry })),
                ]} />
              </div>
            </div>
            <form className="wholesale-filters__section wholesale-price-filter" onSubmit={applyPriceRange}>
              <div className="wholesale-filters__section-head"><h3>Wholesale from price</h3></div>
              <div className="wholesale-price-filter__fields">
                <label><span>Min USD</span><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={priceDraft.min} onChange={(event) => setPriceDraft((current) => ({ ...current, min: event.target.value }))} /></label>
                <span aria-hidden="true">—</span>
                <label><span>Max USD</span><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Any" value={priceDraft.max} onChange={(event) => setPriceDraft((current) => ({ ...current, max: event.target.value }))} /></label>
              </div>
              {priceRangeInvalid ? <p className="wholesale-price-filter__error" role="alert">Maximum price must be higher than minimum price.</p> : null}
              <button className="wholesale-filters__apply" type="submit" disabled={priceRangeInvalid}>Apply price</button>
            </form>
          </div>
        </aside>

        <div className="wholesale-catalog" id="wholesale-catalog">
          <div className="wholesale-catalog__toolbar">
            <label className="wholesale-search">
              <SearchIcon />
              <input type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search name, stone, SKU or category" aria-label="Search wholesale catalog" />
                {searchDraft ? <button type="button" aria-label="Clear search" onClick={() => setSearchDraft("")}><CloseIcon size={13} /></button> : null}
            </label>
          </div>

          {activeFilterChips.length ? (
            <div className="wholesale-active-filters" role="group" aria-label="Active catalog filters">
              <span className="wholesale-active-filters__label">Active filters</span>
              <div className="wholesale-active-filters__chips">
                {activeFilterChips.map((chip) => (
                  <button key={chip.key} type="button" onClick={() => removeFilter(chip.key)} aria-label={`Remove filter ${chip.label}`}>
                    <span>{chip.label}</span><CloseIcon size={13} />
                  </button>
                ))}
                <button className="wholesale-active-filters__clear" type="button" onClick={clearFilters}>Clear all</button>
              </div>
            </div>
          ) : null}

          <div className="wholesale-catalog__results" id="wholesale-results" tabIndex={-1} aria-live="polite">
            <p>{busy ? "Updating collection…" : catalog ? <><strong>{catalog.total.toLocaleString("en-US")}</strong> products <span>·</span> Showing {startResult.toLocaleString("en-US")}–{endResult.toLocaleString("en-US")}</> : "Wholesale collection"}</p>
            <div className="wholesale-catalog__result-controls">
              <div className="wholesale-catalog__sort">
                <label htmlFor="wholesale-sort">Sort by</label>
                <FilterDropdown id="wholesale-sort" value={sort} compact ariaLabel="Sort wholesale catalog" onChange={(value) => updateParam("sort", value)} options={[
                  { value: "featured", label: "Recommended" },
                  { value: "newest", label: "Recently added" },
                  { value: "name-asc", label: "Name: A to Z" },
                  { value: "name-desc", label: "Name: Z to A" },
                  { value: "price-asc", label: "From price: low to high" },
                  { value: "price-desc", label: "From price: high to low" },
                ]} />
              </div>
              <div className="wholesale-catalog__page-size">
                <label htmlFor="wholesale-page-size">Show</label>
                <FilterDropdown id="wholesale-page-size" value={pageSize} compact ariaLabel="Products per page" onChange={(value) => updateParam("pageSize", value)} options={[{ value: "24", label: "24" }, { value: "48", label: "48" }]} />
                <span>per page</span>
              </div>
            </div>
          </div>

          {catalog && pageCount > 1 ? <WholesalePagination page={page} pageCount={pageCount} pageNumbers={pageNumbers} onNavigate={navigateCatalogPage} position="top" /> : null}

          {error ? <div className="wholesale-catalog__error" role="alert"><p>{error}</p><button type="button" onClick={() => setReloadKey((current) => current + 1)}><RefreshIcon size={15} /> Try again</button></div> : null}
          {!error && busy && !catalog ? <div className="wholesale-store__grid">{Array.from({ length: 8 }, (_, index) => <ProductSkeleton key={index} />)}</div> : null}
          {!error && catalog && catalog.items.length === 0 && !busy ? (
            <div className="wholesale-catalog__empty"><span><SearchIcon size={34} /></span><h2>No matching pieces</h2><p>Try a broader search or clear a filter to see more of the collection.</p><button className="wholesale-filters__apply" type="button" onClick={clearFilters}>Clear filters</button></div>
          ) : null}
          {!error && catalog && catalog.items.length > 0 ? (
            <div className={`wholesale-store__grid${busy ? " is-updating" : ""}`} aria-busy={busy}>
              {catalog.items.map((item) => <WholesaleCard item={item} key={item.id} />)}
            </div>
          ) : null}

          {catalog && pageCount > 1 ? <WholesalePagination page={page} pageCount={pageCount} pageNumbers={pageNumbers} onNavigate={navigateCatalogPage} position="bottom" /> : null}
        </div>
      </div>

      {hydrated && wholesaleCount > 0 ? (
        <aside className="wholesale-store__cart" aria-label="Wholesale order summary">
          <div className="wholesale-store__cart-mark" aria-hidden="true">{wholesaleCount}</div>
          <div className="wholesale-store__cart-copy">
            <strong>Your wholesale order</strong>
            <span>{wholesaleCount} items <span aria-hidden="true">·</span> {pieceCount} pcs <span aria-hidden="true">·</span> {formatUSD(wholesaleSubtotal)}{belowMinimum ? " · minimum not met" : " · minimum met"}</span>
            {belowMinimum && minimums ? <small>Add {formatUSD(Math.max(0, minimums.minimumSubtotalUsd - wholesaleSubtotal))} more or {Math.max(0, minimums.minimumPieces - pieceCount)} pcs to unlock checkout.</small> : null}
          </div>
          {belowMinimum ? (
            <button className="wholesale-store__cart-cta is-disabled" type="button" disabled>Minimum not met</button>
          ) : (
            <Link className="wholesale-store__cart-cta" href="/wholesale/checkout">Review order <ArrowIcon size={16} /></Link>
          )}
        </aside>
      ) : null}
    </section>
  );
}
