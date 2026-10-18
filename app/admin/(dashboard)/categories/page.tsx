"use client";

import { useRef, useState } from "react";
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
  Stat,
  Switch,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import "./categories.css";

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
  nameId: string | null;
  descriptionId: string | null;
  metaTitleId: string | null;
  metaDescriptionId: string | null;
  idTranslationStatus: "Missing" | "Draft" | "Review" | "Ready";
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
  nameId: string;
  descriptionId: string;
  metaTitleId: string;
  metaDescriptionId: string;
  idTranslationStatus: "Missing" | "Draft" | "Review" | "Ready";
};

type GeneratedCategoryCopy = Pick<
  CategoryFormValues,
  "description" | "metaTitle" | "metaDescription" | "nameId" | "descriptionId" | "metaTitleId" | "metaDescriptionId"
>;

const toneValues = ["moss", "jade", "amber", "ocean", "earth"] as const;

function categoryToneClass(tone: string) {
  return toneValues.find((value) => value === tone) ?? "moss";
}

const emptyForm: CategoryFormValues = {
  name: "",
  slug: "",
  description: "",
  tone: "moss",
  sortOrder: "0",
  isActive: true,
  metaTitle: "",
  metaDescription: "",
  nameId: "",
  descriptionId: "",
  metaTitleId: "",
  metaDescriptionId: "",
  idTranslationStatus: "Missing",
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
  const formRevision = useRef(0);
  const [imageUrl, setImageUrl] = useState("");
  const [aiBrief, setAiBrief] = useState("");
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [forceCategory, setForceCategory] = useState<Category | null>(null);
  const [forcing, setForcing] = useState(false);
  const categories = state.data ?? [];
  const activeCategoryCount = categories.filter((category) => category.isActive).length;
  const emptyCategoryCount = categories.filter((category) => category.productCount === 0).length;

  function setField<K extends keyof CategoryFormValues>(key: K, value: CategoryFormValues[K]) {
    formRevision.current += 1;
    setForm((current) => ({ ...current, [key]: value }));
    setAiError(null);
    setAiNotice(null);
  }

  const openCreate = () => {
    formRevision.current += 1;
    setEditing(null);
    setForm(emptyForm);
    setImageUrl("");
    setAiBrief("");
    setAiError(null);
    setAiNotice(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (category: Category) => {
    formRevision.current += 1;
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
      nameId: category.nameId ?? "",
      descriptionId: category.descriptionId ?? "",
      metaTitleId: category.metaTitleId ?? "",
      metaDescriptionId: category.metaDescriptionId ?? "",
      idTranslationStatus: category.idTranslationStatus ?? "Missing",
    });
    setImageUrl(category.imageUrl ?? "");
    setAiBrief("");
    setAiError(null);
    setAiNotice(null);
    setFormError(null);
    setModalOpen(true);
  };

  const generateCategoryCopy = async () => {
    if (form.name.trim().length < 2) {
      setAiError("Enter a category name before generating copy.");
      return;
    }

    const generatedFields: Array<keyof GeneratedCategoryCopy> = [
      "description", "metaTitle", "metaDescription", "nameId", "descriptionId", "metaTitleId", "metaDescriptionId",
    ];
    const hasExistingCopy = generatedFields.some((field) => form[field].trim().length > 0);
    if (hasExistingCopy && !window.confirm("This will replace the current English and Indonesian category descriptions and SEO text. Continue?")) {
      return;
    }

    setGeneratingCopy(true);
    setAiError(null);
    setAiNotice(null);
    const requestRevision = formRevision.current;
    try {
      const copy = await apiFetch<GeneratedCategoryCopy>("/api/admin/categories/generate-copy", {
        json: {
          name: form.name.trim(),
          slug: form.slug.trim() || slugify(form.name),
          currentDescription: form.description.trim(),
          brief: aiBrief.trim(),
        },
      });
      if (formRevision.current !== requestRevision) {
        setAiNotice("The category form changed while copy was generating, so the result was not applied. Generate again to use the latest details.");
        return;
      }
      setForm((current) => ({ ...current, ...copy, idTranslationStatus: "Draft" }));
      setAiNotice("Category descriptions and SEO drafts are ready. Review the English and Indonesian text before saving.");
    } catch (error) {
      setAiError(errorMessage(error));
    } finally {
      setGeneratingCopy(false);
    }
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
      nameId: form.nameId.trim() || null,
      descriptionId: form.descriptionId.trim() || null,
      metaTitleId: form.metaTitleId.trim() || null,
      metaDescriptionId: form.metaDescriptionId.trim() || null,
      idTranslationStatus: form.idTranslationStatus,
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
      width: "34%",
      render: (category) => (
        <div className="rv-category-cell">
          {category.imageUrl ? (
            <img className="rv-category-cell__image" src={category.imageUrl} alt={category.name} />
          ) : (
            <span className={`rv-category-mark rv-category-mark--${categoryToneClass(category.tone)}`} aria-hidden="true">
              {category.name.trim().charAt(0).toUpperCase() || "C"}
            </span>
          )}
          <div className="rv-category-cell__content">
            <strong>{category.name}</strong>
            <span className="rv-hint">{category.description || "No description added"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "slug",
      header: "Slug",
      width: "20%",
      render: (category) => <span className="rv-category-slug rv-mono">{category.slug}</span>,
    },
    {
      key: "products",
      header: "Products",
      width: "13%",
      render: (category) => (
        <span className="rv-category-product-count">
          <strong>{formatNumber(category.productCount)}</strong>
          <span>{category.productCount === 1 ? "item" : "items"}</span>
        </span>
      ),
    },
    {
      key: "sortOrder",
      header: "Order",
      width: "10%",
      render: (category) => <span className="rv-category-order">{String(category.sortOrder).padStart(2, "0")}</span>,
    },
    {
      key: "active",
      header: "Active",
      width: "12%",
      render: (category) => <Badge tone={category.isActive ? "green" : "gray"}>{category.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      width: "190px",
      align: "right",
      render: (category) => (
        <div className="rv-inline rv-category-actions">
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

      <div className="rv-content rv-categories-content">
        {state.error ? (
          <Card title="Could not load categories">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        {state.data ? (
          <section className="rv-stat-grid rv-stat-grid--categories" aria-label="Category summary">
            <Stat label="Categories" value={formatNumber(categories.length)} hint="In the catalog" tone="primary" />
            <Stat label="Active categories" value={formatNumber(activeCategoryCount)} hint={`${formatNumber(categories.length - activeCategoryCount)} inactive`} tone="primary" />
            <Stat label="Categories with products" value={formatNumber(categories.length - emptyCategoryCount)} hint={`${formatNumber(emptyCategoryCount)} empty categories`} tone="primary" />
          </section>
        ) : null}

        <Card
          className="rv-card--categories"
          title="Category library"
          description="Manage storefront groups, product counts, and display order."
          flush
        >
          <DataTable
            columns={columns}
            items={categories}
            loading={state.loading && !state.data}
            rowKey={(category) => category.id}
            ariaLabel="Product categories"
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
        panelClassName="rv-category-modal"
        footer={
          <>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} disabled={generatingCopy} onClick={save}>
              {editing ? "Save changes" : "Create category"}
            </Button>
          </>
        }
      >
        <div className="rv-category-form">
          {formError ? <p className="rv-error-text" role="alert">{formError}</p> : null}

          <section className="rv-category-form__section" aria-labelledby="category-details-heading">
            <div className="rv-category-form__section-heading">
              <span className="rv-category-form__step">01</span>
              <div>
                <h3 id="category-details-heading">Category details</h3>
                <p>Set the name, URL, and storefront visibility.</p>
              </div>
            </div>
            <div className="rv-category-form__grid">
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
              <Field label="Visibility" className="rv-category-form__field-full">
                <Switch checked={form.isActive} onChange={(checked) => setField("isActive", checked)} label="Visible on storefront" />
              </Field>
              <div className="rv-category-copy-editor rv-category-form__field-full">
                <div className="rv-category-copy-editor__heading">
                  <label className="rv-label" htmlFor="rv-category-description">Description</label>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={generatingCopy}
                    disabled={form.name.trim().length < 2}
                    onClick={generateCategoryCopy}
                  >
                    Generate with AI
                  </Button>
                </div>
                <TextArea
                  id="rv-category-description"
                  value={form.description}
                  onChange={(value) => setField("description", value)}
                  rows={3}
                  ariaDescribedBy="rv-category-description-hint"
                />
                <span id="rv-category-description-hint" className="rv-hint">
                  Generates English and Indonesian descriptions and SEO drafts. Review before saving. Category details and the brief are sent to OpenRouter.
                </span>
                <Field label="Optional brief for AI" hint="Share only details that are accurate for this category.">
                  <TextArea
                    value={aiBrief}
                    onChange={(value) => {
                      formRevision.current += 1;
                      setAiBrief(value);
                      setAiError(null);
                      setAiNotice(null);
                    }}
                    placeholder="Key details to include, if any"
                    maxLength={1200}
                    rows={2}
                  />
                </Field>
                {aiError ? <div className="rv-ai-copy-message rv-ai-copy-message--error" role="alert">{aiError}</div> : null}
                {aiNotice ? <div className="rv-ai-copy-message rv-ai-copy-message--success" role="status">{aiNotice}</div> : null}
              </div>
            </div>
          </section>

          <section className="rv-category-form__section" aria-labelledby="category-image-heading">
            <div className="rv-category-form__section-heading">
              <span className="rv-category-form__step">02</span>
              <div>
                <h3 id="category-image-heading">Category image</h3>
                <p>Choose the image used to represent this group in the storefront.</p>
              </div>
            </div>
            <MediaPicker
              value={imageUrl ? [imageUrl] : []}
              onChange={(urls) => setImageUrl(urls[0] ?? "")}
              folder="misc"
              multiple={false}
              label="Choose an image"
            />
          </section>

          <section className="rv-category-form__section" aria-labelledby="category-seo-heading">
            <div className="rv-category-form__section-heading">
              <span className="rv-category-form__step">03</span>
              <div>
                <h3 id="category-seo-heading">Search engine listing</h3>
                <p>Optional metadata for search results and link previews.</p>
              </div>
            </div>
            <div className="rv-category-form__grid">
              <Field label="Meta title" className="rv-category-form__field-full">
                <TextInput value={form.metaTitle} onChange={(value) => setField("metaTitle", value)} />
              </Field>
              <Field label="Meta description" className="rv-category-form__field-full">
                <TextArea value={form.metaDescription} onChange={(value) => setField("metaDescription", value)} rows={3} />
              </Field>
            </div>
          </section>

          <section className="rv-category-form__section" aria-labelledby="category-indonesian-heading">
            <div className="rv-category-form__section-heading rv-category-form__section-heading--translation">
              <span className="rv-category-form__step">04</span>
              <div>
                <h3 id="category-indonesian-heading">Bahasa Indonesia</h3>
                <p>Review the translated name and copy before marking it ready.</p>
              </div>
              <Field label="Translation status" className="rv-category-form__translation-status">
                <Select value={form.idTranslationStatus} onChange={(value) => setField("idTranslationStatus", value as CategoryFormValues["idTranslationStatus"])} options={[
                  { value: "Missing", label: "Missing" }, { value: "Draft", label: "Draft" },
                  { value: "Review", label: "Ready for review" }, { value: "Ready", label: "Ready to publish" },
                ]} />
              </Field>
            </div>
            <div className="rv-category-form__grid">
              <Field label="Name (Indonesian)">
                <TextInput value={form.nameId} onChange={(value) => setField("nameId", value)} />
              </Field>
              <Field label="Meta title (Indonesian)">
                <TextInput value={form.metaTitleId} onChange={(value) => setField("metaTitleId", value)} />
              </Field>
              <Field label="Description (Indonesian)" className="rv-category-form__field-full">
                <TextArea value={form.descriptionId} onChange={(value) => setField("descriptionId", value)} rows={3} />
              </Field>
              <Field label="Meta description (Indonesian)" className="rv-category-form__field-full">
                <TextArea value={form.metaDescriptionId} onChange={(value) => setField("metaDescriptionId", value)} rows={3} />
              </Field>
            </div>
          </section>
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
