"use client";

import { useState } from "react";
import { ApiError, apiFetch, errorMessage, formatNumber, useApi } from "@/components/admin/api";
import { DataTable, type Column } from "@/components/admin/data-table";
import { MediaPicker } from "@/components/admin/media";
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

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  tone: string;
  sortOrder: number;
  isActive: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  productCount: number;
};

type CategoryFormValues = {
  name: string;
  slug: string;
  description: string;
  tone: string;
  sortOrder: string;
  isActive: boolean;
  metaTitle: string;
  metaDescription: string;
};

const toneValues = ["moss", "jade", "amber", "ocean", "earth"] as const;

const emptyForm: CategoryFormValues = {
  name: "",
  slug: "",
  description: "",
  tone: "moss",
  sortOrder: "0",
  isActive: true,
  metaTitle: "",
  metaDescription: "",
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function AdminCategoriesPage() {
  const state = useApi<Category[]>("/api/admin/categories");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormValues>(emptyForm);
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [forceCategory, setForceCategory] = useState<Category | null>(null);
  const [forcing, setForcing] = useState(false);

  function setField<K extends keyof CategoryFormValues>(key: K, value: CategoryFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setImageUrl("");
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      tone: category.tone,
      sortOrder: String(category.sortOrder ?? 0),
      isActive: category.isActive,
      metaTitle: category.metaTitle ?? "",
      metaDescription: category.metaDescription ?? "",
    });
    setImageUrl(category.imageUrl ?? "");
    setFormError(null);
    setModalOpen(true);
  };

  const save = async () => {
    if (form.name.trim().length < 2) {
      setFormError("Name must be at least 2 characters.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || null,
      imageUrl: imageUrl || null,
      tone: form.tone,
      sortOrder: Math.max(0, Math.trunc(Number(form.sortOrder) || 0)),
      isActive: form.isActive,
      metaTitle: form.metaTitle.trim() || null,
      metaDescription: form.metaDescription.trim() || null,
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await apiFetch(`/api/admin/categories/${editing.id}`, { method: "PATCH", json: payload });
        toast.success(`Category "${payload.name}" updated`);
      } else {
        await apiFetch("/api/admin/categories", { json: payload });
        toast.success(`Category "${payload.name}" created`);
      }
      setModalOpen(false);
      state.refresh();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category: Category) => {
    try {
      await apiFetch(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      toast.success(`Category "${category.name}" deleted`);
      state.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setForceCategory(category);
        return;
      }
      toast.error(errorMessage(error));
    }
  };

  const confirmForce = async () => {
    if (!forceCategory) return;
    setForcing(true);
    try {
      await apiFetch(`/api/admin/categories/${forceCategory.id}?force=true`, { method: "DELETE" });
      toast.success(`Deleted "${forceCategory.name}" and archived its products`);
      setForceCategory(null);
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setForcing(false);
    }
  };

  const columns: Array<Column<Category>> = [
    {
      key: "name",
      header: "Category",
      render: (category) => (
        <div className="rv-inline">
          {category.imageUrl ? (
            <img className="rv-table__thumb" src={category.imageUrl} alt={category.name} />
          ) : null}
          <div className="rv-product-cell">
            <strong>{category.name}</strong>
            <span className="rv-hint">{category.description ?? "—"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "slug",
      header: "Slug",
      render: (category) => <span className="rv-mono">{category.slug}</span>,
    },
    {
      key: "products",
      header: "Products",
      render: (category) => formatNumber(category.productCount),
    },
    {
      key: "sortOrder",
      header: "Sort",
      render: (category) => category.sortOrder,
    },
    {
      key: "active",
      header: "Active",
      render: (category) => <Badge tone={category.isActive ? "green" : "gray"}>{category.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (category) => (
        <div className="rv-inline" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
          <Button size="sm" onClick={() => openEdit(category)}>
            Edit
          </Button>
          <ConfirmButton
            size="sm"
            title={`Delete "${category.name}"?`}
            description={
              category.productCount > 0
                ? `This category has ${category.productCount} product(s). If the API rejects the delete, you can archive them and force delete.`
                : "This action cannot be undone."
            }
            confirmLabel="Delete"
            onConfirm={() => remove(category)}
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
        title="Categories"
        subtitle="Organize the catalog structure"
        actions={
          <Button variant="primary" onClick={openCreate}>
            New category
          </Button>
        }
      />

      <div className="rv-content">
        {state.error ? (
          <Card title="Could not load categories">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        <Card flush>
          <DataTable
            columns={columns}
            items={state.data ?? []}
            loading={state.loading && !state.data}
            rowKey={(category) => category.id}
            emptyTitle="No categories yet"
            emptyDescription="Create a category to start organizing products."
            emptyAction={
              <Button variant="primary" onClick={openCreate}>
                New category
              </Button>
            }
          />
        </Card>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? `Edit "${editing.name}"` : "New category"}
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>
              {editing ? "Save changes" : "Create category"}
            </Button>
          </>
        }
      >
        <div className="rv-stack">
          {formError ? <p className="rv-error-text">{formError}</p> : null}
          <div className="rv-form-grid">
            <Field label="Name">
              <TextInput value={form.name} onChange={(value) => setField("name", value)} placeholder="Cabochons" />
            </Field>
            <Field label="Slug" hint="Leave blank to generate from the name">
              <TextInput
                value={form.slug}
                onChange={(value) => setField("slug", value)}
                placeholder={slugify(form.name) || "auto-generated from name"}
              />
            </Field>
            <Field label="Tone">
              <Select
                value={form.tone}
                onChange={(value) => setField("tone", value)}
                options={toneValues.map((value) => ({ value, label: value }))}
              />
            </Field>
            <Field label="Sort order">
              <TextInput value={form.sortOrder} onChange={(value) => setField("sortOrder", value)} type="number" min={0} step="1" />
            </Field>
            <Field label="Active">
              <Switch checked={form.isActive} onChange={(checked) => setField("isActive", checked)} label="Visible on storefront" />
            </Field>
            <Field label="Meta title">
              <TextInput value={form.metaTitle} onChange={(value) => setField("metaTitle", value)} />
            </Field>
            <Field label="Meta description" className="rv-span-2">
              <TextArea value={form.metaDescription} onChange={(value) => setField("metaDescription", value)} rows={3} />
            </Field>
            <Field label="Description" className="rv-span-2">
              <TextArea value={form.description} onChange={(value) => setField("description", value)} rows={3} />
            </Field>
          </div>
          <MediaPicker
            value={imageUrl ? [imageUrl] : []}
            onChange={(urls) => setImageUrl(urls[0] ?? "")}
            folder="misc"
            multiple={false}
            label="Category image"
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(forceCategory)}
        title="Category still has products"
        onClose={() => setForceCategory(null)}
        footer={
          <>
            <Button onClick={() => setForceCategory(null)}>Cancel</Button>
            <Button variant="danger" loading={forcing} onClick={confirmForce}>
              Archive products & delete
            </Button>
          </>
        }
      >
        <p>
          "{forceCategory?.name}" still has {formatNumber(forceCategory?.productCount ?? 0)} product(s). Deleting with force
          archives those products first, then permanently removes the category. The products stay in the database and can be
          restored from the products list.
        </p>
      </Modal>
    </>
  );
}
