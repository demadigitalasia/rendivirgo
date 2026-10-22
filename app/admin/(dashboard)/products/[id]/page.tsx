"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, errorMessage, formatDateTime, formatUSD, useApi } from "@/components/admin/api";
import { ProductForm, type ApiProduct } from "@/components/admin/product-form";
import { toast } from "@/components/admin/toast";
import { Button, Card, ConfirmButton, KeyValue, Loading, PageHeader, StatusBadge } from "@/components/admin/ui";
import "./product-edit.css";

type PriceHistoryEntry = {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string;
  createdAt: string;
};

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const state = useApi<ApiProduct>(id ? `/api/admin/products/${id}` : null);
  const history = useApi<PriceHistoryEntry[]>(id ? `/api/admin/products/${id}/price-history` : null);

  const product = state.data;

  useEffect(() => {
    if (!product || !["Pending", "Processing"].includes(product.etsySync?.status ?? "")) return;
    const timer = window.setTimeout(state.refresh, 2500);
    return () => window.clearTimeout(timer);
  }, [product?.etsySync?.status, state.refresh]);

  const duplicate = async () => {
    if (!product) return;
    try {
      const copy = await apiFetch<ApiProduct>(`/api/admin/products/${product.id}/duplicate`, { method: "POST" });
      toast.success(`Duplicated as "${copy.name}"`);
      router.push(`/admin/products/${copy.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const archive = async () => {
    if (!product) return;
    try {
      await apiFetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      toast.success(`Archived "${product.name}"`);
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async () => {
    if (!product) return;
    try {
      await apiFetch(`/api/admin/products/${product.id}?hard=true`, { method: "DELETE" });
      toast.success(`Deleted "${product.name}"`);
      router.push("/admin/products");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <>
      <PageHeader
        title={product?.name ?? "Product"}
        subtitle={product ? `SKU ${product.sku ?? "—"} · /shop/${product.categorySlug}/${product.slug}` : id}
        actions={
          <Button href="/admin/products" size="sm">
            Back to products
          </Button>
        }
      />

      <div className="rv-content rv-product-edit-content">
        {state.loading && !product ? (
          <Card>
            <Loading label="Loading product…" />
          </Card>
        ) : null}

        {state.error ? (
          <Card title="Could not load product">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        {product ? (
          <div className="rv-split rv-product-edit-layout">
            <ProductForm
              mode="edit"
              product={product}
              onSaved={(updated: ApiProduct) => {
                state.setData(updated);
                history.refresh();
                toast.success("Product saved");
              }}
              onCancel={() => router.push("/admin/products")}
            />

            <div className="rv-stack rv-product-edit-rail">
              <Card title="Actions" className="rv-product-edit-rail-card">
                <div className="rv-stack">
                  <a
                    className="rv-btn"
                    href={`/shop/${product.categorySlug}/${product.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on storefront
                  </a>
                  <Button onClick={duplicate}>Duplicate</Button>
                  {product.status !== "Archived" ? (
                    <ConfirmButton
                      title="Archive product?"
                      description="The product is hidden from the storefront but kept in the database."
                      confirmLabel="Archive"
                      variant="default"
                      onConfirm={archive}
                    >
                      Archive
                    </ConfirmButton>
                  ) : null}
                  <ConfirmButton
                    title="Delete permanently?"
                    description="This removes the product and all of its data. This cannot be undone."
                    confirmLabel="Delete permanently"
                    onConfirm={remove}
                  >
                    Delete permanent
                  </ConfirmButton>
                </div>
              </Card>

              <Card title="Details" flush className="rv-product-edit-rail-card">
                <div className="rv-card__body">
                  <KeyValue
                    entries={[
                      { label: "Status", value: <StatusBadge status={product.status} /> },
                      { label: "In stock", value: product.inStock ? "Yes" : "No" },
                      { label: "Featured", value: product.featured ? "Yes" : "No" },
                      { label: "Published", value: formatDateTime(product.publishedAt) },
                      { label: "Created", value: formatDateTime(product.createdAt) },
                      { label: "Updated", value: formatDateTime(product.updatedAt) },
                    ]}
                  />
                </div>
              </Card>

              <Card title="Price & stock history" description="Latest 100 changes" flush className="rv-product-edit-rail-card">
                {history.loading && !history.data ? (
                  <div className="rv-card__body">
                    <Loading label="Loading history…" />
                  </div>
                ) : history.data?.length ? (
                  <div className="rv-list">
                    {history.data.map((entry) => (
                      <div className="rv-list__row" key={entry.id}>
                        <div>
                          <strong>{entry.field === "price" ? "Price" : "Stock"}</strong>
                          <div className="rv-hint">{formatDateTime(entry.createdAt)}</div>
                        </div>
                        <div className="rv-list__meta">
                          {entry.field === "price"
                            ? `${formatUSD(Number(entry.oldValue ?? 0))} → ${formatUSD(Number(entry.newValue))}`
                            : `${entry.oldValue ?? 0} → ${entry.newValue}`}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rv-empty">No price or stock changes yet</div>
                )}
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
