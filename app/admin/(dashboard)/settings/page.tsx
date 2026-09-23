"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage, useApi, type ApiState } from "@/components/admin/api";
import { toast } from "@/components/admin/toast";
import { Button, Card, Field, Loading, PageHeader, Switch, Tabs, TextArea, TextInput } from "@/components/admin/ui";

type GroupedSettings = Record<"general" | "seo" | "notifications" | "payments", Record<string, unknown>>;

type SettingsForm = {
  storeName: string;
  tagline: string;
  email: string;
  adminEmail: string;
  whatsapp: string;
  currency: string;
  languages: string;
  address: string;
  hours: string;
  instagram: string;
  facebook: string;
  youtube: string;
  tiktok: string;
  seoTitle: string;
  seoDescription: string;
  orderConfirmation: boolean;
  lowStock: boolean;
  newMessage: boolean;
  paypalEnabled: boolean;
  paypalEmail: string;
  bankTransferEnabled: boolean;
  paymentCurrency: string;
};

const emptyForm: SettingsForm = {
  storeName: "",
  tagline: "",
  email: "",
  adminEmail: "",
  whatsapp: "",
  currency: "USD",
  languages: "",
  address: "",
  hours: "",
  instagram: "",
  facebook: "",
  youtube: "",
  tiktok: "",
  seoTitle: "",
  seoDescription: "",
  orderConfirmation: true,
  lowStock: true,
  newMessage: true,
  paypalEnabled: true,
  paypalEmail: "",
  bankTransferEnabled: false,
  paymentCurrency: "USD",
};

const asText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

const asBool = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

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
    currency: asText(general["store.currency"]) || "USD",
    languages: asStringList(general["store.languages"]).join(", "),
    address: asText(general["store.address"]),
    hours: asText(general["store.hours"]),
    instagram: asText(socials.instagram),
    facebook: asText(socials.facebook),
    youtube: asText(socials.youtube),
    tiktok: asText(socials.tiktok),
    seoTitle: asText(seo["seo.defaultTitle"]),
    seoDescription: asText(seo["seo.defaultDescription"]),
    orderConfirmation: asBool(notifications["notifications.orderConfirmation"], true),
    lowStock: asBool(notifications["notifications.lowStock"], true),
    newMessage: asBool(notifications["notifications.newMessage"], true),
    paypalEnabled: asBool(payments["payments.paypalEnabled"], true),
    paypalEmail: asText(payments["payments.paypalEmail"]),
    bankTransferEnabled: asBool(payments["payments.bankTransferEnabled"], false),
    paymentCurrency: asText(payments["payments.currency"]) || "USD",
  };
}

export default function AdminSettingsPage() {
  const state: ApiState<GroupedSettings> = useApi<GroupedSettings>("/api/admin/settings");
  const [tab, setTab] = useState("general");
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [saved, setSaved] = useState<SettingsForm>(emptyForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state.data) return;
    const next = formFrom(state.data);
    setForm(next);
    setSaved(next);
  }, [state.data]);

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const payload: Record<string, unknown> = {};

    if (form.storeName !== saved.storeName) payload["store.name"] = form.storeName.trim();
    if (form.tagline !== saved.tagline) payload["store.tagline"] = form.tagline.trim();
    if (form.email !== saved.email) payload["store.email"] = form.email.trim();
    if (form.adminEmail !== saved.adminEmail) payload["store.adminEmail"] = form.adminEmail.trim();
    if (form.whatsapp !== saved.whatsapp) payload["store.whatsapp"] = form.whatsapp.trim();
    if (form.currency !== saved.currency) payload["store.currency"] = form.currency.trim();
    if (form.languages !== saved.languages) {
      payload["store.languages"] = form.languages
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
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

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Store, SEO, notification and payment preferences"
        actions={
          <div className="rv-inline">
            <Button onClick={state.refresh} disabled={state.loading}>
              Refresh
            </Button>
            <Button variant="primary" loading={busy} disabled={!data} onClick={save}>
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
                    <Field label="WhatsApp">
                      <TextInput value={form.whatsapp} onChange={(value) => update("whatsapp", value)} placeholder="+62…" />
                    </Field>
                    <Field label="Currency" hint="ISO code, e.g. USD">
                      <TextInput value={form.currency} onChange={(value) => update("currency", value)} />
                    </Field>
                    <Field label="Languages" hint="Comma separated, e.g. en, id">
                      <TextInput value={form.languages} onChange={(value) => update("languages", value)} />
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
                </div>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
