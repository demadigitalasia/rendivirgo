"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiFetch, errorMessage, useApi } from "@/components/admin/api";
import { HeroPreview } from "@/components/admin/hero-preview";
import { MediaPicker } from "@/components/admin/media";
import { toast } from "@/components/admin/toast";
import { Button, Card, ConfirmButton, Field, Loading, PageHeader, Select, Switch, TextArea, TextInput } from "@/components/admin/ui";
import { DEFAULT_HERO, heroCopy, type HeroCopy, type HeroDocument, type HeroSlide } from "@/lib/hero-slides";
import "./slides.css";

type ProductOption = { id: string; name: string; nameId?: string; price: string | number; stoneType: string; origin: string; slug: string; category: { slug: string }; status: string; sellOnWeb: boolean };
const targets = [
  { value: "/shop", label: "Shop · Cabochons" }, { value: "/wholesale/finished", label: "Wholesale cabochons" },
  { value: "/wholesale/rough", label: "Rough materials" }, { value: "/lapidary/custom-order", label: "Lapidary · Request a quote" },
  { value: "/lapidary/studio", label: "Lapidary · Studio" }, { value: "/lapidary", label: "Lapidary · Overview" },
  { value: "/about-us", label: "About us" }, { value: "/contact", label: "Contact" }, { value: "/wholesale", label: "Wholesale overview" },
];
const copyFields: Array<{ key: keyof HeroCopy; label: string; limit: number; rows?: number }> = [
  { key: "label", label: "Navigation label", limit: 40 }, { key: "eyebrow", label: "Eyebrow", limit: 100 },
  { key: "title", label: "Heading · new line starts a new display line", limit: 160, rows: 2 },
  { key: "description", label: "Description", limit: 320, rows: 3 }, { key: "ctaLabel", label: "Main button label", limit: 80 },
  { key: "secondaryLabel", label: "Secondary button label (optional)", limit: 80 }, { key: "alt", label: "Image description (alt text)", limit: 250 },
  { key: "cardTitle", label: "Information card heading", limit: 100 }, { key: "cardDetail", label: "Information card detail", limit: 160 },
];
function TargetField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const controlId = useId();
  return <Field label={label} inputId={controlId}><Select id={controlId} ariaLabel={label} value={targets.some(target => target.value === value) ? value : "custom"} options={[{ value: "", label: "None" }, ...targets, { value: "custom", label: "Custom site path or HTTPS URL" }]} onChange={next => onChange(next === "custom" ? "/" : next)} />
    {value && !targets.some(target => target.value === value) ? <TextInput id={`${controlId}-custom`} value={value} onChange={onChange} placeholder="/shop/category or https://…" maxLength={1000} /> : null}
  </Field>;
}
export default function HeroSlidesPage() {
  const state = useApi<HeroDocument>("/api/admin/hero-slides");
  const [document, setDocument] = useState<HeroDocument | null>(null);
  const [selected, setSelected] = useState("");
  const [language, setLanguage] = useState<"en" | "id">("en");
  const [mobile, setMobile] = useState(false);
  const [simulate, setSimulate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const dragged = useRef<string | null>(null);
  const products = useApi<{ items: ProductOption[] }>(`/api/admin/products?pageSize=100&status=Published&search=${encodeURIComponent(debouncedSearch)}`);
  const slide = document?.slides.find(item => item.id === selected) ?? document?.slides[0];
  const selectedProduct = useApi<ProductOption>(slide?.productId ? `/api/admin/products/${slide.productId}` : "", { enabled: Boolean(slide?.productId) });
  const dirty = Boolean(document && state.data && JSON.stringify(document) !== JSON.stringify(state.data));
  const activeCount = document?.slides.filter(item => item.isActive).length ?? 0;

  useEffect(() => {
    if (!state.data) return;
    setDocument(structuredClone(state.data));
    setSelected(current => state.data!.slides.some(item => item.id === current) ? current : state.data!.slides[0]?.id ?? "");
  }, [state.data]);
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(productSearch), 250); return () => clearTimeout(timer); }, [productSearch]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = (value: Partial<HeroSlide>) => setDocument(current => current && ({ ...current, slides: current.slides.map(item => item.id === slide?.id ? { ...item, ...value } : item) }));
  const patchCopy = (key: keyof HeroCopy, value: string) => {
    if (!slide) return;
    const field = language === "en" ? "en" : "idCopy";
    patch({ [field]: { ...slide[field], [key]: value }, translationStatus: "Review" });
  };
  const move = (from: string, to: string) => setDocument(current => {
    if (!current || from === to) return current;
    const slides = [...current.slides];
    const start = slides.findIndex(item => item.id === from), end = slides.findIndex(item => item.id === to);
    if (start < 0 || end < 0) return current;
    const [item] = slides.splice(start, 1); slides.splice(end, 0, item);
    return { ...current, slides };
  });
  const add = (duplicate = false) => {
    const next = structuredClone(duplicate && slide ? slide : DEFAULT_HERO.slides[0]);
    next.id = crypto.randomUUID(); next.isActive = false; next.name = duplicate ? `${next.name} (copy)`.slice(0, 100) : "New slide";
    next.productId = duplicate ? next.productId : "";
    setDocument(current => current && ({ ...current, slides: [...current.slides, next] })); setSelected(next.id); setSimulate(false);
  };
  const publish = async () => {
    if (!document) return;
    if (activeCount < 1 || activeCount > 5) { toast.error("Choose between 1 and 5 active slides"); return; }
    setBusy(true);
    try {
      const result = await apiFetch<HeroDocument>("/api/admin/hero-slides", { method: "PUT", json: document });
      state.setData(result); toast.success("Hero slides saved and published to the home page");
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const productChoices = products.data?.items.filter(item => item.sellOnWeb) ?? [];
  const productList = selectedProduct.data && !productChoices.some(item => item.id === selectedProduct.data!.id) ? [selectedProduct.data, ...productChoices] : productChoices;
  const previewSlides = document?.slides.filter(item => simulate ? item.isActive : item.id === slide?.id).map(item => {
    const product = item.id === slide?.id && selectedProduct.data?.id === item.productId ? selectedProduct.data : productList.find(product => product.id === item.productId);
    return { ...item, isActive: true, product: product && product.status === "Published" && product.sellOnWeb ? { name: product.name, nameId: product.nameId || product.name, price: Number(product.price), detail: [product.stoneType, product.origin].filter(Boolean).join(" · "), href: `/shop/${product.category.slug}/${product.slug}` } : null };
  }) ?? [];

  return <>
    <PageHeader title="Hero Slides" subtitle="Four services, one home page · 1–5 active slides" actions={<div className="rv-inline">
      <Button href="/admin/content/home">Home content</Button>
      {dirty ? <ConfirmButton variant="default" confirmLabel="Discard & reload" title="Discard unsaved changes?" description="Reload the last saved slides and settings." onConfirm={async () => state.refresh()}>Reload</ConfirmButton> : <Button onClick={state.refresh} disabled={busy}>Reload</Button>}
      <Button variant="primary" onClick={publish} loading={busy} disabled={!document || uploading}>Save & publish</Button>
    </div>} />
    <div className="rv-content rv-hero-editor">
      {state.error ? <Card title="Could not load hero slides"><p className="rv-error-text">{state.error}</p><Button onClick={state.refresh}>Try again</Button></Card> : null}
      {!document ? <Loading label="Loading hero slides…" /> : <>
        <div className="rv-hero-editor__notice"><span><strong>{activeCount} / 5 active</strong> · {document.slides.length - activeCount} drafts · {dirty ? "Unsaved changes" : document.version === "initial" ? "Starter slides · publish to save" : "Published"}</span><span>Draft slides stay out of the storefront. Save & publish applies all changes together.</span></div>
        <div className="rv-hero-editor__layout">
          <aside className="rv-stack">
            <Card title="Slide order" description="Drag to reorder, or use the arrow buttons." actions={<Button size="sm" onClick={() => add()} disabled={busy || document.slides.length >= 100}>Add slide</Button>}>
              <div className="rv-hero-list">{document.slides.map((item, index) => <div key={item.id} className={`rv-hero-list__item${item.id === slide?.id ? " is-selected" : ""}`} draggable={!busy}
                onDragStart={() => { dragged.current = item.id; }} onDragEnd={() => { dragged.current = null; }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragged.current) move(dragged.current, item.id); dragged.current = null; }}>
                <button type="button" className="rv-hero-list__select" onClick={() => { setSelected(item.id); setSimulate(false); }} aria-pressed={item.id === slide?.id}>
                  <img src={item.imageUrl || "/images/rendi-virgo-hero-stones.webp"} alt="" /><span><strong>{String(index + 1).padStart(2, "0")} · {item.name}</strong><small>{item.isActive ? "Active" : "Draft"} · ID {item.translationStatus}</small></span>
                </button><div className="rv-hero-list__move"><button type="button" aria-label={`Move ${item.name} up`} disabled={index === 0 || busy} onClick={() => move(item.id, document.slides[index - 1].id)}>↑</button><button type="button" aria-label={`Move ${item.name} down`} disabled={index === document.slides.length - 1 || busy} onClick={() => move(item.id, document.slides[index + 1].id)}>↓</button></div>
              </div>)}</div>
            </Card>
            <Card title="Slideshow settings"><div className="rv-stack">
              <Switch label="Autoplay" checked={document.settings.autoplay} onChange={autoplay => setDocument({ ...document, settings: { ...document.settings, autoplay } })} />
              <Field label="Seconds per slide (6–12)"><TextInput type="number" min={6} max={12} value={document.settings.duration} onChange={duration => setDocument({ ...document, settings: { ...document.settings, duration: Number(duration) } })} /></Field>
              <Field label="Crossfade duration (milliseconds)"><Select value={String(document.settings.transitionMs)} options={[300,500,600,800,1000,1200].map(value => ({ value: String(value), label: `${value} ms` }))} onChange={value => setDocument({ ...document, settings: { ...document.settings, transitionMs: Number(value) } })} /></Field>
              <Field label="Text animation"><Select value={document.settings.textAnimation} options={[{ value: "fade-up", label: "Fade Up · gentle rise" },{ value: "fade", label: "Fade" },{ value: "none", label: "None" }]} onChange={value => setDocument({ ...document, settings: { ...document.settings, textAnimation: value as HeroDocument["settings"]["textAnimation"] } })} /></Field>
              <Switch label="Subtle image zoom" checked={document.settings.imageMotion} onChange={imageMotion => setDocument({ ...document, settings: { ...document.settings, imageMotion } })} />
              <p className="rv-hint">Movement pauses during interaction, outside the viewport, and when the tab is hidden. Reduced motion preferences are respected.</p>
            </div></Card>
          </aside>
          <div className="rv-stack">
            {slide ? <>
              <Card title={slide.name} actions={<div className="rv-inline"><Button size="sm" onClick={() => add(true)} disabled={busy || document.slides.length >= 100}>Duplicate</Button><ConfirmButton size="sm" title="Remove this slide?" description="The slide will be removed when you save and publish." onConfirm={async () => { setDocument({ ...document, slides: document.slides.filter(item => item.id !== slide.id) }); setSelected(document.slides.find(item => item.id !== slide.id)?.id ?? ""); }}>Delete</ConfirmButton></div>}>
                <div className="rv-form-grid"><Field label="Internal name"><TextInput value={slide.name} maxLength={100} onChange={name => patch({ name })} /></Field><div className="rv-field"><span className="rv-label">Visibility</span><Switch label="Active on home page" checked={slide.isActive} disabled={!slide.isActive && activeCount >= 5} onChange={isActive => patch({ isActive })} /></div></div>
              </Card>
              <Card title="Content & translation" actions={<div className="rv-inline"><Button size="sm" ariaPressed={language === "en"} onClick={() => setLanguage("en")}>English</Button><Button size="sm" ariaPressed={language === "id"} onClick={() => setLanguage("id")}>Bahasa Indonesia</Button></div>}><div className="rv-stack">
                <Field label="Indonesian translation status" hint="Ready requires translations for every non-empty English field. Other statuses display the complete English slide."><Select value={slide.translationStatus} options={["Missing","Draft","Review","Ready"].map(value => ({ value, label: value }))} onChange={value => patch({ translationStatus: value as HeroSlide["translationStatus"] })} /></Field>
                {copyFields.filter(field => slide.cardType === "info" || !field.key.startsWith("card")).map(field => <Field key={field.key} label={`${field.label} (${language.toUpperCase()})`}>
                  {field.rows ? <TextArea rows={field.rows} value={(language === "en" ? slide.en : slide.idCopy)[field.key]} onChange={value => patchCopy(field.key, value.slice(0, field.limit))} /> : <TextInput maxLength={field.limit} value={(language === "en" ? slide.en : slide.idCopy)[field.key]} onChange={value => patchCopy(field.key, value)} />}
                </Field>)}
              </div></Card>
              <Card title="Photography & layout"><div className="rv-stack">
                <MediaPicker label="Desktop image" folder="banners" multiple={false} value={slide.imageUrl ? [slide.imageUrl] : []} onChange={urls => patch({ imageUrl: urls[0] || "" })} onBusyChange={setUploading} />
                <MediaPicker label="Mobile image (optional · desktop image is the fallback)" folder="banners" multiple={false} value={slide.mobileImageUrl ? [slide.mobileImageUrl] : []} onChange={urls => patch({ mobileImageUrl: urls[0] || "" })} onBusyChange={setUploading} />
                <div className="rv-form-grid">{(["focalX","focalY","mobileFocalX","mobileFocalY"] as const).map(key => <Field key={key} label={{ focalX: "Desktop focus · horizontal", focalY: "Desktop focus · vertical", mobileFocalX: "Mobile focus · horizontal", mobileFocalY: "Mobile focus · vertical" }[key]}>
                  <input aria-label={key} type="range" min={0} max={1} step={0.01} value={slide[key]} onChange={event => patch({ [key]: Number(event.target.value) })} /><small>{Math.round(slide[key] * 100)}%</small>
                </Field>)}</div>
                <div className="rv-form-grid"><Field label="Dark overlay"><input aria-label="Dark overlay" type="range" min={0.25} max={0.85} step={0.01} value={slide.overlay} onChange={event => patch({ overlay: Number(event.target.value) })} /><small>{Math.round(slide.overlay * 100)}%</small></Field>
                  <Field label="Text position"><Select value={slide.alignment} options={["left","center","right"].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} onChange={value => patch({ alignment: value as HeroSlide["alignment"] })} /></Field></div>
                <p className="rv-hint">Use a wide desktop image with clear space for the text. A separate portrait crop works best on mobile. The information card is hidden on small screens and in the centered layout.</p>
              </div></Card>
              <Card title="Buttons & supporting card"><div className="rv-stack">
                <TargetField label="Main button destination" value={slide.ctaHref} onChange={ctaHref => patch({ ctaHref })} />
                <TargetField label="Secondary button destination" value={slide.secondaryHref} onChange={secondaryHref => patch({ secondaryHref })} />
                <Field label="Supporting card"><Select value={slide.cardType} options={[{ value: "none", label: "No card" },{ value: "product", label: "Selected product · live price" },{ value: "info", label: "Service information" }]} onChange={value => patch({ cardType: value as HeroSlide["cardType"] })} /></Field>
                {slide.cardType === "product" ? <><Field label="Find a published product"><TextInput value={productSearch} onChange={setProductSearch} placeholder="Search product name or SKU…" /></Field><Field label="Featured product"><Select value={slide.productId} options={[{ value: "", label: "Choose a product" },...productList.map(product => ({ value: product.id, label: `${product.name} · $${Number(product.price).toFixed(2)}` }))]} onChange={productId => patch({ productId })} /></Field><p className="rv-hint">The card uses the product's current price and hides automatically if the product is no longer published for the website.</p>{products.error ? <p className="rv-error-text">{products.error}</p> : null}</> : null}
                {slide.cardType === "info" ? <TargetField label="Information card destination" value={slide.cardHref} onChange={cardHref => patch({ cardHref })} /> : null}
              </div></Card>
            </> : null}
          </div>
        </div>
        <Card title="Live preview" description="Preview changes before publishing. Links inside the slide are disabled." actions={<div className="rv-inline"><Button size="sm" ariaPressed={!mobile} onClick={() => setMobile(false)}>Desktop</Button><Button size="sm" ariaPressed={mobile} onClick={() => setMobile(true)}>Mobile</Button><Switch label="Simulate active slides" checked={simulate} onChange={setSimulate} /></div>}>
          {slide && language === "id" && slide.translationStatus !== "Ready" ? <p className="rv-hint">English fallback is shown until the Indonesian translation is marked Ready.</p> : null}
          {previewSlides.length ? <HeroPreview document={{ ...document, slides: previewSlides }} language={language} mobile={mobile} /> : <p className="rv-hint">Activate a slide to preview the slideshow.</p>}
          <p className="rv-hint">Preview language: {language.toUpperCase()} · {simulate ? "All active slides" : slide ? heroCopy(slide, language).label : "No slide selected"}</p>
        </Card>
      </>}
    </div>
  </>;
}
