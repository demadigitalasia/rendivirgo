"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage, useApi, type ApiState } from "@/components/admin/api";
import { toast } from "@/components/admin/toast";
import { MediaPicker } from "@/components/admin/media";
import { WatermarkPositionEditor } from "@/components/admin/watermark-position-editor";
import { Badge, Button, Card, Field, Loading, PageHeader, Select, Switch, Tabs, TextArea, TextInput } from "@/components/admin/ui";
import { defaultProductWatermark } from "@/lib/product-watermark";

type GroupedSettings = Record<"general" | "seo" | "notifications" | "payments", Record<string, unknown>>;
type OpenRouterSettings = {
  configured: boolean;
  source: "dashboard" | "environment" | "missing";
  model: string;
};
type OpenRouterModel = { id: string; name: string; contextLength: number | null };

type SettingsForm = {
  storeName: string;
  tagline: string;
  email: string;
  adminEmail: string;
  whatsapp: string;
  whatsappSecondary: string;
  currency: string;
  address: string;
  hours: string;
  instagram: string;
  facebook: string;
  youtube: string;
  tiktok: string;
  watermarkEnabled: boolean;
  watermarkLogo: string;
  watermarkOpacity: string;
  watermarkSize: string;
  watermarkX: string;
  watermarkY: string;
  seoTitle: string;
  seoDescription: string;
  orderConfirmation: boolean;
  lowStock: boolean;
  newMessage: boolean;
  paypalEnabled: boolean;
  paypalEmail: string;
  bankTransferEnabled: boolean;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankSwiftCode: string;
  paymentCurrency: string;
};

const emptyForm: SettingsForm = {
  storeName: "",
  tagline: "",
  email: "",
  adminEmail: "",
  whatsapp: "",
  whatsappSecondary: "",
  currency: "USD",
  address: "",
  hours: "",
  instagram: "",
  facebook: "",
  youtube: "",
  tiktok: "",
  watermarkEnabled: defaultProductWatermark.enabled,
  watermarkLogo: defaultProductWatermark.logo,
  watermarkOpacity: String(Math.round(defaultProductWatermark.opacity * 100)),
  watermarkSize: String(defaultProductWatermark.size),
  watermarkX: String(defaultProductWatermark.x),
  watermarkY: String(defaultProductWatermark.y),
  seoTitle: "",
  seoDescription: "",
  orderConfirmation: true,
  lowStock: true,
  newMessage: true,
  paypalEnabled: true,
  paypalEmail: "",
  bankTransferEnabled: true,
  bankName: "PT BANK CENTRAL ASIA",
  bankAccountName: "RENDI VIRGO",
  bankAccountNumber: "3770362741",
  bankSwiftCode: "CENAIDJA",
  paymentCurrency: "USD",
};

const asText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

const asBool = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

function formFrom(data: GroupedSettings): SettingsForm {
  const general = data.general ?? {};
  const seo = data.seo ?? {};
  const notifications = data.notifications ?? {};
  const payments = data.payments ?? {};
  const socials = asRecord(general["store.socials"]);

  return {
    storeName: asText(general["store.name"]),
    tagline: asText(general["store.tagline"]),
    email: asText(general["store.email"]),
    adminEmail: asText(general["store.adminEmail"]),
    whatsapp: asText(general["store.whatsapp"]),
    whatsappSecondary: asText(general["store.whatsappSecondary"]),
    currency: asText(general["store.currency"]) || "USD",
    address: asText(general["store.address"]),
    hours: asText(general["store.hours"]),
    instagram: asText(socials.instagram),
    facebook: asText(socials.facebook),
    youtube: asText(socials.youtube),
    tiktok: asText(socials.tiktok),
    watermarkEnabled: asBool(general["store.productWatermarkEnabled"], defaultProductWatermark.enabled),
    watermarkLogo: asText(general["store.productWatermarkLogo"]) || defaultProductWatermark.logo,
    watermarkOpacity: String(Math.round(Number(general["store.productWatermarkOpacity"] ?? defaultProductWatermark.opacity) * 100)),
    watermarkSize: String(Number(general["store.productWatermarkSize"] ?? defaultProductWatermark.size)),
    watermarkX: String(Number(general["store.productWatermarkX"] ?? defaultProductWatermark.x)),
    watermarkY: String(Number(general["store.productWatermarkY"] ?? defaultProductWatermark.y)),
    seoTitle: asText(seo["seo.defaultTitle"]),
    seoDescription: asText(seo["seo.defaultDescription"]),
    orderConfirmation: asBool(notifications["notifications.orderConfirmation"], true),
    lowStock: asBool(notifications["notifications.lowStock"], true),
    newMessage: asBool(notifications["notifications.newMessage"], true),
    paypalEnabled: asBool(payments["payments.paypalEnabled"], true),
    paypalEmail: asText(payments["payments.paypalEmail"]),
    bankTransferEnabled: asBool(payments["payments.bankTransferEnabled"], true),
    bankName: asText(payments["payments.bankName"]) || "PT BANK CENTRAL ASIA",
    bankAccountName: asText(payments["payments.bankAccountName"]) || "RENDI VIRGO",
    bankAccountNumber: asText(payments["payments.bankAccountNumber"]) || "3770362741",
    bankSwiftCode: asText(payments["payments.bankSwiftCode"]) || "CENAIDJA",
    paymentCurrency: asText(payments["payments.currency"]) || "USD",
  };
}

export default function AdminSettingsPage() {
  const state: ApiState<GroupedSettings> = useApi<GroupedSettings>("/api/admin/settings");
  const aiState: ApiState<OpenRouterSettings> = useApi<OpenRouterSettings>("/api/admin/settings/ai/openrouter");
  const [tab, setTab] = useState("general");
  const modelsState: ApiState<{ models: OpenRouterModel[] }> = useApi(
    tab === "ai" ? "/api/admin/settings/ai/openrouter/models" : null,
    { enabled: tab === "ai" },
  );
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [saved, setSaved] = useState<SettingsForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [aiModel, setAiModel] = useState("openai/gpt-4.1-mini");
  const [modelSearch, setModelSearch] = useState("");
  const [savedAiModel, setSavedAiModel] = useState("openai/gpt-4.1-mini");
  const [aiBusy, setAiBusy] = useState(false);
  const aiDirty = Boolean(apiKey.trim()) || aiModel.trim() !== savedAiModel;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  useEffect(() => {
    if (!state.data) return;
    const next = formFrom(state.data);
    setForm(next);
    setSaved(next);
  }, [state.data]);

  useEffect(() => {
    if (!aiState.data) return;
    setAiModel(aiState.data.model);
    setSavedAiModel(aiState.data.model);
  }, [aiState.data]);

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!dirty && !aiDirty) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [dirty, aiDirty]);

  const saveAiSettings = async () => {
    if (!aiDirty) {
      toast.info("No AI settings to save");
      return;
    }

    const nextModel = aiModel.trim();
    if (!nextModel) {
      toast.error("Model ID is required");
      return;
    }

    setAiBusy(true);
    try {
      const result = await apiFetch<OpenRouterSettings>("/api/admin/settings/ai/openrouter", {
        method: "PUT",
        json: {
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(nextModel !== savedAiModel ? { model: nextModel } : {}),
        },
      });
      setApiKey("");
      setAiModel(result.model);
      setSavedAiModel(result.model);
      aiState.setData(result);
      modelsState.refresh();
      toast.success("OpenRouter settings saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAiBusy(false);
    }
  };

  const removeAiKey = async () => {
    if (!window.confirm("Remove the OpenRouter API key saved in the dashboard?")) return;
    setAiBusy(true);
    try {
      const result = await apiFetch<OpenRouterSettings>("/api/admin/settings/ai/openrouter/api-key", {
        method: "DELETE",
      });
      aiState.setData(result);
      modelsState.refresh();
      toast.success(result.configured ? "Dashboard key removed; environment key is still active" : "OpenRouter API key removed");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    const payload: Record<string, unknown> = {};

    if (form.storeName !== saved.storeName) payload["store.name"] = form.storeName.trim();
    if (form.tagline !== saved.tagline) payload["store.tagline"] = form.tagline.trim();
    if (form.email !== saved.email) payload["store.email"] = form.email.trim();
    if (form.adminEmail !== saved.adminEmail) payload["store.adminEmail"] = form.adminEmail.trim();
    if (form.whatsapp !== saved.whatsapp) payload["store.whatsapp"] = form.whatsapp.trim();
    if (form.whatsappSecondary !== saved.whatsappSecondary) {
      payload["store.whatsappSecondary"] = form.whatsappSecondary.trim();
    }
    if (form.currency !== saved.currency) payload["store.currency"] = form.currency.trim();
    if (form.address !== saved.address) payload["store.address"] = form.address.trim();
    if (form.hours !== saved.hours) payload["store.hours"] = form.hours.trim();

    const socialsChanged =
      form.instagram !== saved.instagram ||
      form.facebook !== saved.facebook ||
      form.youtube !== saved.youtube ||
      form.tiktok !== saved.tiktok;
    if (socialsChanged) {
      payload["store.socials"] = {
        instagram: form.instagram.trim(),
        facebook: form.facebook.trim(),
        youtube: form.youtube.trim(),
        tiktok: form.tiktok.trim(),
      };
    }

    if (form.watermarkEnabled !== saved.watermarkEnabled) {
      payload["store.productWatermarkEnabled"] = form.watermarkEnabled;
    }
    if (form.watermarkLogo !== saved.watermarkLogo) {
      payload["store.productWatermarkLogo"] = form.watermarkLogo.trim() || defaultProductWatermark.logo;
    }
    if (form.watermarkOpacity !== saved.watermarkOpacity) {
      const opacityPercent = Math.min(100, Math.max(10, Number(form.watermarkOpacity) || 72));
      payload["store.productWatermarkOpacity"] = opacityPercent / 100;
    }
    if (form.watermarkSize !== saved.watermarkSize) {
      payload["store.productWatermarkSize"] = Math.min(50, Math.max(8, Number(form.watermarkSize) || 26));
    }
    if (form.watermarkX !== saved.watermarkX) payload["store.productWatermarkX"] = Math.min(watermarkMaxX, Math.max(0, Number(form.watermarkX) || 0));
    if (form.watermarkY !== saved.watermarkY) payload["store.productWatermarkY"] = Math.min(watermarkMaxY, Math.max(0, Number(form.watermarkY) || 0));

    if (form.seoTitle !== saved.seoTitle) payload["seo.defaultTitle"] = form.seoTitle.trim();
    if (form.seoDescription !== saved.seoDescription) payload["seo.defaultDescription"] = form.seoDescription.trim();

    if (form.orderConfirmation !== saved.orderConfirmation) {
      payload["notifications.orderConfirmation"] = form.orderConfirmation;
    }
    if (form.lowStock !== saved.lowStock) payload["notifications.lowStock"] = form.lowStock;
    if (form.newMessage !== saved.newMessage) payload["notifications.newMessage"] = form.newMessage;

    if (form.paypalEnabled !== saved.paypalEnabled) payload["payments.paypalEnabled"] = form.paypalEnabled;
    if (form.paypalEmail !== saved.paypalEmail) payload["payments.paypalEmail"] = form.paypalEmail.trim();
    if (form.bankTransferEnabled !== saved.bankTransferEnabled) {
      payload["payments.bankTransferEnabled"] = form.bankTransferEnabled;
    }
    if (form.bankName !== saved.bankName) payload["payments.bankName"] = form.bankName.trim();
    if (form.bankAccountName !== saved.bankAccountName) payload["payments.bankAccountName"] = form.bankAccountName.trim();
    if (form.bankAccountNumber !== saved.bankAccountNumber) payload["payments.bankAccountNumber"] = form.bankAccountNumber.trim();
    if (form.bankSwiftCode !== saved.bankSwiftCode) payload["payments.bankSwiftCode"] = form.bankSwiftCode.trim().toUpperCase();
    if (form.paymentCurrency !== saved.paymentCurrency) payload["payments.currency"] = form.paymentCurrency.trim();

    if (!Object.keys(payload).length) {
      toast.info("No changes to save");
      return;
    }

    setBusy(true);
    try {
      const result = await apiFetch<GroupedSettings>("/api/admin/settings", { method: "PATCH", json: payload });
      const next = formFrom(result);
      setForm(next);
      setSaved(next);
      state.setData(result);
      toast.success("Settings saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const data = state.data;
  const modelSearchNormalized = modelSearch.trim().toLowerCase();
  const availableModels = modelsState.data?.models ?? [];
  const visibleModels = modelSearchNormalized
    ? availableModels.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(modelSearchNormalized))
    : availableModels;
  const selectedCatalogModel = visibleModels.some((model) => model.id === aiModel) ? aiModel : "";
  const watermarkSize = Math.min(50, Math.max(8, Number(form.watermarkSize) || 26));
  const watermarkMaxX = Math.floor(100 - watermarkSize);
  const watermarkMaxY = Math.floor(100 - watermarkSize / 3);
  const updateWatermarkCoordinate = (axis: "watermarkX" | "watermarkY", value: string) => {
    const maximum = axis === "watermarkX" ? watermarkMaxX : watermarkMaxY;
    update(axis, String(Math.min(maximum, Math.max(0, Number(value) || 0))));
  };

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Store, SEO, notification, payment and AI preferences"
        actions={
          <div className="rv-inline">
            <Button onClick={state.refresh} disabled={state.loading}>
              Refresh
            </Button>
            {dirty ? <Badge tone="amber">Unsaved changes</Badge> : null}
            <Button variant="primary" loading={busy} disabled={!data || !dirty} onClick={save}>
              Save changes
            </Button>
          </div>
        }
      />

      <div className="rv-content">
        {state.loading && !data ? (
          <Card>
            <Loading label="Loading settings…" />
          </Card>
        ) : null}

        {state.error ? (
          <Card title="Could not load settings">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        {data ? (
          <>
            <Card>
              <Tabs
                tabs={[
                  { value: "general", label: "General" },
                  { value: "seo", label: "SEO" },
                  { value: "notifications", label: "Notifications" },
                  { value: "payments", label: "Payments" },
                  { value: "ai", label: "AI & API" },
                ]}
                value={tab}
                onChange={setTab}
              />
            </Card>

            {tab === "general" ? (
              <>
                <Card title="Store details" description="Identity and contact information">
                  <div className="rv-form-grid">
                    <Field label="Store name">
                      <TextInput value={form.storeName} onChange={(value) => update("storeName", value)} />
                    </Field>
                    <Field label="Tagline">
                      <TextInput value={form.tagline} onChange={(value) => update("tagline", value)} />
                    </Field>
                    <Field label="Contact email">
                      <TextInput type="email" value={form.email} onChange={(value) => update("email", value)} />
                    </Field>
                    <Field label="Admin email" hint="Receives internal notifications">
                      <TextInput type="email" value={form.adminEmail} onChange={(value) => update("adminEmail", value)} />
                    </Field>
                    <Field label="WhatsApp number 1 (main)">
                      <TextInput value={form.whatsapp} onChange={(value) => update("whatsapp", value)} placeholder="+62…" />
                    </Field>
                    <Field label="WhatsApp number 2">
                      <TextInput
                        value={form.whatsappSecondary}
                        onChange={(value) => update("whatsappSecondary", value)}
                        placeholder="+62…"
                      />
                    </Field>
                    <Field label="Currency" hint="ISO code, e.g. USD">
                      <TextInput value={form.currency} onChange={(value) => update("currency", value)} />
                    </Field>
                    <Field label="Storefront languages" hint="Supported languages are managed by the storefront release.">
                      <TextInput value="English (default), Bahasa Indonesia" readOnly />
                    </Field>
                    <Field label="Opening hours">
                      <TextInput
                        value={form.hours}
                        onChange={(value) => update("hours", value)}
                        placeholder="Mon–Sat 09:00–18:00"
                      />
                    </Field>
                    <Field label="Address" className="rv-span-2">
                      <TextArea value={form.address} onChange={(value) => update("address", value)} rows={3} />
                    </Field>
                  </div>
                </Card>

                <Card title="Socials" description="Public profile links">
                  <div className="rv-form-grid">
                    <Field label="Instagram">
                      <TextInput value={form.instagram} onChange={(value) => update("instagram", value)} placeholder="https://" />
                    </Field>
                    <Field label="Facebook">
                      <TextInput value={form.facebook} onChange={(value) => update("facebook", value)} placeholder="https://" />
                    </Field>
                    <Field label="YouTube">
                      <TextInput value={form.youtube} onChange={(value) => update("youtube", value)} placeholder="https://" />
                    </Field>
                    <Field label="TikTok">
                      <TextInput value={form.tiktok} onChange={(value) => update("tiktok", value)} placeholder="https://" />
                    </Field>
                  </div>
                </Card>

                <Card title="Product image watermark" description="Add your logo automatically to product photos shown across the storefront">
                  <div className="rv-stack">
                    <Switch
                      checked={form.watermarkEnabled}
                      onChange={(checked) => update("watermarkEnabled", checked)}
                      label="Enable product image watermark"
                    />
                    <MediaPicker
                      value={form.watermarkLogo ? [form.watermarkLogo] : []}
                      onChange={(urls) => update("watermarkLogo", urls[0] ?? "")}
                      folder="brand"
                      multiple={false}
                      label="Watermark logo"
                    />
                    <WatermarkPositionEditor
                      logo={form.watermarkLogo}
                      x={Math.min(watermarkMaxX, Math.max(0, Number(form.watermarkX) || 0))}
                      y={Math.min(watermarkMaxY, Math.max(0, Number(form.watermarkY) || 0))}
                      size={watermarkSize}
                      opacity={Math.min(1, Math.max(0.1, (Number(form.watermarkOpacity) || 72) / 100))}
                      onChange={(x, y) => {
                        update("watermarkX", String(x));
                        update("watermarkY", String(y));
                      }}
                    />
                    <div className="rv-inline" style={{ justifyContent: "flex-end" }}>
                      <Button
                        size="sm"
                        onClick={() => {
                          update("watermarkX", String(Math.floor(100 - watermarkSize - 5)));
                          update("watermarkY", String(Math.floor(100 - watermarkSize / 3 - 5)));
                        }}
                      >
                        Reset position
                      </Button>
                    </div>
                    <div className="rv-form-grid">
                      <Field label="X position (%)" hint="Distance from the left edge">
                        <TextInput type="number" min={0} max={watermarkMaxX} value={form.watermarkX} onChange={(value) => updateWatermarkCoordinate("watermarkX", value)} />
                      </Field>
                      <Field label="Y position (%)" hint="Distance from the top edge">
                        <TextInput type="number" min={0} max={watermarkMaxY} value={form.watermarkY} onChange={(value) => updateWatermarkCoordinate("watermarkY", value)} />
                      </Field>
                      <Field label="Logo size (% of image)" hint="Choose a value from 8 to 50">
                        <TextInput type="number" min={8} max={50} value={form.watermarkSize} onChange={(value) => {
                          update("watermarkSize", value);
                          const nextSize = Math.min(50, Math.max(8, Number(value) || 26));
                          update("watermarkX", String(Math.min(100 - nextSize, Number(form.watermarkX) || 0)));
                          update("watermarkY", String(Math.min(Math.floor(100 - nextSize / 3), Number(form.watermarkY) || 0)));
                        }} />
                      </Field>
                      <Field label="Opacity (%)" hint="Choose a value from 10 to 100">
                        <TextInput type="number" min={10} max={100} value={form.watermarkOpacity} onChange={(value) => update("watermarkOpacity", value)} />
                      </Field>
                    </div>
                  </div>
                </Card>
              </>
            ) : null}

            {tab === "seo" ? (
              <Card title="Search engine defaults" description="Fallbacks when a page has no meta title or description">
                <div className="rv-stack">
                  <Field label="Default title">
                    <TextInput value={form.seoTitle} onChange={(value) => update("seoTitle", value)} />
                  </Field>
                  <Field label="Default description" hint="Aim for 150–160 characters">
                    <TextArea value={form.seoDescription} onChange={(value) => update("seoDescription", value)} rows={4} />
                  </Field>
                </div>
              </Card>
            ) : null}

            {tab === "notifications" ? (
              <Card title="Notifications" description="Choose which events trigger email alerts">
                <div className="rv-stack">
                  <Switch
                    checked={form.orderConfirmation}
                    onChange={(checked) => update("orderConfirmation", checked)}
                    label="Order confirmation emails"
                  />
                  <Switch
                    checked={form.lowStock}
                    onChange={(checked) => update("lowStock", checked)}
                    label="Low stock alerts"
                  />
                  <Switch
                    checked={form.newMessage}
                    onChange={(checked) => update("newMessage", checked)}
                    label="New contact message alerts"
                  />
                </div>
              </Card>
            ) : null}

            {tab === "payments" ? (
              <Card title="Payments" description="Enabled payment methods and payout details">
                <div className="rv-stack">
                  <Switch
                    checked={form.paypalEnabled}
                    onChange={(checked) => update("paypalEnabled", checked)}
                    label="PayPal enabled"
                  />
                  <div className="rv-form-grid">
                    <Field label="PayPal email">
                      <TextInput
                        type="email"
                        value={form.paypalEmail}
                        onChange={(value) => update("paypalEmail", value)}
                        disabled={!form.paypalEnabled}
                      />
                    </Field>
                    <Field label="Payment currency" hint="Defaults to the store currency">
                      <TextInput value={form.paymentCurrency} onChange={(value) => update("paymentCurrency", value)} />
                    </Field>
                  </div>
                  <Switch
                    checked={form.bankTransferEnabled}
                    onChange={(checked) => update("bankTransferEnabled", checked)}
                    label="Bank transfer enabled"
                  />
                  <div className="rv-form-grid">
                    <Field label="Bank name">
                      <TextInput
                        value={form.bankName}
                        onChange={(value) => update("bankName", value)}
                        disabled={!form.bankTransferEnabled}
                      />
                    </Field>
                    <Field label="Account holder name" hint="Use the exact name registered at the bank">
                      <TextInput
                        value={form.bankAccountName}
                        onChange={(value) => update("bankAccountName", value)}
                        disabled={!form.bankTransferEnabled}
                      />
                    </Field>
                    <Field label="Account number">
                      <TextInput
                        value={form.bankAccountNumber}
                        onChange={(value) => update("bankAccountNumber", value)}
                        disabled={!form.bankTransferEnabled}
                      />
                    </Field>
                    <Field label="SWIFT code">
                      <TextInput
                        value={form.bankSwiftCode}
                        onChange={(value) => update("bankSwiftCode", value)}
                        disabled={!form.bankTransferEnabled}
                      />
                    </Field>
                  </div>
                </div>
              </Card>
            ) : null}

            {tab === "ai" ? (
              <Card
                title="OpenRouter AI"
                description="Configure API access and choose a model for Generate with AI on the product form."
                actions={
                  aiState.data ? (
                    <Badge tone={aiState.data.configured ? "green" : "gray"}>
                      {aiState.data.configured
                        ? aiState.data.source === "dashboard"
                          ? "Dashboard key active"
                          : "Environment key active"
                        : "Not configured"}
                    </Badge>
                  ) : null
                }
              >
                {aiState.loading && !aiState.data ? <Loading label="Loading AI settings…" /> : null}
                {aiState.error ? <p className="rv-error-text">{aiState.error}</p> : null}
                <div className="rv-stack">
                  <Field
                    label="OpenRouter API key"
                    hint={
                      aiState.data?.source === "dashboard"
                        ? "A key is saved securely and will never be shown here. Enter a new key to replace it, or leave blank to keep it."
                        : aiState.data?.source === "environment"
                          ? "The API currently uses the server environment key. Enter a dashboard key to override it."
                          : "The key is encrypted before it is stored. It is only sent to OpenRouter by the server."
                    }
                  >
                    <TextInput
                      type="password"
                      autoComplete="new-password"
                      value={apiKey}
                      onChange={setApiKey}
                      placeholder={aiState.data?.source === "dashboard" ? "Saved key — enter a replacement" : "sk-or-v1-…"}
                      disabled={aiBusy || !aiState.data}
                    />
                  </Field>
                  <div className="rv-stack">
                    <div className="rv-inline" style={{ justifyContent: "space-between" }}>
                      <span className="rv-hint">
                        {modelsState.data ? `${availableModels.length} compatible models from OpenRouter` : "Load the OpenRouter model catalog"}
                      </span>
                      <Button
                        size="sm"
                        onClick={modelsState.refresh}
                        loading={modelsState.loading}
                        disabled={modelsState.loading || aiBusy || !aiState.data?.configured}
                      >
                        Refresh catalog
                      </Button>
                    </div>
                    {modelsState.error ? <p className="rv-error-text">{modelsState.error}</p> : null}
                    <Field label="Search models">
                      <TextInput
                        value={modelSearch}
                        onChange={setModelSearch}
                        placeholder="Search by model name or ID"
                        disabled={aiBusy || !aiState.data?.configured}
                      />
                    </Field>
                    <Field
                      label="Available models"
                      hint="The generator requires structured output, so only compatible text models are listed."
                    >
                      <Select
                        value={selectedCatalogModel}
                        onChange={setAiModel}
                        options={visibleModels.map((model) => ({ value: model.id, label: `${model.name} · ${model.id}` }))}
                        placeholder={modelsState.loading ? "Loading models…" : "Select an OpenRouter model"}
                        disabled={aiBusy || modelsState.loading || !visibleModels.length}
                      />
                    </Field>
                  </div>
                  <Field label="Model ID" hint="Selected catalog models fill this value. You can also enter an ID manually.">
                    <TextInput value={aiModel} onChange={setAiModel} placeholder="openai/gpt-4.1-mini" disabled={aiBusy || !aiState.data} />
                  </Field>
                  {aiState.data?.source === "dashboard" ? (
                    <p className="rv-hint">The saved key is encrypted with SESSION_SECRET. Keep that secret stable so the server can decrypt it.</p>
                  ) : null}
                  <div className="rv-inline" style={{ justifyContent: "flex-end" }}>
                    {aiState.data?.source === "dashboard" ? (
                      <Button variant="danger" loading={aiBusy} disabled={aiBusy || !aiState.data} onClick={removeAiKey}>
                        Remove saved key
                      </Button>
                    ) : null}
                    <Button variant="primary" loading={aiBusy} disabled={aiBusy || !aiDirty || !aiState.data} onClick={saveAiSettings}>
                      Save AI settings
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
