"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage, useApi, type ApiState } from "@/components/admin/api";
import { MediaPicker } from "@/components/admin/media";
import { toast } from "@/components/admin/toast";
import { Button, Card, Field, Loading, PageHeader, Switch, TextArea, TextInput } from "@/components/admin/ui";
import "../content.css";

type SiteContent = Record<string, unknown>;

type HomeForm = {
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  ownerName: string;
  ownerRole: string;
  ownerBio: string;
  ownerCtaLabel: string;
  ownerCtaHref: string;
  overrideEnabled: boolean;
  overrideAmount: string;
  freeShippingThreshold: string;
};

const emptyForm: HomeForm = {
  heroTitle: "",
  heroSubtitle: "",
  heroImage: "",
  ownerName: "RENDI VIRGO",
  ownerRole: "",
  ownerBio: "",
  ownerCtaLabel: "",
  ownerCtaHref: "",
  overrideEnabled: false,
  overrideAmount: "48",
  freeShippingThreshold: "0",
};

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function asBool(value: unknown): boolean {
  return value === true || value === "true";
}

function formFrom(data: SiteContent): HomeForm {
  return {
    heroTitle: asText(data["home.heroTitle"]),
    heroSubtitle: asText(data["home.heroSubtitle"]),
    heroImage: asText(data["home.heroImage"]),
    ownerName: asText(data["home.ownerName"]),
    ownerRole: asText(data["home.ownerRole"]),
    ownerBio: asText(data["home.ownerBio"]),
    ownerCtaLabel: asText(data["home.ownerCtaLabel"]),
    ownerCtaHref: asText(data["home.ownerCtaHref"]),
    overrideEnabled: asBool(data["shipping.overrideEnabled"]),
    overrideAmount: asText(data["shipping.overrideAmount"]),
    freeShippingThreshold: asText(data["shipping.freeShippingThreshold"]),
  };
}

export default function ContentHomePage() {
  const state: ApiState<SiteContent> = useApi<SiteContent>("/api/admin/site-content");
  const [form, setForm] = useState<HomeForm>(emptyForm);
  const [saved, setSaved] = useState<HomeForm>(emptyForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state.data) return;
    const next = formFrom(state.data);
    setForm(next);
    setSaved(next);
  }, [state.data]);

  const update = <K extends keyof HomeForm>(key: K, value: HomeForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const amount = Number(form.overrideAmount);
    const threshold = Number(form.freeShippingThreshold);

    if (form.overrideAmount !== saved.overrideAmount && !Number.isFinite(amount)) {
      toast.error("Override amount must be a number");
      return;
    }
    if (form.freeShippingThreshold !== saved.freeShippingThreshold && !Number.isFinite(threshold)) {
      toast.error("Free shipping threshold must be a number");
      return;
    }

    const payload: Record<string, unknown> = {};
    if (form.heroTitle !== saved.heroTitle) payload["home.heroTitle"] = form.heroTitle;
    if (form.heroSubtitle !== saved.heroSubtitle) payload["home.heroSubtitle"] = form.heroSubtitle;
    if (form.heroImage !== saved.heroImage) payload["home.heroImage"] = form.heroImage;
    if (form.ownerName !== saved.ownerName) payload["home.ownerName"] = form.ownerName;
    if (form.ownerRole !== saved.ownerRole) payload["home.ownerRole"] = form.ownerRole;
    if (form.ownerBio !== saved.ownerBio) payload["home.ownerBio"] = form.ownerBio;
    if (form.ownerCtaLabel !== saved.ownerCtaLabel) payload["home.ownerCtaLabel"] = form.ownerCtaLabel;
    if (form.ownerCtaHref !== saved.ownerCtaHref) payload["home.ownerCtaHref"] = form.ownerCtaHref;
    if (form.overrideEnabled !== saved.overrideEnabled) payload["shipping.overrideEnabled"] = form.overrideEnabled;
    if (form.overrideAmount !== saved.overrideAmount) payload["shipping.overrideAmount"] = amount;
    if (form.freeShippingThreshold !== saved.freeShippingThreshold) {
      payload["shipping.freeShippingThreshold"] = threshold;
    }

    if (!Object.keys(payload).length) {
      toast.info("No changes to save");
      return;
    }

    setBusy(true);
    try {
      const result = await apiFetch<SiteContent>("/api/admin/site-content", { method: "PATCH", json: payload });
      const next = formFrom(result);
      setForm(next);
      setSaved(next);
      state.setData(result);
      toast.success("Home page content saved");
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
        title="Home page"
        subtitle="Hero, owner story and shipping overrides"
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
            <Loading label="Loading content…" />
          </Card>
        ) : null}

        {state.error ? (
          <Card title="Could not load content">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        {data ? (
          <>
            <Card title="Hero" description="Top of the home page">
              <div className="rv-stack">
                <div className="rv-form-grid">
                  <Field label="Hero title">
                    <TextInput value={form.heroTitle} onChange={(value) => update("heroTitle", value)} />
                  </Field>
                  <Field label="Hero subtitle">
                    <TextInput value={form.heroSubtitle} onChange={(value) => update("heroSubtitle", value)} />
                  </Field>
                </div>
                <MediaPicker
                  label="Hero image"
                  folder="banners"
                  multiple={false}
                  value={form.heroImage ? [form.heroImage] : []}
                  onChange={(urls) => update("heroImage", urls[0] ?? "")}
                />
              </div>
            </Card>

            <Card title="Owner" description="Founder story block">
              <div className="rv-stack">
                <div className="rv-form-grid">
                  <Field label="Owner name">
                    <TextInput value={form.ownerName} onChange={(value) => update("ownerName", value)} />
                  </Field>
                  <Field label="Owner role">
                    <TextInput value={form.ownerRole} onChange={(value) => update("ownerRole", value)} />
                  </Field>
                </div>
                <Field label="Owner bio">
                  <TextArea rows={5} value={form.ownerBio} onChange={(value) => update("ownerBio", value)} />
                </Field>
                <div className="rv-form-grid">
                  <Field label="CTA label">
                    <TextInput value={form.ownerCtaLabel} onChange={(value) => update("ownerCtaLabel", value)} />
                  </Field>
                  <Field label="CTA link">
                    <TextInput value={form.ownerCtaHref} onChange={(value) => update("ownerCtaHref", value)} />
                  </Field>
                </div>
              </div>
            </Card>

            <Card title="Shipping overrides" description="Custom flat rate and free shipping threshold">
              <div className="rv-stack">
                <Switch
                  checked={form.overrideEnabled}
                  onChange={(checked) => update("overrideEnabled", checked)}
                  label="Override shipping amount"
                />
                <div className="rv-form-grid">
                  <Field label="Override amount" hint="Flat shipping fee">
                    <TextInput
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.overrideAmount}
                      onChange={(value) => update("overrideAmount", value)}
                    />
                  </Field>
                  <Field label="Free shipping threshold" hint="Set 0 to disable">
                    <TextInput
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.freeShippingThreshold}
                      onChange={(value) => update("freeShippingThreshold", value)}
                    />
                  </Field>
                </div>
              </div>
            </Card>

            <Card title="Preview" description="Hero and owner copy as visitors will read it">
              <div className="rv-content-preview">
                {form.heroImage ? (
                  <img className="rv-content-preview__image" src={form.heroImage} alt="" />
                ) : null}
                <div className="rv-content-preview__eyebrow">Home hero</div>
                <h2 className="rv-content-preview__title">{form.heroTitle || "Hero title"}</h2>
                <p className="rv-content-preview__subtitle">{form.heroSubtitle || "Hero subtitle"}</p>
                <div className="rv-content-preview__owner">
                  <div className="rv-content-preview__owner-name">{form.ownerName || "Owner name"}</div>
                  {form.ownerRole ? <div className="rv-content-preview__owner-role">{form.ownerRole}</div> : null}
                  <p className="rv-content-preview__owner-bio">{form.ownerBio || "Owner bio"}</p>
                  {form.ownerCtaLabel ? <span className="rv-content-preview__cta">{form.ownerCtaLabel}</span> : null}
                </div>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
