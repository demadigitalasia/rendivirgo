"use client";

import { useState } from "react";
import {
  apiFetch,
  errorMessage,
  formatDate,
  formatNumber,
  formatUSD,
  toDateInputValue,
  useApi,
  useList,
} from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
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
  Switch,
  TextArea,
  TextInput,
} from "@/components/admin/ui";

type DiscountType = "Percentage" | "Fixed" | "FreeShipping";

type Discount = {
  id: string;
  code: string;
  description: string | null;
  type: DiscountType;
  value: number;
  minSubtotal: number;
  maxUses: number | null;
  usedCount: number;
  perCustomerLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  categoryId: string | null;
  category: { id: string; slug: string; name: string } | null;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
};

type CategoryOption = { id: string; name: string };

type DiscountForm = {
  code: string;
  description: string;
  type: DiscountType;
  value: string;
  minSubtotal: string;
  maxUses: string;
  perCustomerLimit: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  categoryId: string;
};

const emptyForm: DiscountForm = {
  code: "",
  description: "",
  type: "Percentage",
  value: "10",
  minSubtotal: "0",
  maxUses: "",
  perCustomerLimit: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
  categoryId: "",
};

const typeOptions: Array<{ value: DiscountType; label: string }> = [
  { value: "Percentage", label: "Percentage" },
  { value: "Fixed", label: "Fixed amount" },
  { value: "FreeShipping", label: "Free shipping" },
];

const typeTones: Record<DiscountType, "bronze" | "blue" | "green"> = {
  Percentage: "bronze",
  Fixed: "blue",
  FreeShipping: "green",
};

const activeOptions = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const toOptionalInt = (value: string) => {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed < 1) return null;
  return Math.trunc(parsed);
};

const formatDiscountValue = (discount: Discount) => {
  if (discount.type === "Percentage") return `${formatNumber(discount.value)}%`;
  if (discount.type === "Fixed") return formatUSD(discount.value);
  return "Free shipping";
};

export default function AdminDiscountsPage() {
  const state = useList<Discount>("/api/admin/discounts", { pageSize: 20 });
  const categories = useApi<CategoryOption[]>("/api/admin/categories");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [form, setForm] = useState<DiscountForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const data = state.data;
  const params = state.params;
  const hasFilters = Boolean(params.search || params.isActive !== undefined);

  function setField<K extends keyof DiscountForm>(key: K, value: DiscountForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (discount: Discount) => {
    setEditing(discount);
    setForm({
      code: discount.code,
      description: discount.description ?? "",
      type: discount.type,
      value: String(discount.value),
      minSubtotal: String(discount.minSubtotal),
      maxUses: discount.maxUses === null ? "" : String(discount.maxUses),
      perCustomerLimit: discount.perCustomerLimit === null ? "" : String(discount.perCustomerLimit),
      startsAt: toDateInputValue(discount.startsAt),
      endsAt: toDateInputValue(discount.endsAt),
      isActive: discount.isActive,
      categoryId: discount.categoryId ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const changeType = (value: string) => {
    const type = value as DiscountType;
    setForm((current) => ({ ...current, type, value: type === "FreeShipping" ? "0" : current.value }));
  };

  const save = async () => {
    const code = form.code.trim().toUpperCase();
    if (code.length < 2) {
      setFormError("Code must be at least 2 characters.");
      return;
    }

    const value = Number(form.value);
    if (!Number.isFinite(value) || value < 0) {
      setFormError("Value must be a number of 0 or greater.");
      return;
    }

    const minSubtotal = Number(form.minSubtotal);
    if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
      setFormError("Minimum subtotal must be a number of 0 or greater.");
      return;
    }

    if (form.startsAt && form.endsAt && form.endsAt < form.startsAt) {
      setFormError("The end date must be after the start date.");
      return;
    }

    const payload = {
      code,
      description: form.description.trim() || null,
      type: form.type,
      value,
      minSubtotal,
      maxUses: toOptionalInt(form.maxUses),
      perCustomerLimit: toOptionalInt(form.perCustomerLimit),
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
      isActive: form.isActive,
      categoryId: form.categoryId || null,
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await apiFetch(`/api/admin/discounts/${editing.id}`, { method: "PATCH", json: payload });
        toast.success(`Discount "${code}" updated`);
      } else {
        await apiFetch("/api/admin/discounts", { json: payload });
        toast.success(`Discount "${code}" created`);
      }
      setModalOpen(false);
      state.refresh();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (discount: Discount) => {
    setTogglingId(discount.id);
    try {
      await apiFetch(`/api/admin/discounts/${discount.id}/toggle`, { method: "PATCH" });
      toast.success(`Discount "${discount.code}" ${discount.isActive ? "deactivated" : "activated"}`);
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async (discount: Discount) => {
    try {
      await apiFetch(`/api/admin/discounts/${discount.id}`, { method: "DELETE" });
      toast.success(`Discount "${discount.code}" deleted`);
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const columns: Array<Column<Discount>> = [
    {
      key: "code",
      header: "Code",
      render: (discount) => (
        <div>
          <strong className="rv-mono">{discount.code}</strong>
          <div className="rv-hint">{discount.description ?? "—"}</div>
          {discount.category ? <Badge tone="gray">{discount.category.name}</Badge> : null}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (discount) => <Badge tone={typeTones[discount.type]}>{discount.type}</Badge>,
    },
    {
      key: "value",
      header: "Value",
      render: (discount) => formatDiscountValue(discount),
    },
    {
      key: "minSubtotal",
      header: "Min subtotal",
      render: (discount) => (discount.minSubtotal > 0 ? formatUSD(discount.minSubtotal) : "—"),
    },
    {
      key: "usage",
      header: "Usage",
      render: (discount) => (
        <div>
          <div>
            {formatNumber(discount.usedCount)}/{discount.maxUses === null ? "∞" : formatNumber(discount.maxUses)}
          </div>
          <div className="rv-hint">
            {discount.perCustomerLimit === null ? "No per-customer limit" : `${discount.perCustomerLimit} per customer`}
          </div>
        </div>
      ),
    },
    {
      key: "orders",
      header: "Orders",
      render: (discount) => formatNumber(discount.orderCount),
    },
    {
      key: "period",
      header: "Period",
      render: (discount) =>
        discount.startsAt || discount.endsAt ? (
          <div>
            <div>{formatDate(discount.startsAt)}</div>
            <div className="rv-hint">to {formatDate(discount.endsAt)}</div>
          </div>
        ) : (
          <span className="rv-hint">Always on</span>
        ),
    },
    {
      key: "isActive",
      header: "Active",
      render: (discount) => (
        <Switch
          checked={discount.isActive}
          disabled={togglingId === discount.id}
          onChange={() => toggle(discount)}
          label={discount.isActive ? "Active" : "Inactive"}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (discount) => (
        <div className="rv-inline" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
          <Button size="sm" onClick={() => openEdit(discount)}>
            Edit
          </Button>
          <ConfirmButton
            size="sm"
            title={`Delete "${discount.code}"?`}
            description={
              discount.orderCount > 0
                ? `This code was used on ${discount.orderCount} order(s). Existing orders keep their discount, but the code can no longer be applied.`
                : "This action cannot be undone."
            }
            confirmLabel="Delete"
            onConfirm={() => remove(discount)}
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
        title="Discounts"
        subtitle="Promo codes, free shipping and category offers"
        actions={
          <Button variant="primary" onClick={openCreate}>
            New discount
          </Button>
        }
      />

      <div className="rv-content">
        {state.error ? (
          <Card title="Could not load discounts">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        <Card flush>
          <div className="rv-toolbar">
            <TextInput value={state.searchInput} onChange={state.setSearchInput} placeholder="Search code or description" />
            <Select
              value={String(params.isActive ?? "")}
              onChange={(value) => state.update({ isActive: value || undefined, page: 1 })}
              options={activeOptions}
              placeholder="All statuses"
            />
            {hasFilters ? (
              <Button size="sm" onClick={state.reset}>
                Reset
              </Button>
            ) : null}
            <Button size="sm" onClick={state.refresh}>
              Refresh
            </Button>
          </div>

          <DataTable
            columns={columns}
            items={data?.items ?? []}
            loading={state.loading && !data}
            rowKey={(discount) => discount.id}
            emptyTitle="No discounts yet"
            emptyDescription={hasFilters ? "Try adjusting the filters." : "Create a promo code to offer deals at checkout."}
            emptyAction={
              <Button variant="primary" onClick={openCreate}>
                New discount
              </Button>
            }
          />

          {data ? (
            <TablePagination
              page={data.page}
              pageCount={data.pageCount}
              total={data.total}
              pageSize={data.pageSize}
              onPage={state.setPage}
            />
          ) : null}
        </Card>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? `Edit "${editing.code}"` : "New discount"}
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>
              {editing ? "Save changes" : "Create discount"}
            </Button>
          </>
        }
      >
        <div className="rv-stack">
          {formError ? <p className="rv-error-text">{formError}</p> : null}
          <div className="rv-form-grid">
            <Field label="Code" hint="Stored in uppercase">
              <TextInput value={form.code} onChange={(value) => setField("code", value)} placeholder="SPRING20" />
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={changeType} options={typeOptions} />
            </Field>
            <Field label="Value" hint={form.type === "Percentage" ? "Percent off (0–100)" : form.type === "Fixed" ? "Amount off in USD" : "Not used for free shipping"}>
              <TextInput
                value={form.value}
                onChange={(value) => setField("value", value)}
                type="number"
                min={0}
                step={form.type === "Percentage" ? "1" : "0.01"}
                disabled={form.type === "FreeShipping"}
              />
            </Field>
            <Field label="Minimum subtotal" hint="0 for no minimum">
              <TextInput value={form.minSubtotal} onChange={(value) => setField("minSubtotal", value)} type="number" min={0} step="0.01" />
            </Field>
            <Field label="Max uses" hint="Leave blank for unlimited">
              <TextInput value={form.maxUses} onChange={(value) => setField("maxUses", value)} type="number" min={1} step="1" />
            </Field>
            <Field label="Per-customer limit" hint="Leave blank for unlimited">
              <TextInput
                value={form.perCustomerLimit}
                onChange={(value) => setField("perCustomerLimit", value)}
                type="number"
                min={1}
                step="1"
              />
            </Field>
            <Field label="Starts at" hint="Leave blank to start immediately">
              <TextInput value={form.startsAt} onChange={(value) => setField("startsAt", value)} type="date" />
            </Field>
            <Field label="Ends at" hint="Leave blank to never expire">
              <TextInput value={form.endsAt} onChange={(value) => setField("endsAt", value)} type="date" />
            </Field>
            <Field label="Category" hint="Restrict to one category, or leave blank for the whole cart">
              <Select
                value={form.categoryId}
                onChange={(value) => setField("categoryId", value)}
                options={(categories.data ?? []).map((category) => ({ value: category.id, label: category.name }))}
                placeholder="All categories"
              />
            </Field>
            <Field label="Active">
              <Switch checked={form.isActive} onChange={(checked) => setField("isActive", checked)} label="Usable at checkout" />
            </Field>
            <Field label="Description" className="rv-span-2">
              <TextArea value={form.description} onChange={(value) => setField("description", value)} rows={3} placeholder="Shown internally to describe the campaign" />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
