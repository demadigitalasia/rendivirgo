"use client";

import { useState } from "react";
import { apiFetch, errorMessage, formatNumber, useApi } from "@/components/admin/api";
import { DataTable, type Column } from "@/components/admin/data-table";
import { toast } from "@/components/admin/toast";
import { Badge, Button, Card, ConfirmButton, Field, Modal, PageHeader, Switch, TextArea, TextInput } from "@/components/admin/ui";

type ConditionOption = {
  id: string;
  slug: string;
  name: string;
  note: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

type FormValues = { name: string; slug: string; note: string; sortOrder: string; isActive: boolean };

const emptyForm: FormValues = { name: "", slug: "", note: "", sortOrder: "0", isActive: true };
const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function AdminConditionsPage() {
  const state = useApi<ConditionOption[]>("/api/admin/conditions");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ConditionOption | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const setField = <K extends keyof FormValues,>(key: K, value: FormValues[K]) => setForm((current) => ({ ...current, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (condition: ConditionOption) => {
    setEditing(condition);
    setForm({
      name: condition.name,
      slug: condition.slug,
      note: condition.note ?? "",
      sortOrder: String(condition.sortOrder),
      isActive: condition.isActive,
    });
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
      note: form.note.trim() || null,
      sortOrder: Math.max(0, Math.trunc(Number(form.sortOrder) || 0)),
      isActive: form.isActive,
    };
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await apiFetch(`/api/admin/conditions/${editing.id}`, { method: "PATCH", json: payload });
        toast.success(`Condition "${payload.name}" updated`);
      } else {
        await apiFetch("/api/admin/conditions", { json: payload });
        toast.success(`Condition "${payload.name}" created`);
      }
      setModalOpen(false);
      state.refresh();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (condition: ConditionOption) => {
    try {
      await apiFetch(`/api/admin/conditions/${condition.id}`, { method: "DELETE" });
      toast.success(`Condition "${condition.name}" deleted`);
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const columns: Array<Column<ConditionOption>> = [
    {
      key: "name",
      header: "Condition",
      render: (condition) => (
        <div className="rv-product-cell">
          <strong>{condition.name}</strong>
          <span className="rv-hint">{condition.note ?? "—"}</span>
        </div>
      ),
    },
    { key: "slug", header: "Slug", render: (condition) => <span className="rv-mono">{condition.slug}</span> },
    { key: "products", header: "Products", render: (condition) => formatNumber(condition.productCount) },
    { key: "sortOrder", header: "Sort", render: (condition) => condition.sortOrder },
    {
      key: "active",
      header: "Active",
      render: (condition) => <Badge tone={condition.isActive ? "green" : "gray"}>{condition.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (condition) => (
        <div className="rv-inline" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
          <Button size="sm" onClick={() => openEdit(condition)}>Edit</Button>
          <ConfirmButton
            size="sm"
            title={`Delete "${condition.name}"?`}
            description={condition.productCount ? "This condition is assigned to products. Deactivate it to keep those records intact." : "This action cannot be undone."}
            confirmLabel="Delete"
            onConfirm={() => remove(condition)}
          >Delete</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Conditions" subtitle="Manage the condition choices available for products" actions={<Button variant="primary" onClick={openCreate}>New condition</Button>} />
      <div className="rv-content">
        {state.error ? <Card title="Could not load conditions"><p className="rv-error-text">{state.error}</p></Card> : null}
        <Card flush>
          <DataTable
            columns={columns}
            items={state.data ?? []}
            loading={state.loading && !state.data}
            rowKey={(condition) => condition.id}
            emptyTitle="No conditions yet"
            emptyDescription="Create condition choices for products, such as Natural, Treated, or Dyed."
            emptyAction={<Button variant="primary" onClick={openCreate}>New condition</Button>}
          />
        </Card>
      </div>
      <Modal
        open={modalOpen}
        title={editing ? `Edit "${editing.name}"` : "New condition"}
        onClose={() => setModalOpen(false)}
        footer={<><Button onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save changes" : "Create condition"}</Button></>}
      >
        <div className="rv-stack">
          {formError ? <p className="rv-error-text">{formError}</p> : null}
          <div className="rv-form-grid">
            <Field label="Name"><TextInput value={form.name} onChange={(value) => setField("name", value)} placeholder="Natural" /></Field>
            <Field label="Slug" hint="Leave blank to generate from the name"><TextInput value={form.slug} onChange={(value) => setField("slug", value)} placeholder={slugify(form.name) || "auto-generated from name"} /></Field>
            <Field label="Sort order"><TextInput value={form.sortOrder} onChange={(value) => setField("sortOrder", value)} type="number" min={0} step="1" /></Field>
            <Field label="Active"><Switch checked={form.isActive} onChange={(checked) => setField("isActive", checked)} label="Available when editing products" /></Field>
            <Field label="Note" hint="Shown on the product page" className="rv-span-2"><TextArea value={form.note} onChange={(value) => setField("note", value)} rows={3} /></Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
