"use client";

import type { HeroDocument } from "@/lib/hero-slides";
import { AiDraft } from "@/components/admin/ai-draft";
import { SeoPanel } from "@/components/admin/seo-panel";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage, useApi, type ApiState } from "@/components/admin/api";
import { MediaPicker } from "@/components/admin/media";
import { toast } from "@/components/admin/toast";
import { Button, Card, Field, Loading, PageHeader, Select, Switch, TextArea, TextInput } from "@/components/admin/ui";
import { translationStatusOptions, type TranslationStatus } from "../types";
import "../content.css";
import "./home.css";

type SiteContent = Record<string, unknown>;

type HomeForm = {
  metaTitle: string;
  metaDescription: string;
  metaTitleId: string;
  metaDescriptionId: string;

  heroTitle: string;
  heroSubtitle: string;
  heroTitleId: string;
  heroSubtitleId: string;
  heroImage: string;
  ownerName: string;
  ownerRole: string;
  ownerRoleId: string;
  ownerBio: string;
  ownerBioId: string;
  aboutRendiImage: string;
  aboutPajarImage: string;
  ownerCtaLabel: string;
  ownerCtaLabelId: string;
  ownerCtaHref: string;
  idTranslationStatus: TranslationStatus;
  overrideEnabled: boolean;
  overrideAmount: string;
  freeShippingThreshold: string;
};

const emptyForm: HomeForm = {
  metaTitle: "",
  metaDescription: "",
  metaTitleId: "",
  metaDescriptionId: "",

  heroTitle: "",
  heroSubtitle: "",
  heroTitleId: "",
  heroSubtitleId: "",
  heroImage: "",
  ownerName: "RENDI VIRGO",
  ownerRole: "",
  ownerRoleId: "",
  ownerBio: "",
  ownerBioId: "",
  aboutRendiImage: "",
  aboutPajarImage: "/images/pajar-agung-owner-cutout.png",
  ownerCtaLabel: "",
  ownerCtaLabelId: "",
  ownerCtaHref: "",
  idTranslationStatus: "Missing",
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
    metaTitle: asText(data["home.metaTitle"]),
    metaDescription: asText(data["home.metaDescription"]),
    metaTitleId: asText(data["home.metaTitleId"]),
    metaDescriptionId: asText(data["home.metaDescriptionId"]),

    heroTitle: asText(data["home.heroTitle"]),
    heroSubtitle: asText(data["home.heroSubtitle"]),
    heroTitleId: asText(data["home.heroTitleId"]),
    heroSubtitleId: asText(data["home.heroSubtitleId"]),
    heroImage: asText(data["home.heroImage"]),
    ownerName: asText(data["home.ownerName"]),
    ownerRole: asText(data["home.ownerRole"]),
    ownerRoleId: asText(data["home.ownerRoleId"]),
    ownerBio: asText(data["home.ownerBio"]),
    ownerBioId: asText(data["home.ownerBioId"]),
    aboutRendiImage: asText(data["about.rendiImage"]) || asText(data["home.ownerImage"]),
    aboutPajarImage: asText(data["about.pajarImage"]) || "/images/pajar-agung-owner-cutout.png",
    ownerCtaLabel: asText(data["home.ownerCtaLabel"]),
    ownerCtaLabelId: asText(data["home.ownerCtaLabelId"]),
    ownerCtaHref: asText(data["home.ownerCtaHref"]),
    idTranslationStatus: (asText(data["home.idTranslationStatus"]) || "Missing") as TranslationStatus,
    overrideEnabled: asBool(data["shipping.overrideEnabled"]),
    overrideAmount: asText(data["shipping.overrideAmount"]),
    freeShippingThreshold: asText(data["shipping.freeShippingThreshold"]),
  };
}

export default function ContentHomePage() {
  const state: ApiState<SiteContent> = useApi<SiteContent>("/api/admin/site-content");
  const heroState = useApi<HeroDocument>("/api/admin/hero-slides");
  const hero = heroState.data?.slides.find(slide => slide.isActive);
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
    if (form.metaTitle !== saved.metaTitle) payload["home.metaTitle"] = form.metaTitle;
    if (form.metaDescription !== saved.metaDescription) payload["home.metaDescription"] = form.metaDescription;
    if (form.metaTitleId !== saved.metaTitleId) payload["home.metaTitleId"] = form.metaTitleId;
    if (form.metaDescriptionId !== saved.metaDescriptionId) payload["home.metaDescriptionId"] = form.metaDescriptionId;

    if (form.ownerName !== saved.ownerName) payload["home.ownerName"] = form.ownerName;
    if (form.ownerRole !== saved.ownerRole) payload["home.ownerRole"] = form.ownerRole;
    if (form.ownerRoleId !== saved.ownerRoleId) payload["home.ownerRoleId"] = form.ownerRoleId;
    if (form.ownerBio !== saved.ownerBio) payload["home.ownerBio"] = form.ownerBio;
    if (form.ownerBioId !== saved.ownerBioId) payload["home.ownerBioId"] = form.ownerBioId;
    if (form.aboutRendiImage !== saved.aboutRendiImage) payload["about.rendiImage"] = form.aboutRendiImage;
    if (form.aboutPajarImage !== saved.aboutPajarImage) payload["about.pajarImage"] = form.aboutPajarImage;
    if (form.ownerCtaLabel !== saved.ownerCtaLabel) payload["home.ownerCtaLabel"] = form.ownerCtaLabel;
    if (form.ownerCtaLabelId !== saved.ownerCtaLabelId) payload["home.ownerCtaLabelId"] = form.ownerCtaLabelId;
    if (form.idTranslationStatus !== saved.idTranslationStatus) payload["home.idTranslationStatus"] = form.idTranslationStatus;
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

      <div className="rv-content rv-home-content">
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
          <div className="rv-home-layout">
            <div className="rv-stack rv-home-form">
              <Card title="AI content assistant" description="Draft homepage copy from your existing content and verified facts.">
                <AiDraft kind="home" sourceVersion={JSON.stringify(form)} currentValues={form} context={{ heroTitle: form.heroTitle, heroSubtitle: form.heroSubtitle, ownerName: form.ownerName, ownerRole: form.ownerRole, ownerBio: form.ownerBio }} onApply={draft => setForm(current => ({ ...current, ownerBio: draft.ownerBio, ownerBioId: draft.ownerBioId, metaTitle: draft.metaTitle, metaDescription: draft.metaDescription, metaTitleId: draft.metaTitleId, metaDescriptionId: draft.metaDescriptionId, idTranslationStatus: "Review" }))} />
              </Card>
              <Card title="Home SEO">
                <div className="rv-stack">
                  <SeoPanel translationStatus={form.idTranslationStatus} input={{ kind: "home", title: hero?.en.title || form.heroTitle, slug: "", body: `${hero?.en.description || form.heroSubtitle}\n\n${form.ownerBio}`, metaTitle: form.metaTitle, metaDescription: form.metaDescription, images: [{ url: hero?.imageUrl || form.heroImage, alt: hero?.en.alt || form.heroTitle, fallback: true }] }}
                    translation={{ kind: "home", title: hero?.idCopy.title || form.heroTitleId, slug: "", body: `${hero?.idCopy.description || form.heroSubtitleId}\n\n${form.ownerBioId}`, metaTitle: form.metaTitleId, metaDescription: form.metaDescriptionId, images: [{ url: hero?.imageUrl || form.heroImage, alt: hero?.idCopy.alt || form.heroTitleId, fallback: true }] }}
                    onMetadata={draft => setForm(current => ({ ...current, metaTitle: draft.metaTitle, metaDescription: draft.metaDescription, metaTitleId: draft.metaTitleId, metaDescriptionId: draft.metaDescriptionId, idTranslationStatus: "Review" }))} />
                  <Field label="SEO title (English)"><TextArea rows={2} value={form.metaTitle} onChange={value => update("metaTitle", value)} /></Field>
                  <Field label="Meta description (English)"><TextArea rows={2} value={form.metaDescription} onChange={value => update("metaDescription", value)} /></Field>
                  <Field label="SEO title (Bahasa Indonesia)"><TextArea rows={2} value={form.metaTitleId} onChange={value => update("metaTitleId", value)} /></Field>
                  <Field label="Meta description (Bahasa Indonesia)"><TextArea rows={2} value={form.metaDescriptionId} onChange={value => update("metaDescriptionId", value)} /></Field>
                </div>
              </Card>
              <Card title="Hero Slides" description="Images, bilingual copy, buttons, animation and slide order are managed together.">
                <p>{heroState.loading ? "Loading hero slides…" : `${heroState.data?.slides.filter(slide => slide.isActive).length ?? 0} active slides`}</p>
                <Button variant="primary" href="/admin/content/home/hero-slides">Manage Hero Slides</Button>
              </Card>

              <Card title="Owner" description="Founder story block" className="rv-home-section">
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
                    <Field label="Owner role in Bahasa Indonesia">
                      <TextInput value={form.ownerRoleId} onChange={(value) => update("ownerRoleId", value)} />
                    </Field>
                    <Field label="Owner bio in Bahasa Indonesia">
                      <TextArea rows={5} value={form.ownerBioId} onChange={(value) => update("ownerBioId", value)} />
                    </Field>
                  </div>
                  <div className="rv-form-grid">
                    <Field label="CTA label">
                      <TextInput value={form.ownerCtaLabel} onChange={(value) => update("ownerCtaLabel", value)} />
                    </Field>
                    <Field label="CTA label in Bahasa Indonesia">
                      <TextInput value={form.ownerCtaLabelId} onChange={(value) => update("ownerCtaLabelId", value)} />
                    </Field>
                    <Field label="CTA link">
                      <TextInput value={form.ownerCtaHref} onChange={(value) => update("ownerCtaHref", value)} />
                    </Field>
                  </div>
                  <Field label="Indonesian translation status" hint="Only set to ready after every Indonesian field has been reviewed.">
                    <Select value={form.idTranslationStatus} onChange={(value) => update("idTranslationStatus", value as TranslationStatus)} options={translationStatusOptions} />
                  </Field>
                </div>
              </Card>

              <Card title="About Us owner photos" description="These photos are separate from the owner story image used on the Home page." className="rv-home-section">
                <div className="rv-form-grid">
                  <MediaPicker
                    label="Rendi Virgo photo"
                    folder="pages"
                    multiple={false}
                    value={form.aboutRendiImage ? [form.aboutRendiImage] : []}
                    onChange={(urls) => update("aboutRendiImage", urls[0] ?? "")}
                  />
                  <MediaPicker
                    label="Pajar Agung photo"
                    folder="pages"
                    multiple={false}
                    value={form.aboutPajarImage ? [form.aboutPajarImage] : []}
                    onChange={(urls) => update("aboutPajarImage", urls[0] ?? "")}
                  />
                </div>
              </Card>

              <Card title="Shipping overrides" description="Custom flat rate and free shipping threshold" className="rv-home-section rv-home-section--shipping">
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

            </div>

            <aside className="rv-stack rv-home-preview-rail">
              <Card title="Preview" description="Hero and owner copy as visitors will read it" className="rv-home-section rv-home-preview-card">
                <div className="rv-content-preview">
                  {(hero?.imageUrl || form.heroImage) ? (
                    <img className="rv-content-preview__image" src={hero?.imageUrl || form.heroImage} alt="" />
                  ) : null}
                  <div className="rv-content-preview__eyebrow">Home hero</div>
                  <h2 className="rv-content-preview__title">{hero?.en.title || form.heroTitle || "Hero title"}</h2>
                  <p className="rv-content-preview__subtitle">{hero?.en.description || form.heroSubtitle || "Hero subtitle"}</p>
                  <div className="rv-content-preview__owner">
                    <div className="rv-content-preview__owner-name">{form.ownerName || "Owner name"}</div>
                    {form.ownerRole ? <div className="rv-content-preview__owner-role">{form.ownerRole}</div> : null}
                    <p className="rv-content-preview__owner-bio">{form.ownerBio || "Owner bio"}</p>
                    {form.ownerCtaLabel ? <span className="rv-content-preview__cta">{form.ownerCtaLabel}</span> : null}
                  </div>
                </div>
              </Card>
            </aside>
          </div>
        ) : null}
      </div>
    </>
  );
}
