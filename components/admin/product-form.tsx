"use client";

import { AiDraft } from "./ai-draft";
import { SeoPanel } from "./seo-panel";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage, useApi } from "./api";
import { MediaPicker } from "./media";
import { VideoPicker } from "./video-picker";
import { Button, Card, Field, Select, Switch, TextArea, TextInput } from "./ui";

export type ApiProductImage = {
  id?: string;
  url: string;
  alt?: string | null;
  focalX?: number | null;
  focalY?: number | null;
  sortOrder?: number;
};

export type ApiProductVariant = {
  id?: string;
  sku: string;
  name: string;
  price: number;
  wholesalePrice: number | null;
  wholesalePiecesPerUnit: number | null;
  stockQuantity: number;
  workshopStockQuantity: number;
  weightGram: number;
  dimensionsMm?: { length?: number; width?: number; height?: number };
  shippingClass?: string;
};

export type ApiProduct = {
  id: string;
  slug: string;
  sku: string | null;
  name: string;
  category: { id: string; slug: string; name: string };
  categoryId: string;
  categorySlug: string;
  stoneType: string;
  origin: string;
  mohsHardness: number | null;
  condition: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  unit: string;
  stockModel: string;
  stockQuantity: number;
  workshopStockQuantity: number;
  sellOnWeb: boolean;
  sellInWorkshop: boolean;
  sellInWholesale: boolean;
  sellInEtsy: boolean;
  etsySync?: {
    status: string;
    lastError: string | null;
    listingUrl: string | null;
    remoteState: string | null;
    lastSyncedAt: string | null;
  };
  wholesalePrice: number | null;
  wholesalePiecesPerUnit: number | null;
  weightGram: number;
  weightCarat: number | null;
  dimensionsMm: { length: number; width: number; height: number };
  status: string;
  tone: string;
  shippingClass: string;
  shippingProfileId: string | null;
  description: string;
  featured: boolean;
  fragile: boolean;
  images: ApiProductImage[];
  imageUrls: string[];
  videoUrl?: string | null;
  variants: ApiProductVariant[];
  seo: { metaTitle: string | null; metaDescription: string | null };
  inStock: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  nameId: string | null;
  descriptionId: string | null;
  metaTitleId: string | null;
  metaDescriptionId: string | null;
  idTranslationStatus: "Missing" | "Draft" | "Review" | "Ready";
};

type ApiCategory = { id: string; slug: string; name: string; isActive: boolean };
type ApiConditionOption = { id: string; name: string; isActive: boolean };
type ApiEtsyStatus = { connected: boolean; missingListingConfig: string[] };

const statusValues = ["Draft", "Published", "Reserved", "Sold", "Archived"] as const;
const unitValues = ["piece", "pair", "gram", "carat", "strand", "bag"] as const;
const stockModelValues = ["Unique", "Quantity"] as const;
const toneValues = ["moss", "jade", "amber", "ocean", "earth"] as const;
const shippingClassValues = ["Standard", "Fragile", "Oversized", "Custom"] as const;

const toOptions = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

type VariantRow = {
  id?: string;
  sku: string;
  name: string;
  price: string;
  wholesalePrice: string;
  wholesalePiecesPerUnit: string;
  stockQuantity: string;
  workshopStockQuantity: string;
  weightGram: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  shippingClass: string;
};

type FormValues = {
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  stoneType: string;
  origin: string;
  mohsHardness: string;
  condition: string;
  price: string;
  compareAtPrice: string;
  unit: string;
  stockModel: string;
  stockQuantity: string;
  workshopStockQuantity: string;
  sellOnWeb: boolean;
  sellInWorkshop: boolean;
  sellInWholesale: boolean;
  sellInEtsy: boolean;
  wholesalePrice: string;
  wholesalePiecesPerUnit: string;
  weightGram: string;
  weightCarat: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  status: string;
  tone: string;
  shippingClass: string;
  description: string;
  featured: boolean;
  fragile: boolean;
  metaTitle: string;
  metaDescription: string;
  nameId: string;
  descriptionId: string;
  metaTitleId: string;
  metaDescriptionId: string;
  idTranslationStatus: "Missing" | "Draft" | "Review" | "Ready";
};

const toNumber = (value: string) => {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNumberOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIntOrNull = (value: string) => {
  const parsed = toNumberOrNull(value);
  return parsed === null ? null : Math.trunc(parsed);
};

const slugPreview = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function toVariantRow(variant: ApiProductVariant): VariantRow {
  return {
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    price: String(variant.price),
    wholesalePrice: variant.wholesalePrice != null ? String(variant.wholesalePrice) : "",
    wholesalePiecesPerUnit: variant.wholesalePiecesPerUnit != null ? String(variant.wholesalePiecesPerUnit) : "",
    stockQuantity: String(variant.stockQuantity ?? 0),
    workshopStockQuantity: String(variant.workshopStockQuantity ?? 0),
    weightGram: String(variant.weightGram ?? 0),
    lengthMm: variant.dimensionsMm?.length ? String(variant.dimensionsMm.length) : "",
    widthMm: variant.dimensionsMm?.width ? String(variant.dimensionsMm.width) : "",
    heightMm: variant.dimensionsMm?.height ? String(variant.dimensionsMm.height) : "",
    shippingClass: variant.shippingClass ?? "Standard",
  };
}

function valuesFromProduct(product?: ApiProduct | null): FormValues {
  return {
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    sku: product?.sku ?? "",
    categoryId: product?.categoryId ?? "",
    stoneType: product?.stoneType ?? "",
    origin: product?.origin ?? "",
    mohsHardness: product?.mohsHardness != null ? String(product.mohsHardness) : "",
    condition: product?.condition ?? "Natural",
    price: product ? String(product.price) : "",
    compareAtPrice: product?.compareAtPrice != null ? String(product.compareAtPrice) : "",
    unit: product?.unit ?? "piece",
    stockModel: product?.stockModel ?? "Unique",
    stockQuantity: product?.stockQuantity != null ? String(product.stockQuantity) : "",
    workshopStockQuantity: product ? String(product.workshopStockQuantity ?? 0) : "0",
    sellOnWeb: product?.sellOnWeb ?? true,
    sellInWorkshop: product?.sellInWorkshop ?? true,
    sellInWholesale: product?.sellInWholesale ?? false,
    sellInEtsy: product?.sellInEtsy ?? false,
    wholesalePrice: product?.wholesalePrice != null ? String(product.wholesalePrice) : "",
    wholesalePiecesPerUnit: product?.wholesalePiecesPerUnit != null ? String(product.wholesalePiecesPerUnit) : "",
    weightGram: product ? String(product.weightGram) : "",
    weightCarat: product?.weightCarat != null ? String(product.weightCarat) : "",
    lengthMm: product?.dimensionsMm?.length ? String(product.dimensionsMm.length) : "",
    widthMm: product?.dimensionsMm?.width ? String(product.dimensionsMm.width) : "",
    heightMm: product?.dimensionsMm?.height ? String(product.dimensionsMm.height) : "",
    status: product?.status ?? "Draft",
    tone: product?.tone ?? "moss",
    shippingClass: product?.shippingClass ?? "Standard",
    description: product?.description ?? "",
    featured: product?.featured ?? false,
    fragile: product?.fragile ?? false,
    metaTitle: product?.seo?.metaTitle ?? "",
    metaDescription: product?.seo?.metaDescription ?? "",
    nameId: product?.nameId ?? "",
    descriptionId: product?.descriptionId ?? "",
    metaTitleId: product?.metaTitleId ?? "",
    metaDescriptionId: product?.metaDescriptionId ?? "",
    idTranslationStatus: product?.idTranslationStatus ?? "Missing",
  };
}

export function ProductForm({
  mode,
  product,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  product?: ApiProduct | null;
  onSaved: (product: ApiProduct) => void;
  onCancel?: () => void;
}) {
  const categoriesState = useApi<ApiCategory[]>("/api/admin/categories");
  const conditionsState = useApi<ApiConditionOption[]>("/api/admin/conditions");
  const etsyStatus = useApi<ApiEtsyStatus>("/api/admin/integrations/etsy");
  const [values, setValues] = useState<FormValues>(() => valuesFromProduct(product));
  const [imageAlts, setImageAlts] = useState<Record<string, string>>(() => Object.fromEntries((product?.images ?? []).map(image => [image.url, image.alt ?? ""])));
  const [imageUrls, setImageUrls] = useState<string[]>(() => product?.imageUrls ?? []);
  const [videoUrl, setVideoUrl] = useState<string | null>(() => product?.videoUrl ?? null);
  const [variants, setVariants] = useState<VariantRow[]>(() => (product?.variants ?? []).map(toVariantRow));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "create" || conditionsState.loading) return;
    const options = conditionsState.data ?? [];
    if (!options.some((condition) => condition.name === values.condition && condition.isActive)) {
      const firstActive = options.find((condition) => condition.isActive);
      if (firstActive) update("condition", firstActive.name);
    }
  }, [conditionsState.data, conditionsState.loading, mode, values.condition]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const categoryOptions = (categoriesState.data ?? []).map((category) => ({
    value: category.id,
    label: category.isActive ? category.name : `${category.name} (inactive)`,
  }));
  const conditionOptions = (conditionsState.data ?? [])
    .filter((condition) => mode === "edit" || condition.isActive)
    .map((condition) => ({
    value: condition.name,
    label: condition.isActive ? condition.name : `${condition.name} (inactive)`,
    }));
  if (values.condition && !conditionOptions.some((condition) => condition.value === values.condition)) {
    conditionOptions.push({ value: values.condition, label: `${values.condition} (unavailable)` });
  }



  const addVariant = () => {
    update("workshopStockQuantity", "0");
    setVariants((current) => [
      ...current,
      {
        sku: "",
        name: "",
        price: values.price.trim() || "0",
        wholesalePrice: "",
        wholesalePiecesPerUnit: "",
        stockQuantity: "1",
        workshopStockQuantity: "0",
        weightGram: values.weightGram.trim() || "0",
        lengthMm: "",
        widthMm: "",
        heightMm: "",
        shippingClass: values.shippingClass,
      },
    ]);
  };

  const updateVariant = (index: number, patch: Partial<VariantRow>) => {
    setVariants((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  };

  const removeVariant = (index: number) => {
    setVariants((current) => current.filter((_, position) => position !== index));
  };

  const submit = async () => {
    setError(null);

    if (values.name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (!values.categoryId) {
      setError("Category is required.");
      return;
    }
    if (!values.stoneType.trim()) {
      setError("Stone type is required.");
      return;
    }
    if (!values.origin.trim()) {
      setError("Origin is required.");
      return;
    }
    if (!values.price.trim()) {
      setError("Price is required.");
      return;
    }
    if (!values.weightGram.trim()) {
      setError("Weight in grams is required.");
      return;
    }
    if (!values.sellOnWeb && !values.sellInWorkshop && !values.sellInWholesale && !values.sellInEtsy) {
      setError("Select at least one sales channel.");
      return;
    }
    const enablingEtsy = values.sellInEtsy && (!product || !product.sellInEtsy);
    if (enablingEtsy && (!etsyStatus.data?.connected || (etsyStatus.data.missingListingConfig?.length ?? 0) > 0)) {
      setError("Connect Etsy and complete its listing defaults in Settings before enabling the Etsy channel.");
      return;
    }
    if (values.sellInEtsy && variants.some((row) => row.sku.trim() && row.name.trim())) {
      setError("Etsy variation mapping is not configured yet. Remove product variants before enabling Etsy.");
      return;
    }

    const payload = {
      name: values.name.trim(),
      slug: values.slug.trim() ? values.slug.trim() : undefined,
      sku: values.sku.trim() ? values.sku.trim() : undefined,
      categoryId: values.categoryId,
      stoneType: values.stoneType.trim(),
      origin: values.origin.trim(),
      mohsHardness: toNumberOrNull(values.mohsHardness) ?? undefined,
      condition: values.condition,
      price: toNumber(values.price),
      compareAtPrice: toNumberOrNull(values.compareAtPrice),
      unit: values.unit,
      stockModel: values.stockModel,
      stockQuantity: values.stockModel === "Quantity" ? Math.max(0, Math.trunc(toNumber(values.stockQuantity))) : null,
      sellOnWeb: values.sellOnWeb,
      sellInWorkshop: values.sellInWorkshop,
      sellInWholesale: values.sellInWholesale,
      sellInEtsy: values.sellInEtsy,
      wholesalePrice: toNumberOrNull(values.wholesalePrice),
      wholesalePiecesPerUnit: toIntOrNull(values.wholesalePiecesPerUnit),
      workshopStockQuantity: 0,
      weightGram: Math.max(0, Math.trunc(toNumber(values.weightGram))),
      weightCarat: toNumberOrNull(values.weightCarat),
      lengthMm: toIntOrNull(values.lengthMm),
      widthMm: toIntOrNull(values.widthMm),
      heightMm: toIntOrNull(values.heightMm),
      status: values.status,
      tone: values.tone,
      shippingClass: values.shippingClass,
      description: values.description,
      featured: values.featured,
      fragile: values.fragile,
      metaTitle: values.metaTitle.trim() || null,
      metaDescription: values.metaDescription.trim() || null,
      nameId: values.nameId.trim() || null,
      descriptionId: values.descriptionId,
      metaTitleId: values.metaTitleId.trim() || null,
      metaDescriptionId: values.metaDescriptionId.trim() || null,
      idTranslationStatus: values.idTranslationStatus,
      images: imageUrls.map((url, index) => ({ url, alt: imageAlts[url]?.trim() || values.name.trim(), sortOrder: index })),
      videoUrl,
      variants: variants
        .filter((row) => row.sku.trim() && row.name.trim())
        .map((row, index) => ({
          ...(row.id ? { id: row.id } : {}),
          sku: row.sku.trim(),
          name: row.name.trim(),
          price: toNumber(row.price),
          wholesalePrice: toNumberOrNull(row.wholesalePrice),
          wholesalePiecesPerUnit: toIntOrNull(row.wholesalePiecesPerUnit),
          stockQuantity: Math.max(0, Math.trunc(toNumber(row.stockQuantity))),
          workshopStockQuantity: 0,
          weightGram: Math.max(0, Math.trunc(toNumber(row.weightGram))),
          lengthMm: toIntOrNull(row.lengthMm),
          widthMm: toIntOrNull(row.widthMm),
          heightMm: toIntOrNull(row.heightMm),
          shippingClass: row.shippingClass,
          sortOrder: index,
        })),
    };

    setSaving(true);
    try {
      const saved =
        mode === "create"
          ? await apiFetch<ApiProduct>("/api/admin/products", { json: payload })
          : await apiFetch<ApiProduct>(`/api/admin/products/${product?.id}`, { method: "PATCH", json: payload });
      onSaved(saved);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const slugPlaceholder = slugPreview(values.name) || "auto-generated from name";
  const etsyReady = Boolean(etsyStatus.data?.connected && etsyStatus.data.missingListingConfig.length === 0);
  const hasVariants = variants.some((row) => row.sku.trim() && row.name.trim());
  const etsyBlockedHint = etsyStatus.loading
    ? "Checking Etsy connection…"
    : etsyStatus.error
      ? "Could not check Etsy setup. Refresh the page and try again."
      : !etsyStatus.data?.connected
        ? "Connect your Etsy shop in Settings before enabling this channel."
        : etsyStatus.data.missingListingConfig.length
          ? "Complete the Etsy listing defaults in Settings first: " + etsyStatus.data.missingListingConfig.join(", ") + "."
          : hasVariants
            ? "Etsy variation mapping is not configured yet. This product currently has variants."
            : null;

  return (
    <div className="rv-stack rv-product-edit-form">
      {error ? <p className="rv-error-text">{error}</p> : null}

      <Card title="Basics" description="Core details, storefront visibility, and product status." className="rv-product-edit-section rv-product-edit-section--basics">
        <div className="rv-form-grid">
          <Field label="Name">
            <TextInput value={values.name} onChange={(value) => update("name", value)} placeholder="Forest River Cabochon" />
          </Field>
          <Field label="Slug" hint="Leave blank to generate from the name">
            <TextInput value={values.slug} onChange={(value) => update("slug", value)} placeholder={slugPlaceholder} />
          </Field>
          <Field label="SKU" hint="Leave blank to auto-generate">
            <TextInput value={values.sku} onChange={(value) => update("sku", value)} placeholder="Auto-generated" />
          </Field>
          <Field label="Category">
            <Select
              value={values.categoryId}
              onChange={(value) => update("categoryId", value)}
              options={categoryOptions}
              placeholder={categoriesState.loading ? "Loading categories…" : "Select category"}
            />
          </Field>
          <Field label="Stone type">
            <TextInput value={values.stoneType} onChange={(value) => update("stoneType", value)} placeholder="Moss Agate" />
          </Field>
          <Field label="Origin">
            <TextInput value={values.origin} onChange={(value) => update("origin", value)} placeholder="West Java, Indonesia" />
          </Field>
          <Field label="Mohs hardness">
            <TextInput
              value={values.mohsHardness}
              onChange={(value) => update("mohsHardness", value)}
              type="number"
              min={0}
              max={10}
              step="0.1"
            />
          </Field>
          <Field label="Condition">
            <Select value={values.condition} onChange={(value) => update("condition", value)} options={conditionOptions} placeholder={conditionsState.loading ? "Loading conditions…" : "Select condition"} />
          </Field>
          <Field label="Unit">
            <Select value={values.unit} onChange={(value) => update("unit", value)} options={toOptions(unitValues)} />
          </Field>
          <Field label="Status">
            <Select value={values.status} onChange={(value) => update("status", value)} options={toOptions(statusValues)} />
          </Field>
          <Field label="Tone">
            <Select value={values.tone} onChange={(value) => update("tone", value)} options={toOptions(toneValues)} />
          </Field>
          <Field label="Shipping class">
            <Select
              value={values.shippingClass}
              onChange={(value) => update("shippingClass", value)}
              options={toOptions(shippingClassValues)}
            />
          </Field>
          <Field label="Flags" className="rv-span-2">
            <div className="rv-inline">
              <Switch checked={values.featured} onChange={(checked) => update("featured", checked)} label="Featured" />
              <Switch checked={values.fragile} onChange={(checked) => update("fragile", checked)} label="Fragile" />
            </div>
          </Field>
          <Field label="Sales channels" className="rv-span-2">
            <div className="rv-inline">
              <Switch checked={values.sellOnWeb} onChange={(checked) => update("sellOnWeb", checked)} label="Website" />
              <Switch checked={values.sellInWorkshop} onChange={(checked) => update("sellInWorkshop", checked)} label="Workshop POS" />
              <Switch checked={values.sellInWholesale} onChange={(checked) => update("sellInWholesale", checked)} label="Wholesale" />
              <Switch
                checked={values.sellInEtsy}
                onChange={(checked) => update("sellInEtsy", checked)}
                label="Etsy"
                disabled={saving || etsyStatus.loading || (!values.sellInEtsy && (!etsyReady || hasVariants))}
              />
            </div>
            <div className="rv-hint">Choose the sales channels where this product can be purchased.</div>
            {values.sellInEtsy ? (
              <div className="rv-hint">
                {product?.etsySync
                  ? "Etsy sync: " + product.etsySync.status + (product.etsySync.remoteState ? " · listing " + product.etsySync.remoteState : "") + ". Draft products stay as Etsy drafts; publishing activates the listing after a successful sync."
                  : "Saving this product will queue an Etsy listing. Draft products stay as Etsy drafts; publishing activates the listing after a successful sync."}
                {product?.etsySync?.listingUrl ? <> <a href={product.etsySync.listingUrl} target="_blank" rel="noreferrer">Open listing</a>.</> : null}
              </div>
            ) : etsyBlockedHint ? (
              <div className="rv-hint">Etsy is unavailable: {etsyBlockedHint}</div>
            ) : null}
            {!values.sellInEtsy && product?.etsySync?.remoteState && product.etsySync.remoteState !== "inactive" ? (
              <div className="rv-hint">Etsy is turned off. The linked Etsy listing will be deactivated after the queued update.</div>
            ) : null}
            {product?.etsySync?.status === "Failed" && product.etsySync.lastError ? <p className="rv-error-text">Etsy sync failed: {product.etsySync.lastError}</p> : null}
          </Field>
        </div>
      </Card>

      <Card title="Pricing & stock" description="Retail and POS share one inventory pool. Set a Wholesale price when the Wholesale channel is enabled." className="rv-product-edit-section">
        <div className="rv-form-grid">
          <Field label="Price (USD)">
            <TextInput value={values.price} onChange={(value) => update("price", value)} type="number" min={0} step="0.01" />
          </Field>
          <Field label="Compare at price">
            <TextInput
              value={values.compareAtPrice}
              onChange={(value) => update("compareAtPrice", value)}
              type="number"
              min={0}
              step="0.01"
            />
          </Field>
          <Field label="Wholesale price (USD)" hint="Leave blank when variants set their own prices. This price is private to approved accounts.">
            <TextInput value={values.wholesalePrice} onChange={(value) => update("wholesalePrice", value)} type="number" min={0} step="0.01" />
          </Field>
          <Field label="Pieces per sellable unit" hint={values.unit === "piece" ? "Defaults to one piece for this product unit." : "Used to calculate the 100-piece Wholesale minimum. Leave blank if this unit does not count toward the piece minimum."}>
            <TextInput value={values.wholesalePiecesPerUnit} onChange={(value) => update("wholesalePiecesPerUnit", value)} type="number" min={1} step="1" />
          </Field>
          <Field label="Stock model">
            <Select
              value={values.stockModel}
              onChange={(value) => update("stockModel", value)}
              options={toOptions(stockModelValues)}
            />
          </Field>
          {values.stockModel === "Quantity" ? (
            <Field label="Shared stock (website + POS)">
              <TextInput value={values.stockQuantity} onChange={(value) => update("stockQuantity", value)} type="number" min={0} step="1" />
            </Field>
          ) : null}
          <Field label="Weight (g)">
            <TextInput value={values.weightGram} onChange={(value) => update("weightGram", value)} type="number" min={0} step="1" />
          </Field>
          <Field label="Weight (carat)">
            <TextInput value={values.weightCarat} onChange={(value) => update("weightCarat", value)} type="number" min={0} step="0.01" />
          </Field>
        </div>
      </Card>

      <Card title="Dimensions (mm)" description="Physical size used for product details and shipping." className="rv-product-edit-section">
        <div className="rv-form-grid">
          <Field label="Length">
            <TextInput value={values.lengthMm} onChange={(value) => update("lengthMm", value)} type="number" min={0} step="1" />
          </Field>
          <Field label="Width">
            <TextInput value={values.widthMm} onChange={(value) => update("widthMm", value)} type="number" min={0} step="1" />
          </Field>
          <Field label="Height">
            <TextInput value={values.heightMm} onChange={(value) => update("heightMm", value)} type="number" min={0} step="1" />
          </Field>
        </div>
      </Card>

      <Card
        title="Description & SEO"
        description="Generate English product copy and SEO, with Indonesian name, description, and metadata drafts."
        className="rv-product-edit-section rv-product-edit-section--copy"

      >
        <div className="rv-stack">
          <AiDraft kind="product" sourceVersion={JSON.stringify(values)} currentValues={values} context={{ ...values, category: categoriesState.data?.find(category => category.id === values.categoryId)?.name }} onApply={draft => setValues(current => ({ ...current, ...draft, idTranslationStatus: "Review" }))} />
          <Field label="Description">
            <TextArea value={values.description} onChange={(value) => update("description", value)} rows={6} />
          </Field>
          <Field label="Meta title" hint="Optional, falls back to the generated title">
            <TextInput value={values.metaTitle} onChange={(value) => update("metaTitle", value)} />
          </Field>
          <Field label="Meta description">
            <TextArea value={values.metaDescription} onChange={(value) => update("metaDescription", value)} rows={3} />
          </Field>
        </div>
      </Card>

      <SeoPanel translationStatus={values.idTranslationStatus}
        input={{ kind: "product", publicPath: `/shop/${categoriesState.data?.find(category => category.id === values.categoryId)?.slug || product?.category.slug || "category"}/${values.slug}`, title: values.name, slug: values.slug, body: values.description, metaTitle: values.metaTitle, metaDescription: values.metaDescription, images: imageUrls.map(url => ({ url, alt: imageAlts[url] || values.name, fallback: !imageAlts[url]?.trim() })) }}
        translation={{ kind: "product", publicPath: `/shop/${categoriesState.data?.find(category => category.id === values.categoryId)?.slug || product?.category.slug || "category"}/${values.slug}`, title: values.nameId, slug: values.slug, body: values.descriptionId, metaTitle: values.metaTitleId, metaDescription: values.metaDescriptionId, images: imageUrls.map(url => ({ url, alt: imageAlts[url] || values.name, fallback: !imageAlts[url]?.trim() })) }}
        onMetadata={draft => setValues(current => ({ ...current, metaTitle: draft.metaTitle, metaDescription: draft.metaDescription, metaTitleId: draft.metaTitleId, metaDescriptionId: draft.metaDescriptionId, idTranslationStatus: "Review" }))}
      />
      <Card title="Bahasa Indonesia" description="The product appears in Indonesian after its translation is ready." className="rv-product-edit-section">
        <div className="rv-stack">
          <Field label="Translation status">
            <Select value={values.idTranslationStatus} onChange={(value) => update("idTranslationStatus", value as FormValues["idTranslationStatus"])} options={[
              { value: "Missing", label: "Missing" }, { value: "Draft", label: "Draft" },
              { value: "Review", label: "Ready for review" }, { value: "Ready", label: "Ready to publish" },
            ]} />
          </Field>
          <Field label="Product name">
            <TextInput value={values.nameId} onChange={(value) => update("nameId", value)} />
          </Field>
          <Field label="Description">
            <TextArea value={values.descriptionId} onChange={(value) => update("descriptionId", value)} rows={6} />
          </Field>
          <div className="rv-form-grid">
            <Field label="Meta title">
              <TextInput value={values.metaTitleId} onChange={(value) => update("metaTitleId", value)} />
            </Field>
            <Field label="Meta description">
              <TextArea value={values.metaDescriptionId} onChange={(value) => update("metaDescriptionId", value)} rows={3} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Images & video" description="Manage the product gallery and its supporting video." className="rv-product-edit-section">
        <div className="rv-stack">
          <MediaPicker value={imageUrls} onChange={setImageUrls} folder="products" label="Product images" />
          {imageUrls.map((url, index) => <Field key={url} label={`Image ${index + 1} alt text`} hint="Describe the visible stone, angle, or detail. Falls back to the product name."><TextInput value={imageAlts[url] ?? ""} onChange={value => setImageAlts(current => ({ ...current, [url]: value }))} /></Field>)}
          <VideoPicker value={videoUrl} onChange={setVideoUrl} folder="products" />
        </div>
      </Card>

      <Card
        title="Variants"
        description="Optional SKU-level combinations"
        className="rv-product-edit-section rv-product-edit-section--variants"
        actions={
          <Button size="sm" onClick={addVariant}>
            Add variant
          </Button>
        }
        flush
      >
        <div className="rv-table-wrap">
          <table className="rv-table rv-variants-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Price</th>
                <th>Wholesale</th>
                <th>Pieces / unit</th>
                <th>Stock</th>
                <th>Weight (g)</th>
                <th>L (mm)</th>
                <th>W (mm)</th>
                <th>H (mm)</th>
                <th>Shipping</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {variants.length ? (
                variants.map((row, index) => (
                  <tr key={row.id ?? index}>
                    <td>
                      <TextInput value={row.sku} onChange={(value) => updateVariant(index, { sku: value })} />
                    </td>
                    <td>
                      <TextInput value={row.name} onChange={(value) => updateVariant(index, { name: value })} />
                    </td>
                    <td>
                      <TextInput value={row.price} onChange={(value) => updateVariant(index, { price: value })} type="number" min={0} step="0.01" />
                    </td>
                    <td>
                      <TextInput value={row.wholesalePrice} onChange={(value) => updateVariant(index, { wholesalePrice: value })} type="number" min={0} step="0.01" aria-label="Wholesale price" />
                    </td>
                    <td>
                      <TextInput value={row.wholesalePiecesPerUnit} onChange={(value) => updateVariant(index, { wholesalePiecesPerUnit: value })} type="number" min={1} step="1" aria-label="Wholesale pieces per unit" />
                    </td>
                    <td>
                      <TextInput
                        value={row.stockQuantity}
                        onChange={(value) => updateVariant(index, { stockQuantity: value })}
                        type="number"
                        min={0}
                        step="1"
                      />
                    </td>
                    <td>
                      <TextInput
                        value={row.weightGram}
                        onChange={(value) => updateVariant(index, { weightGram: value })}
                        type="number"
                        min={0}
                        step="1"
                      />
                    </td>
                    <td>
                      <TextInput value={row.lengthMm} onChange={(value) => updateVariant(index, { lengthMm: value })} type="number" min={0} step="1" />
                    </td>
                    <td>
                      <TextInput value={row.widthMm} onChange={(value) => updateVariant(index, { widthMm: value })} type="number" min={0} step="1" />
                    </td>
                    <td>
                      <TextInput value={row.heightMm} onChange={(value) => updateVariant(index, { heightMm: value })} type="number" min={0} step="1" />
                    </td>
                    <td>
                      <Select
                        value={row.shippingClass}
                        onChange={(value) => updateVariant(index, { shippingClass: value })}
                        options={toOptions(shippingClassValues)}
                      />
                    </td>
                    <td className="is-actions">
                      <Button size="sm" variant="danger" onClick={() => removeVariant(index)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12}>
                    <div className="rv-empty">No variants. Variants are optional.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card flush className="rv-product-edit-save-card">
        <div className="rv-form-actions">
          {onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
          <Button variant="primary" loading={saving} onClick={submit}>
            {mode === "create" ? "Create product" : "Save changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
