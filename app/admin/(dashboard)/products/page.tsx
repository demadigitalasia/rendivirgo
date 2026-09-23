"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  apiFetch,
  apiUrl,
  errorMessage,
  formatDate,
  formatNumber,
  formatUSD,
  useApi,
  useList,
  type ListParams,
} from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import type { ApiProduct } from "@/components/admin/product-form";
import { toast } from "@/components/admin/toast";
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  Field,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import "./products.css";

type ApiCategory = { id: string; slug: string; name: string; productCount: number };

type BulkAction = "Publish" | "Unpublish" | "Archive" | "Restore" | "Delete";

type ImportResult = { created: number; skipped: number; errors: string[] };

const initialParams: ListParams = { page: 1, pageSize: 20, sort: "newest" };

const statusOptions = [
  { value: "Draft", label: "Draft" },
  { value: "Published", label: "Published" },
  { value: "Reserved", label: "Reserved" },
  { value: "Sold", label: "Sold" },
  { value: "Archived", label: "Archived" },
];

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
  { value: "weight-desc", label: "Weight: heaviest" },
];

const flagOptions = [
  { value: "true", label: "Yes" },
];

const bulkActions: BulkAction[] = ["Publish", "Unpublish", "Archive", "Restore", "Delete"];

export default function AdminProductsPage() {
  const router = useRouter();
  const list = useList<ApiProduct>("/api/admin/products", initialParams);
  const categoriesState = useApi<ApiCategory[]>("/api/admin/categories");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

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
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, ...pageIds])) : current.filter((id) => !pageIds.includes(id)),
    );
  };

  const runBulk = async (action: BulkAction, ids: string[] = selectedIds) => {
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const result = await apiFetch<{ affected: number }>("/api/admin/products/bulk", {
        method: "PATCH",
        json: { ids, action },
      });
      toast.success(`${action}: ${result.affected} product(s) updated`);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBulkBusy(false);
    }
  };

  const duplicate = async (product: ApiProduct) => {
    try {
      const copy = await apiFetch<ApiProduct>(`/api/admin/products/${product.id}/duplicate`, { method: "POST" });
      toast.success(`Duplicated "${product.name}"`);
      router.push(`/admin/products/${copy.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async (product: ApiProduct) => {
    try {
      await apiFetch(`/api/admin/products/${product.id}?hard=true`, { method: "DELETE" });
      toast.success(`Deleted "${product.name}"`);
      list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const exportParams = {
    search: params.search,
    category: params.category,
    status: params.status,
    featured: params.featured,
    inStock: params.inStock,
    sort: params.sort,
  };
  const exportUrl = apiUrl("/api/admin/products/export.csv", exportParams);

  const readFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    try {
      setCsv(await file.text());
      setImportResult(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const runImport = async () => {
    if (!csv.trim()) {
      toast.error("Paste CSV content or choose a file first");
      return;
    }
    setImporting(true);
    try {
      const result = await apiFetch<ImportResult>("/api/admin/products/import", { json: { csv } });
      setImportResult(result);
      toast.success(`Imported ${result.created} product(s)`);
      list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  const columns: Array<Column<ApiProduct>> = [
    {
      key: "image",
      header: "",
      width: "60px",
      render: (product) =>
        product.imageUrls[0] ? (
          <img className="rv-table__thumb" src={product.imageUrls[0]} alt={product.name} />
        ) : (
          <div className="rv-thumb-empty">—</div>
        ),
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
    {
      key: "category",
      header: "Category",
      render: (product) => product.category.name,
    },
    {
      key: "price",
      header: "Price",
      render: (product) => (
        <div className="rv-product-cell">
          <span>{formatUSD(product.price)}</span>
          {product.compareAtPrice != null && product.compareAtPrice > product.price ? (
            <span className="rv-price-compare">{formatUSD(product.compareAtPrice)}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      render: (product) =>
        product.stockModel === "Unique" ? "1 (unique)" : formatNumber(product.stockQuantity),
    },
    {
      key: "status",
      header: "Status",
      render: (product) => <StatusBadge status={product.status} />,
    },
    {
      key: "created",
      header: "Created",
      render: (product) => formatDate(product.createdAt),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (product) => (
        <div className="rv-inline" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
          <Button size="sm" href={`/admin/products/${product.id}`}>
            Edit
          </Button>
          <Button size="sm" onClick={() => duplicate(product)}>
            Duplicate
          </Button>
          {product.status === "Archived" ? (
            <Button size="sm" disabled={bulkBusy} onClick={() => runBulk("Restore", [product.id])}>
              Restore
            </Button>
          ) : (
            <Button size="sm" disabled={bulkBusy} onClick={() => runBulk("Archive", [product.id])}>
              Archive
            </Button>
          )}
          <ConfirmButton
            size="sm"
            title={`Delete "${product.name}"?`}
            description="This permanently removes the product and cannot be undone."
            confirmLabel="Delete permanently"
            onConfirm={() => remove(product)}
          >
            Delete
          </ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Manage the catalog, pricing and stock"
        actions={
          <div className="rv-inline">
            <Button href={exportUrl}>Export CSV</Button>
            <Button onClick={() => { setImportOpen(true); setImportResult(null); }}>Import CSV</Button>
            <Button variant="primary" href="/admin/products/new">
              New product
            </Button>
          </div>
        }
      />

      <div className="rv-content">
        <Card flush>
          <div className="rv-toolbar">
            <TextInput value={list.searchInput} onChange={list.setSearchInput} placeholder="Search name, SKU, origin…" />
            <Select
              value={String(params.category ?? "")}
              onChange={(value) => setFilter({ category: value || undefined })}
              options={(categoriesState.data ?? []).map((category) => ({ value: category.slug, label: category.name }))}
              placeholder="All categories"
            />
            <Select
              value={String(params.status ?? "")}
              onChange={(value) => setFilter({ status: value || undefined })}
              options={statusOptions}
              placeholder="All statuses"
            />
            <Select
              value={String(params.featured ?? "")}
              onChange={(value) => setFilter({ featured: value || undefined })}
              options={flagOptions}
              placeholder="Featured: any"
            />
            <Select
              value={String(params.inStock ?? "")}
              onChange={(value) => setFilter({ inStock: value || undefined })}
              options={flagOptions}
              placeholder="Stock: any"
            />
            <Select
              value={String(params.sort ?? "newest")}
              onChange={(value) => list.update({ sort: value })}
              options={sortOptions}
            />
            <Button
              size="sm"
              onClick={() => {
                setSelectedIds([]);
                list.reset();
              }}
            >
              Reset
            </Button>
          </div>

          {selectedIds.length ? (
            <div className="rv-toolbar rv-toolbar--bulk">
              <Badge tone="blue">{selectedIds.length} selected</Badge>
              {bulkActions.map((action) =>
                action === "Delete" ? (
                  <ConfirmButton
                    key={action}
                    size="sm"
                    title={`Delete ${selectedIds.length} product(s)?`}
                    description="This permanently removes the selected products and cannot be undone."
                    confirmLabel="Delete permanently"
                    onConfirm={() => runBulk(action)}
                  >
                    Delete
                  </ConfirmButton>
                ) : (
                  <Button key={action} size="sm" disabled={bulkBusy} onClick={() => runBulk(action)}>
                    {action}
                  </Button>
                ),
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            </div>
          ) : null}

          <DataTable
            columns={columns}
            items={items}
            loading={list.loading && !list.data}
            rowKey={(product) => product.id}
            selectable
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            emptyTitle="No products found"
            emptyDescription="Adjust the filters or create a new product."
            emptyAction={
              <Button variant="primary" href="/admin/products/new">
                New product
              </Button>
            }
          />

          {list.data && list.data.total > 0 ? (
            <TablePagination
              page={list.data.page}
              pageCount={list.data.pageCount}
              total={list.data.total}
              pageSize={list.data.pageSize}
              onPage={list.setPage}
            />
          ) : null}
        </Card>

        {list.error ? <p className="rv-error-text">{list.error}</p> : null}
      </div>

      <Modal
        open={importOpen}
        title="Import CSV"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <Button onClick={() => setImportOpen(false)}>Close</Button>
            <Button variant="primary" loading={importing} onClick={runImport}>
              Import
            </Button>
          </>
        }
      >
        <div className="rv-stack">
          <p className="rv-hint">
            Columns: name, slug, sku, categorySlug, stoneType, origin, price, currency, unit, stockModel, stockQuantity,
            weightGram, weightCarat, lengthMm, widthMm, heightMm, condition, status, tone, featured, fragile, description.
          </p>
          <Field label="CSV file">
            <input className="rv-input" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => readFile(event.target.files)} />
          </Field>
          <Field label="CSV content">
            <TextArea value={csv} onChange={(value) => { setCsv(value); setImportResult(null); }} rows={10} code placeholder="name,price,categorySlug…" />
          </Field>
          {importResult ? (
            <div className="rv-stack">
              <div className="rv-inline">
                <Badge tone="green">{importResult.created} created</Badge>
                <Badge tone={importResult.skipped ? "amber" : "gray"}>{importResult.skipped} skipped</Badge>
              </div>
              {importResult.errors.length ? (
                <ul className="rv-import-errors">
                  {importResult.errors.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
