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
      key: "image",
      header: "",
      width: "64px",
      render: (product) => (product.imageUrls[0] ? <img className="rv-table__thumb" src={product.imageUrls[0]} alt="" /> : <div className="rv-thumb-empty">—</div>),
    },
    {
      key: "name",
      header: "Product",
      render: (product) => (
        <div className="rv-product-cell">
          <Link href={`/admin/products/${product.id}`}>{product.name}</Link>
          <span className="rv-hint rv-mono">{product.sku ?? "—"}</span>
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
        actions={
          <a className="rv-btn rv-btn--primary" href={allPdfUrl}>
            Download all filtered
          </a>
        }
      />

      <div className="rv-content">
        <Card title="Build your catalog" description="Only published products with available stock are shown here.">
          <div className="rv-catalog-pdf__intro">
            <div>
              <strong>{selectedIds.length ? `${selectedIds.length} product(s) selected` : "Choose products for the PDF"}</strong>
              <p className="rv-hint">Select individual products, use the filters, or download every product matching the current filters.</p>
            </div>
            <label className="rv-check">
              <input type="checkbox" checked={includePrice} onChange={(event) => setIncludePrice(event.target.checked)} />
              Include prices
            </label>
          </div>
          <div className="rv-catalog-pdf__actions">
            <a className={selectedIds.length ? "rv-btn rv-btn--primary" : "rv-btn rv-btn--disabled"} href={selectedIds.length ? selectedPdfUrl : undefined} aria-disabled={!selectedIds.length}>
              Download selected PDF{selectedIds.length ? ` (${selectedIds.length})` : ""}
            </a>
            <a className="rv-btn" href={allPdfUrl}>Download all filtered PDF</a>
          </div>
        </Card>

        <Card flush>
          <div className="rv-toolbar rv-catalog-pdf__toolbar">
            <TextInput value={list.searchInput} onChange={list.setSearchInput} placeholder="Search product, SKU, origin…" />
            <Select
              value={String(params.category ?? "")}
              onChange={(value) => setFilter({ category: value || undefined })}
              options={(categoriesState.data ?? []).map((category) => ({ value: category.slug, label: category.name }))}
              placeholder="All categories"
            />
            <Select value={String(params.sort ?? "name")} onChange={(value) => setFilter({ sort: value })} options={sortOptions} />
            <Button size="sm" onClick={() => { setSelectedIds([]); list.reset(); }}>Reset</Button>
          </div>

          <div className="rv-catalog-pdf__status">
            <div className="rv-inline">
              <Badge tone="green">Published & in stock</Badge>
              <span className="rv-hint">{list.data ? `${list.data.total} product(s) available` : "Loading available products…"}</span>
            </div>
            {selectedIds.length ? <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Clear selection</Button> : null}
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
