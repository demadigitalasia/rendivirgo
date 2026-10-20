"use client";

import Link from "next/link";
import { useState } from "react";
import { apiUrl, formatNumber, formatUSD, useApi, useList, type ListParams } from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import type { ApiProduct } from "@/components/admin/product-form";
import { Badge, Button, Card, PageHeader, Select, TextInput } from "@/components/admin/ui";
import "./catalog.css";

type ApiCategory = { id: string; slug: string; name: string; productCount: number };

const initialParams: ListParams = {
  page: 1,
  pageSize: 100,
  status: "Published",
  inStock: "true",
  sort: "name",
};

const sortOptions = [
  { value: "name", label: "Name A–Z" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "weight-desc", label: "Weight: heaviest" },
];

export default function AdminCatalogPdfPage() {
  const list = useList<ApiProduct>("/api/admin/products", initialParams);
  const categoriesState = useApi<ApiCategory[]>("/api/admin/categories");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [includePrice, setIncludePrice] = useState(true);

  const items = list.data?.items ?? [];
  const params = list.params;

  const setFilter = (patch: ListParams) => {
    setSelectedIds([]);
    list.update({ ...patch, page: 1 });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const toggleSelectAll = (checked: boolean) => {
    const pageIds = items.map((item) => item.id);
    setSelectedIds((current) => (checked ? Array.from(new Set([...current, ...pageIds])) : current.filter((id) => !pageIds.includes(id))));
  };

  const pdfParams = {
    search: params.search,
    category: params.category,
    sort: params.sort,
    includePrice,
  };
  const allPdfUrl = apiUrl("/api/admin/products/catalog.pdf", { ...pdfParams, all: true });
  const selectedPdfUrl = apiUrl("/api/admin/products/catalog.pdf", { ids: selectedIds.join(","), sort: params.sort, includePrice });

  const columns: Array<Column<ApiProduct>> = [
    {
      key: "name",
      header: "Product",
      render: (product) => (
        <div className="rv-catalog-pdf__product">
          {product.imageUrls[0] ? (
            <img className="rv-catalog-pdf__product-image" src={product.imageUrls[0]} alt="" />
          ) : (
            <span className="rv-catalog-pdf__product-placeholder" aria-hidden="true">{product.name.slice(0, 1)}</span>
          )}
          <div className="rv-catalog-pdf__product-copy">
            <Link href={`/admin/products/${product.id}`}>{product.name}</Link>
            <span className="rv-hint rv-mono">{product.sku ?? "SKU not set"}</span>
          </div>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (product) => product.category.name },
    { key: "price", header: "Price", align: "right", render: (product) => formatUSD(product.price) },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      render: (product) => (product.stockModel === "Unique" ? "1 unique" : formatNumber(product.stockQuantity)),
    },
  ];

  return (
    <>
      <PageHeader
        title="PDF Catalog"
        subtitle="Create a client-ready catalog from live published stock"
      />

      <div className="rv-content rv-catalog-pdf-content">
        <Card className="rv-card--catalog-builder" title="Build your catalog" description="Choose what to include in a shareable PDF.">
          <div className="rv-catalog-pdf__intro">
            <div className="rv-catalog-pdf__selection-summary">
              <span className="rv-catalog-pdf__eyebrow">CATALOG BUILDER</span>
              <strong>{selectedIds.length ? `${selectedIds.length} product${selectedIds.length === 1 ? "" : "s"} selected` : "Choose products for your PDF"}</strong>
              <p className="rv-hint">Select products below, or include all published items that match your filters.</p>
            </div>
            <label className="rv-catalog-pdf__price-option">
              <input type="checkbox" checked={includePrice} onChange={(event) => setIncludePrice(event.target.checked)} />
              <span>
                <strong>Include prices</strong>
                <small>Show product prices in the PDF</small>
              </span>
            </label>
          </div>
          <div className="rv-catalog-pdf__actions">
            <a className={selectedIds.length ? "rv-btn rv-btn--primary" : "rv-btn rv-btn--disabled"} href={selectedIds.length ? selectedPdfUrl : undefined} aria-disabled={!selectedIds.length}>
              Download selected PDF{selectedIds.length ? ` · ${selectedIds.length}` : ""}
            </a>
            <a className="rv-btn" href={allPdfUrl}>
              Download all filtered
              <span className="rv-catalog-pdf__action-count">{list.data ? list.data.total : "…"}</span>
            </a>
          </div>
        </Card>

        <Card className="rv-card--pdf-products" flush>
          <div className="rv-catalog-pdf__toolbar">
            <label className="rv-catalog-pdf__search">
              <span>Search catalog</span>
              <TextInput id="rv-catalog-search" type="search" value={list.searchInput} onChange={list.setSearchInput} placeholder="Product name, SKU, or origin" />
            </label>
            <div className="rv-catalog-pdf__filter">
              <label htmlFor="rv-catalog-category">Category</label>
              <Select
                id="rv-catalog-category"
                value={String(params.category ?? "")}
                onChange={(value) => setFilter({ category: value || undefined })}
                options={(categoriesState.data ?? []).map((category) => ({ value: category.slug, label: category.name }))}
                placeholder="All categories"
                ariaLabel="Filter catalog by category"
              />
            </div>
            <div className="rv-catalog-pdf__filter">
              <label htmlFor="rv-catalog-sort">Sort by</label>
              <Select id="rv-catalog-sort" value={String(params.sort ?? "name")} onChange={(value) => setFilter({ sort: value })} options={sortOptions} ariaLabel="Sort catalog" />
            </div>
            <Button className="rv-catalog-pdf__reset" size="sm" onClick={() => { setSelectedIds([]); list.reset(); }}>Reset filters</Button>
          </div>

          <div className="rv-catalog-pdf__status">
            <div className="rv-inline">
              <Badge tone="green">Published & in stock</Badge>
              <span className="rv-catalog-pdf__result-count">{list.data ? `${list.data.total} products` : "Loading products…"}</span>
            </div>
            {selectedIds.length ? (
              <div className="rv-catalog-pdf__selection-tools">
                <span>{selectedIds.length} selected</span>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Clear selection</Button>
              </div>
            ) : <span className="rv-hint">Select rows to create a custom PDF.</span>}
          </div>

          <DataTable
            columns={columns}
            items={items}
            loading={list.loading && !list.data}
            rowKey={(product) => product.id}
            getRowLabel={(product) => product.name}
            ariaLabel="Available products for PDF catalog"
            selectable
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            emptyTitle="No available products"
            emptyDescription="Adjust the search or category filter, or publish products with available stock first."
          />

          {list.data && list.data.total > 0 ? (
            <TablePagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={list.data.pageSize} onPage={list.setPage} />
          ) : null}
        </Card>

        {list.error ? <p className="rv-error-text">{list.error}</p> : null}
      </div>
    </>
  );
}
