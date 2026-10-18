"use client";

import { useState } from "react";
import { apiFetch, errorMessage, formatNumber, useApi } from "@/components/admin/api";
import { DataTable, type Column } from "@/components/admin/data-table";
import { toast } from "@/components/admin/toast";
import { Badge, Button, Card, ConfirmButton, Field, Modal, PageHeader, Select, Stat, Switch, TextArea, TextInput } from "@/components/admin/ui";
import { translationStatusOptions, type TranslationStatus } from "../content/types";
import "./conditions.css";

type ConditionOption = {
  id: string;
  slug: string;
  name: string;
  note: string | null;
  noteId: string | null;
  idTranslationStatus: TranslationStatus;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

type FormValues = { name: string; slug: string; note: string; noteId: string; idTranslationStatus: TranslationStatus; sortOrder: string; isActive: boolean };

const emptyForm: FormValues = { name: "", slug: "", note: "", noteId: "", idTranslationStatus: "Missing", sortOrder: "0", isActive: true };
const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function conditionToneClass(slug: string) {
  if (slug === "treated") return "amber";
  if (slug === "dyed") return "violet";
  if (slug === "unverified") return "slate";
  return "jade";
}

export default function AdminConditionsPage() {
  const state = useApi<ConditionOption[]>("/api/admin/conditions");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ConditionOption | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const conditions = state.data ?? [];
  const activeConditionCount = conditions.filter((condition) => condition.isActive).length;
  const usedConditionCount = conditions.filter((condition) => condition.productCount > 0).length;
  const productAssignments = conditions.reduce((total, condition) => total + condition.productCount, 0);

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
      noteId: condition.noteId ?? "",
      idTranslationStatus: condition.idTranslationStatus ?? "Missing",
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
      noteId: form.noteId.trim() || null,
      idTranslationStatus: form.idTranslationStatus,
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
      width: "42%",
      render: (condition) => (
        <div className="rv-condition-cell">
          <span className={`rv-condition-mark rv-condition-mark--${conditionToneClass(condition.slug)}`} aria-hidden="true">
            {condition.name.trim().charAt(0).toUpperCase() || "C"}
          </span>
          <div className="rv-condition-cell__content">
            <strong>{condition.name}</strong>
            <span>{condition.note || "No product note added"}</span>
            {condition.noteId ? <span className="rv-condition-cell__translation" lang="id"><b>ID</b>{condition.noteId}</span> : null}
          </div>
        </div>
      ),
    },
    { key: "slug", header: "Slug", width: "17%", render: (condition) => <span className="rv-condition-slug rv-mono">{condition.slug}</span> },
    {
      key: "products",
      header: "Products",
      width: "12%",
      render: (condition) => (
        <span className="rv-condition-count">
          <strong>{formatNumber(condition.productCount)}</strong>
          <span>{condition.productCount === 1 ? "item" : "items"}</span>
        </span>
      ),
    },
    { key: "sortOrder", header: "Order", width: "9%", render: (condition) => <span className="rv-condition-order">{String(condition.sortOrder).padStart(2, "0")}</span> },
    {
      key: "active",
      header: "Active",
      width: "11%",
      render: (condition) => <Badge tone={condition.isActive ? "green" : "gray"}>{condition.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      width: "170px",
      align: "right",
      render: (condition) => (
        <div className="rv-inline rv-condition-actions">
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
      <div className="rv-content rv-conditions-content">
        {state.error ? <Card title="Could not load conditions"><p className="rv-error-text">{state.error}</p></Card> : null}
        {state.data ? (
          <section className="rv-stat-grid rv-stat-grid--conditions" aria-label="Condition summary">
            <Stat label="Condition options" value={formatNumber(conditions.length)} hint="Across the product catalog" tone="primary" />
            <Stat label="Active options" value={formatNumber(activeConditionCount)} hint={`${formatNumber(conditions.length - activeConditionCount)} inactive`} tone="primary" />
            <Stat label="Product assignments" value={formatNumber(productAssignments)} hint={`${formatNumber(usedConditionCount)} condition types in use`} tone="primary" />
          </section>
        ) : null}
        <Card
          className="rv-card--conditions"
          title="Condition library"
          description="Maintain product condition labels and the notes shown to customers."
          flush
        >
          <DataTable
            columns={columns}
            items={conditions}
            loading={state.loading && !state.data}
            rowKey={(condition) => condition.id}
            ariaLabel="Product conditions"
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
        wide
        panelClassName="rv-condition-modal"
        footer={<><Button onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save changes" : "Create condition"}</Button></>}
      >
        <div className="rv-condition-form">
          {formError ? <p className="rv-error-text" role="alert">{formError}</p> : null}
          <section className="rv-condition-form__section" aria-labelledby="condition-details-heading">
            <div className="rv-condition-form__section-heading">
              <span className="rv-condition-form__step">01</span>
              <div>
                <h3 id="condition-details-heading">Condition details</h3>
                <p>Name, URL identifier, display order, and product availability.</p>
              </div>
            </div>
            <div className="rv-condition-form__grid">
              <Field label="Name">
                <TextInput value={form.name} onChange={(value) => setField("name", value)} placeholder="Natural" />
              </Field>
              <Field label="Slug" hint="Leave blank to generate from the name">
                <TextInput value={form.slug} onChange={(value) => setField("slug", value)} placeholder={slugify(form.name) || "auto-generated from name"} />
              </Field>
              <Field label="Sort order">
                <TextInput value={form.sortOrder} onChange={(value) => setField("sortOrder", value)} type="number" min={0} step="1" />
              </Field>
              <Field label="Availability">
                <Switch checked={form.isActive} onChange={(checked) => setField("isActive", checked)} label="Available when editing products" />
              </Field>
            </div>
          </section>
          <section className="rv-condition-form__section" aria-labelledby="condition-notes-heading">
            <div className="rv-condition-form__section-heading">
              <span className="rv-condition-form__step">02</span>
              <div>
                <h3 id="condition-notes-heading">Customer notes</h3>
                <p>Explain what this condition means on the product page.</p>
              </div>
            </div>
            <div className="rv-condition-form__grid">
              <Field label="Note (English)" className="rv-condition-form__field-full">
                <TextArea value={form.note} onChange={(value) => setField("note", value)} rows={3} placeholder="Shown on the product page" />
              </Field>
            </div>
          </section>
          <section className="rv-condition-form__section" aria-labelledby="condition-translation-heading">
            <div className="rv-condition-form__section-heading rv-condition-form__section-heading--translation">
              <span className="rv-condition-form__step">03</span>
              <div>
                <h3 id="condition-translation-heading">Bahasa Indonesia</h3>
                <p>Review the translated note before marking it ready.</p>
              </div>
              <Field label="Translation status" className="rv-condition-form__translation-status">
                <Select value={form.idTranslationStatus} onChange={(value) => setField("idTranslationStatus", value as TranslationStatus)} options={translationStatusOptions} />
              </Field>
            </div>
            <div className="rv-condition-form__grid">
              <Field label="Note (Indonesian)" className="rv-condition-form__field-full" hint="Leave empty until the translation has been reviewed.">
                <TextArea value={form.noteId} onChange={(value) => setField("noteId", value)} rows={3} />
              </Field>
            </div>
          </section>
        </div>
      </Modal>
    </>
  );
}
