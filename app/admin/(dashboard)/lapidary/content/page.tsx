"use client";

import { LapidaryDomeSettings } from "@/components/admin/lapidary-dome-settings";
import { LapidaryServicePricingSettings } from "@/components/admin/lapidary-service-pricing";
import { useEffect, useState } from "react";
import { apiFetch, errorMessage, useApi } from "@/components/admin/api";
import { MediaPicker } from "@/components/admin/media";
import { toast } from "@/components/admin/toast";
import { Badge, Button, Card, Field, Loading, Modal, PageHeader, Select, Switch, TextArea, TextInput } from "@/components/admin/ui";
import { DEFAULT_LAPIDARY_PROCESS_PRESENTATION, type LapidaryProcessPresentation } from "@/lib/lapidary-process";
import type { LapidaryArtistsPresentation } from "@/lib/storefront";

type ArtistImage = { url: string; altEn: string; altId: string; captionEn: string; captionId: string };
type Artist = { id: string; slug: string; name: string; role: string; roleId: string | null; signatureStyle: string | null; signatureStyleId: string | null; location: string | null; bio: string; bioId: string | null; experienceEn: string | null; experienceId: string | null; specialties: string[]; stoneExperienceEn: string[]; stoneExperienceId: string[]; imageUrl: string | null; imageAltEn: string | null; imageAltId: string | null; imagePosition: "left" | "center" | "right"; portfolioImages: ArtistImage[]; isPublished: boolean; sortOrder: number };
type StudioImage = { url: string; altEn: string; altId: string; captionEn: string; captionId: string };
type StudioPresentation = { titleEn: string; titleId: string; introEn: string; introId: string; galleryTitleEn: string; galleryTitleId: string; eyebrowEn: string; eyebrowId: string; galleryEyebrowEn: string; galleryEyebrowId: string; ctaLabelEn: string; ctaLabelId: string; approachTitleEn: string; approachTitleId: string; approachEyebrowEn: string; approachEyebrowId: string; approachPointsEn: string[]; approachPointsId: string[]; photoCountLabelEn: string; photoCountLabelId: string; backLabelEn: string; backLabelId: string; ctaTarget: "customOrder" | "contact"; heroImagePosition: "left" | "center" | "right"; metaTitleEn: string; metaTitleId: string; metaDescriptionEn: string; metaDescriptionId: string; visualStyle: "mineral" | "forest" | "quartz"; motionEnabled: boolean };
type LapidaryContent = { studioHeroImage: string; studioImages: StudioImage[]; studioPresentation: StudioPresentation; processPresentation: LapidaryProcessPresentation; artistsPresentation: LapidaryArtistsPresentation; artists: Artist[] };
const defaultStudioPresentation: StudioPresentation = { titleEn: "The work, up close.", titleId: "Melihat proses dari dekat.", introEn: "A considered look at the tools, hands, and decisions that shape natural stone in the RENDI VIRGO lapidary studio.", introId: "Melihat lebih dekat alat, tangan, dan keputusan yang membentuk batu alam di studio lapidary RENDI VIRGO.", galleryTitleEn: "Inside the studio", galleryTitleId: "Suasana studio", eyebrowEn: "THE WORKROOM · RENDI VIRGO", eyebrowId: "RUANG KERJA · RENDI VIRGO", galleryEyebrowEn: "A LOOK INSIDE", galleryEyebrowId: "DARI RUANG KERJA", ctaLabelEn: "Start a custom request", ctaLabelId: "Mulai permintaan custom", approachTitleEn: "A material-first practice", approachTitleId: "Bekerja dengan memahami material", approachEyebrowEn: "OUR APPROACH", approachEyebrowId: "PENDEKATAN KAMI", approachPointsEn: ["Read the material before choosing a cut", "Discuss risks and natural inclusions openly", "Agree on scope and finish before work begins"], approachPointsId: ["Memahami material sebelum menentukan bentuk", "Membahas risiko dan inklusi alami secara terbuka", "Menyepakati lingkup dan hasil akhir sebelum pengerjaan"], photoCountLabelEn: "STUDIO VIEWS", photoCountLabelId: "SUASANA STUDIO", backLabelEn: "Lapidary", backLabelId: "Lapidary", ctaTarget: "customOrder", heroImagePosition: "center", metaTitleEn: "Lapidary Studio — RENDI VIRGO", metaTitleId: "Studio Lapidary — RENDI VIRGO", metaDescriptionEn: "Learn how the RENDI VIRGO studio assesses, shapes, and finishes natural stones.", metaDescriptionId: "Kenali pendekatan studio RENDI VIRGO dalam menilai, membentuk, dan memoles batu alam.", visualStyle: "mineral", motionEnabled: true };
const defaultStudioHeroImage = "/images/lapidary/studio/studio-hero.jpg";
const defaultArtistsPresentation: LapidaryArtistsPresentation = { eyebrowEn: "THE PEOPLE BEHIND THE CRAFT", eyebrowId: "PARA PENGRAJIN DI BALIK KARYA", titleEn: "One craft. Distinct ways of seeing stone.", titleId: "Satu keahlian. Cara berbeda memahami batu.", introEn: "Meet the lapidary artists who bring their own point of view to natural material, from first assessment through the final finish.", introId: "Kenali para pengrajin lapidary yang membawa sudut pandang masing-masing pada material alami, dari penilaian awal hingga sentuhan akhir.", capabilityTitleEn: "Every artist, through every stage.", capabilityTitleId: "Setiap pengrajin menangani seluruh tahap.", capabilityBodyEn: "Our artists can guide a commission through material assessment, planning, shaping, cutting, polishing, and final review. Their individual character comes from the styles they favor and the stones they know well.", capabilityBodyId: "Setiap pengrajin dapat menangani pesanan dari penilaian material, perencanaan, pembentukan, pemotongan, pemolesan, hingga pemeriksaan akhir. Karakter masing-masing terlihat dari gaya yang disukai dan jenis batu yang mereka kenal.", emptyTitleEn: "Artist profiles are being prepared.", emptyTitleId: "Profil pengrajin sedang disiapkan.", emptyBodyEn: "Contact our studio with your project brief. We will help you find the right approach for your stone.", emptyBodyId: "Hubungi studio kami dengan brief proyek Anda. Kami akan membantu menentukan pendekatan yang sesuai untuk batu Anda.", ctaLabelEn: "Talk to the studio", ctaLabelId: "Hubungi studio", ctaTarget: "contact", detailCtaTarget: "customOrder", heroImage: defaultStudioHeroImage, heroAltEn: "Lapidary workbench in the RENDI VIRGO studio", heroAltId: "Meja kerja lapidary di studio RENDI VIRGO", heroImagePosition: "center", metaTitleEn: "Lapidary Artists — RENDI VIRGO", metaTitleId: "Pengrajin Lapidary — RENDI VIRGO", metaDescriptionEn: "Meet the RENDI VIRGO lapidary artists, their individual styles, and the natural stones they know well.", metaDescriptionId: "Kenali pengrajin lapidary RENDI VIRGO, gaya masing-masing, dan jenis batu alam yang mereka kenal.", visualStyle: "mineral", motionEnabled: true };
function createStudioImage(url: string): StudioImage {
  const basename = url.split("/").pop() ?? "studio photograph";
  let filename = basename;
  try { filename = decodeURIComponent(basename); } catch { /* Keep the original filename when it contains an invalid escape. */ }
  filename = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 130);
  return { url, altEn: `Lapidary studio: ${filename}`, altId: `Studio lapidary: ${filename}`, captionEn: "", captionId: "" };
}
const emptyArtist = { name: "", slug: "", signatureStyle: "", signatureStyleId: "", location: "", bio: "", bioId: "", experienceEn: "", experienceId: "", stoneExperienceEn: "", stoneExperienceId: "", imageUrl: "", imageAltEn: "", imageAltId: "", imagePosition: "center" as Artist["imagePosition"], portfolioImages: [] as ArtistImage[], isPublished: false, sortOrder: "0" };

export default function AdminLapidaryContentPage() {
  const [activeSection, setActiveSection] = useState("process");
  const state = useApi<LapidaryContent>("/api/admin/lapidary/content");
  const [studioHeroImage, setStudioHeroImage] = useState(defaultStudioHeroImage);
  const [studioImages, setStudioImages] = useState<StudioImage[]>([]);
  const [studioPresentation, setStudioPresentation] = useState<StudioPresentation>(defaultStudioPresentation);
  const [processPresentation, setProcessPresentation] = useState<LapidaryProcessPresentation>(DEFAULT_LAPIDARY_PROCESS_PRESENTATION);
  const [artistsPresentation, setArtistsPresentation] = useState<LapidaryArtistsPresentation>(defaultArtistsPresentation);
  const [savingArtistsPresentation, setSavingArtistsPresentation] = useState(false);
  const [artistsPresentationError, setArtistsPresentationError] = useState("");
  const [artistsHeroUploading, setArtistsHeroUploading] = useState(false);
  const [artistPortfolioUploading, setArtistPortfolioUploading] = useState(false);
  const [artistPortraitUploading, setArtistPortraitUploading] = useState(false);
  const [savingStudio, setSavingStudio] = useState(false);
  const [savingProcess, setSavingProcess] = useState(false);
  const [processUploading, setProcessUploading] = useState(false);
  const [processError, setProcessError] = useState("");
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [studioError, setStudioError] = useState("");
  const [artistOpen, setArtistOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyArtist);
  const [savingArtist, setSavingArtist] = useState(false);
  const [artistError, setArtistError] = useState("");

  useEffect(() => {
    if (!state.data) return;
    setStudioHeroImage(state.data.studioHeroImage || defaultStudioHeroImage);
    setStudioImages(state.data.studioImages);
    setStudioPresentation({ ...defaultStudioPresentation, ...state.data.studioPresentation });
    setProcessPresentation(state.data.processPresentation ?? DEFAULT_LAPIDARY_PROCESS_PRESENTATION);
    setArtistsPresentation({ ...defaultArtistsPresentation, ...state.data.artistsPresentation });
  }, [state.data]);

  function updateStudioPresentation<K extends keyof StudioPresentation>(key: K, value: StudioPresentation[K]) {
    setStudioPresentation((current) => ({ ...current, [key]: value }));
  }

  function updateProcessPresentation<K extends keyof LapidaryProcessPresentation>(key: K, value: LapidaryProcessPresentation[K]) {
    setProcessPresentation((current) => ({ ...current, [key]: value }));
  }

  function updateArtistsPresentation<K extends keyof LapidaryArtistsPresentation>(key: K, value: LapidaryArtistsPresentation[K]) {
    setArtistsPresentation((current) => ({ ...current, [key]: value }));
  }

  function updateProcessPhase(index: number, key: "titleEn" | "titleId" | "introEn" | "introId", value: string) {
    setProcessPresentation((current) => ({ ...current, phases: current.phases.map((phase, phaseIndex) => phaseIndex === index ? { ...phase, [key]: value } : phase) }));
  }

  function updateProcessStep(phaseIndex: number, stepIndex: number, key: "titleEn" | "titleId" | "bodyEn" | "bodyId", value: string) {
    setProcessPresentation((current) => ({ ...current, phases: current.phases.map((phase, currentPhaseIndex) => currentPhaseIndex === phaseIndex ? { ...phase, steps: phase.steps.map((step, currentStepIndex) => currentStepIndex === stepIndex ? { ...step, [key]: value } : step) } : phase) }));
  }

  function editArtist(artist?: Artist) {
    setEditing(artist?.id ?? null); setArtistError("");
    setForm(artist ? { name: artist.name, slug: artist.slug, signatureStyle: artist.signatureStyle ?? "", signatureStyleId: artist.signatureStyleId ?? "", location: artist.location ?? "", bio: artist.bio, bioId: artist.bioId ?? "", experienceEn: artist.experienceEn ?? "", experienceId: artist.experienceId ?? "", stoneExperienceEn: artist.stoneExperienceEn.join("\n"), stoneExperienceId: artist.stoneExperienceId.join("\n"), imageUrl: artist.imageUrl ?? "", imageAltEn: artist.imageAltEn ?? "", imageAltId: artist.imageAltId ?? "", imagePosition: artist.imagePosition ?? "center", portfolioImages: Array.isArray(artist.portfolioImages) ? artist.portfolioImages : [], isPublished: artist.isPublished, sortOrder: String(artist.sortOrder) } : { ...emptyArtist });
    setArtistOpen(true);
  }

  const studioReady = Boolean(state.data) && !state.loading && !state.error;
  const studioImageCountValid = studioImages.length >= 11 && studioImages.length <= 24;
  const studioAltTextValid = studioImages.every((image) => image.altEn.trim().length >= 2 && image.altEn.length <= 180 && image.altId.trim().length >= 2 && image.altId.length <= 180);
  const studioImagesUnique = new Set(studioImages.map((image) => image.url)).size === studioImages.length;
  const heroImageUnique = Boolean(studioHeroImage) && studioImages.every((image) => image.url !== studioHeroImage);
  const canSaveStudio = studioReady && !savingStudio && !galleryUploading && !heroUploading && studioImageCountValid && studioAltTextValid && studioImagesUnique && heroImageUnique;

  function updateStudioImageUrls(urls: string[]) {
    setStudioImages((current) => urls.map((url) => current.find((image) => image.url === url) ?? createStudioImage(url)));
  }

  function updateStudioImage(index: number, key: "altEn" | "altId" | "captionEn" | "captionId", value: string) {
    setStudioImages((current) => current.map((image, imageIndex) => imageIndex === index ? { ...image, [key]: value } : image));
  }

  async function saveStudio() {
    if (!canSaveStudio) return;
    setSavingStudio(true); setStudioError("");
    try {
      await apiFetch("/api/admin/lapidary/content/studio", { method: "PATCH", json: { heroImage: studioHeroImage, images: studioImages, ...studioPresentation } });
      toast.success("Studio presentation saved"); state.refresh();
    } catch (error) { setStudioError(errorMessage(error)); }
    finally { setSavingStudio(false); }
  }

  async function saveArtistsPage() {
    if (!state.data || savingArtistsPresentation || artistsHeroUploading) return;
    setSavingArtistsPresentation(true); setArtistsPresentationError("");
    try {
      await apiFetch("/api/admin/lapidary/content/artists/presentation", { method: "PATCH", json: artistsPresentation });
      toast.success("Artists page saved"); state.refresh();
    } catch (error) { setArtistsPresentationError(errorMessage(error)); }
    finally { setSavingArtistsPresentation(false); }
  }

  function updateArtistPortfolio(urls: string[]) {
    setForm((current) => ({ ...current, portfolioImages: urls.map((url) => current.portfolioImages.find((image) => image.url === url) ?? createStudioImage(url)) }));
  }

  function updateArtistPortfolioImage(index: number, key: keyof Omit<ArtistImage, "url">, value: string) {
    setForm((current) => ({ ...current, portfolioImages: current.portfolioImages.map((image, imageIndex) => imageIndex === index ? { ...image, [key]: value } : image) }));
  }

  const processReady = Boolean(state.data) && !state.loading && !state.error;
  const processStructureValid = processPresentation.phases.length === 3 && processPresentation.phases.every((phase) => phase.steps.length === 5);
  const processTextValid = [processPresentation.eyebrowEn, processPresentation.eyebrowId, processPresentation.phaseLabelEn, processPresentation.phaseLabelId, processPresentation.stepCountLabelEn, processPresentation.stepCountLabelId, processPresentation.expandDetailsLabelEn, processPresentation.expandDetailsLabelId, processPresentation.collapseDetailsLabelEn, processPresentation.collapseDetailsLabelId, processPresentation.titleEn, processPresentation.titleId, processPresentation.introEn, processPresentation.introId, processPresentation.heroAltEn, processPresentation.heroAltId, processPresentation.noteEyebrowEn, processPresentation.noteEyebrowId, processPresentation.noteTitleEn, processPresentation.noteTitleId, processPresentation.noteBodyEn, processPresentation.noteBodyId, processPresentation.ctaLabelEn, processPresentation.ctaLabelId, processPresentation.backLabelEn, processPresentation.backLabelId, processPresentation.contactPromptEn, processPresentation.contactPromptId, processPresentation.contactLabelEn, processPresentation.contactLabelId, processPresentation.metaTitleEn, processPresentation.metaTitleId, processPresentation.metaDescriptionEn, processPresentation.metaDescriptionId, ...processPresentation.phases.flatMap((phase) => [phase.titleEn, phase.titleId, phase.introEn, phase.introId, ...phase.steps.flatMap((step) => [step.titleEn, step.titleId, step.bodyEn, step.bodyId])])].every((value) => value.trim().length > 1);
  const canSaveProcess = processReady && !savingProcess && !processUploading && processStructureValid && processTextValid && Boolean(processPresentation.heroImage.trim());

  async function saveProcess() {
    if (!canSaveProcess) return;
    setSavingProcess(true); setProcessError("");
    try {
      await apiFetch("/api/admin/lapidary/content/process", { method: "PATCH", json: processPresentation });
      toast.success("Lapidary process page saved"); state.refresh();
    } catch (error) { setProcessError(errorMessage(error)); }
    finally { setSavingProcess(false); }
  }

  async function saveArtist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (savingArtist || artistPortfolioUploading || artistPortraitUploading) return;
    setSavingArtist(true); setArtistError("");
    const body = {
      name: form.name.trim(), slug: form.slug.trim(), signatureStyle: form.signatureStyle.trim(), signatureStyleId: form.signatureStyleId.trim(), location: form.location.trim() || null,
      bio: form.bio.trim(), bioId: form.bioId.trim() || null, experienceEn: form.experienceEn.trim() || null, experienceId: form.experienceId.trim() || null,
      stoneExperienceEn: form.stoneExperienceEn.split("\n").map((value) => value.trim()).filter(Boolean), stoneExperienceId: form.stoneExperienceId.split("\n").map((value) => value.trim()).filter(Boolean),
      imageUrl: form.imageUrl.trim() || null, imageAltEn: form.imageAltEn.trim(), imageAltId: form.imageAltId.trim(), imagePosition: form.imagePosition, portfolioImages: form.portfolioImages,
      isPublished: form.isPublished, sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      await apiFetch(editing ? `/api/admin/lapidary/content/artists/${editing}` : "/api/admin/lapidary/content/artists", { method: editing ? "PATCH" : "POST", json: body });
      toast.success(editing ? "Artist profile updated" : "Artist profile created"); setArtistOpen(false); state.refresh();
    } catch (error) { setArtistError(errorMessage(error)); }
    finally { setSavingArtist(false); }
  }

  async function removeArtist(artist: Artist) {
    if (!window.confirm(`Delete ${artist.name}'s profile?`)) return;
    try { await apiFetch(`/api/admin/lapidary/content/artists/${artist.id}`, { method: "DELETE" }); toast.success("Artist profile deleted"); state.refresh(); }
    catch (error) { toast.error(errorMessage(error)); }
  }

  return <>
    <PageHeader title="Lapidary content" subtitle="Manage the public process, studio gallery, and cutter profiles." actions={<Button href="/lapidary">View Lapidary page ↗</Button>} />
    <div className="rv-content rv-lapidary-admin rv-lapidary-content">
      <section className="rv-lapidary-content__intro">
        <div><span className="rv-lapidary-content__eyebrow">THE STUDIO · CONTENT DESK</span><h2>Shape the story of your craft.</h2><p>Manage how customers discover the process, meet the artists, and prepare their custom order.</p></div>
        <div className="rv-lapidary-content__note"><span>EN / ID</span><p>Keep both languages in step.<br />Save each section when your edits are ready.</p></div>
      </section>
      <nav className="rv-lapidary-content__nav" aria-label="Content sections">
        {[{ id: "process", title: "The process", detail: "Phases, steps & page copy" }, { id: "studio", title: "Inside the studio", detail: "Photography & presentation" }, { id: "artists", title: "The artists", detail: "Page story & cutter profiles" }, { id: "custom", title: "Custom orders", detail: "Dome controls & fee estimates" }].map((section) => <button key={section.id} type="button" aria-pressed={activeSection === section.id} aria-controls={`lapidary-panel-${section.id}`} onClick={() => setActiveSection(section.id)}><span>{section.title}</span><small>{section.detail}</small></button>)}
      </nav>
      <div id="lapidary-panel-custom" className="rv-lapidary-content__panel" hidden={activeSection !== "custom"}>
        <div className="rv-lapidary-content__section-intro"><div><span className="rv-lapidary-content__eyebrow">ORDER CONFIGURATION</span><h2>Set the starting point.</h2></div><p>These settings guide the customer request form. Individual project estimates and final invoices are managed in Lapidary requests.</p></div>
        <LapidaryDomeSettings />
        <LapidaryServicePricingSettings />
      </div>
      <div id="lapidary-panel-process" className="rv-lapidary-content__panel" hidden={activeSection !== "process"}>
      <Card title="15-step process page" description="Edit all public copy in English and Bahasa Indonesia, manage the hero image, and choose the visual treatment for the three process phases." actions={<Button href="/lapidary/process">Preview process page ↗</Button>}>
        <div className="rv-stack">
          {state.loading && !state.data ? <Loading /> : null}
          {state.error ? <p className="rv-error-text" role="alert">Process settings could not be loaded. {state.error} <Button onClick={state.refresh}>Try again</Button></p> : null}
          {state.data ? <fieldset className="rv-lapidary-admin__studio-fields" disabled={!processReady || savingProcess}>
            <div className="rv-stack">
              <div className="rv-lapidary-admin__section-heading"><h3>Hero and appearance</h3><p className="rv-hint">The process always contains three phases and fifteen steps. Choose a hero photo, a layout, and a restrained color treatment.</p></div>
              <MediaPicker value={processPresentation.heroImage ? [processPresentation.heroImage] : []} onChange={(urls) => updateProcessPresentation("heroImage", urls[0] ?? "")} folder="lapidary" multiple={false} label="Process hero photograph" onBusyChange={setProcessUploading} />
              <div className="rv-lapidary-admin__edit-grid">
                <Field label="Hero image alt text (English)"><TextInput required maxLength={180} value={processPresentation.heroAltEn} onChange={(value) => updateProcessPresentation("heroAltEn", value)} /></Field>
                <Field label="Hero image alt text (Bahasa Indonesia)"><TextInput required maxLength={180} value={processPresentation.heroAltId} onChange={(value) => updateProcessPresentation("heroAltId", value)} /></Field>
                <Field label="Hero image focus"><Select value={processPresentation.heroImagePosition} onChange={(value) => updateProcessPresentation("heroImagePosition", value as LapidaryProcessPresentation["heroImagePosition"])} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} /></Field>
                <Field label="Color treatment"><Select value={processPresentation.visualStyle} onChange={(value) => updateProcessPresentation("visualStyle", value as LapidaryProcessPresentation["visualStyle"])} options={[{ value: "mineral", label: "Mineral / bronze" }, { value: "forest", label: "Forest / sage" }, { value: "quartz", label: "Quartz / stone" }]} /></Field>
                <Field label="Step layout"><Select value={processPresentation.layout} onChange={(value) => updateProcessPresentation("layout", value as LapidaryProcessPresentation["layout"])} options={[{ value: "timeline", label: "Connected timeline" }, { value: "cards", label: "Editorial cards" }]} /></Field>
              </div>
              <Switch checked={processPresentation.motionEnabled} onChange={(value) => updateProcessPresentation("motionEnabled", value)} label="Enable subtle animation on the Process page" />

              <div className="rv-lapidary-admin__section-heading"><h3>Page introduction</h3><p className="rv-hint">This copy appears above the process phases.</p></div>
              <div className="rv-lapidary-admin__edit-grid">
                <Field label="Eyebrow (English)"><TextInput required maxLength={100} value={processPresentation.eyebrowEn} onChange={(value) => updateProcessPresentation("eyebrowEn", value)} /></Field>
                <Field label="Eyebrow (Bahasa Indonesia)"><TextInput required maxLength={100} value={processPresentation.eyebrowId} onChange={(value) => updateProcessPresentation("eyebrowId", value)} /></Field>
                <Field label="Phase label (English)"><TextInput required maxLength={80} value={processPresentation.phaseLabelEn} onChange={(value) => updateProcessPresentation("phaseLabelEn", value)} /></Field>
                <Field label="Phase label (Bahasa Indonesia)"><TextInput required maxLength={80} value={processPresentation.phaseLabelId} onChange={(value) => updateProcessPresentation("phaseLabelId", value)} /></Field>
                <Field label="Step count label (English)"><TextInput required maxLength={100} value={processPresentation.stepCountLabelEn} onChange={(value) => updateProcessPresentation("stepCountLabelEn", value)} /></Field>
                <Field label="Step count label (Bahasa Indonesia)"><TextInput required maxLength={100} value={processPresentation.stepCountLabelId} onChange={(value) => updateProcessPresentation("stepCountLabelId", value)} /></Field>
                <Field label="Heading (English)"><TextInput required maxLength={160} value={processPresentation.titleEn} onChange={(value) => updateProcessPresentation("titleEn", value)} /></Field>
                <Field label="Heading (Bahasa Indonesia)"><TextInput required maxLength={160} value={processPresentation.titleId} onChange={(value) => updateProcessPresentation("titleId", value)} /></Field>
                <Field label="Introduction (English)"><TextArea required rows={3} maxLength={1200} value={processPresentation.introEn} onChange={(value) => updateProcessPresentation("introEn", value)} /></Field>
                <Field label="Introduction (Bahasa Indonesia)"><TextArea required rows={3} maxLength={1200} value={processPresentation.introId} onChange={(value) => updateProcessPresentation("introId", value)} /></Field>
              </div>

              <div className="rv-lapidary-admin__section-heading"><h3>Expandable step descriptions</h3><p className="rv-hint">Set the labels visitors use to open or close long step explanations.</p></div>
              <div className="rv-lapidary-admin__edit-grid">
                <Field label="Open details (English)"><TextInput required maxLength={80} value={processPresentation.expandDetailsLabelEn} onChange={(value) => updateProcessPresentation("expandDetailsLabelEn", value)} /></Field>
                <Field label="Open details (Bahasa Indonesia)"><TextInput required maxLength={80} value={processPresentation.expandDetailsLabelId} onChange={(value) => updateProcessPresentation("expandDetailsLabelId", value)} /></Field>
                <Field label="Close details (English)"><TextInput required maxLength={80} value={processPresentation.collapseDetailsLabelEn} onChange={(value) => updateProcessPresentation("collapseDetailsLabelEn", value)} /></Field>
                <Field label="Close details (Bahasa Indonesia)"><TextInput required maxLength={80} value={processPresentation.collapseDetailsLabelId} onChange={(value) => updateProcessPresentation("collapseDetailsLabelId", value)} /></Field>
              </div>

              <div className="rv-lapidary-admin__section-heading"><h3>Three phases · fifteen steps</h3><p className="rv-hint">Edit the phase heading and introduction, then expand each of its five steps to update the title and explanation in both languages.</p></div>
              <div className="rv-lapidary-admin__process-phases">
                {processPresentation.phases.map((phase, phaseIndex) => <details className="rv-lapidary-admin__process-phase" key={`phase-edit-${phaseIndex}`}>
                  <summary><span>PHASE 0{phaseIndex + 1}</span>{phase.titleEn} · {phase.steps.length} steps</summary>
                  <div className="rv-stack">
                    <div className="rv-lapidary-admin__edit-grid">
                      <Field label="Phase title (English)"><TextInput required maxLength={120} value={phase.titleEn} onChange={(value) => updateProcessPhase(phaseIndex, "titleEn", value)} /></Field>
                      <Field label="Phase title (Bahasa Indonesia)"><TextInput required maxLength={120} value={phase.titleId} onChange={(value) => updateProcessPhase(phaseIndex, "titleId", value)} /></Field>
                      <Field label="Phase introduction (English)"><TextArea required rows={2} maxLength={500} value={phase.introEn} onChange={(value) => updateProcessPhase(phaseIndex, "introEn", value)} /></Field>
                      <Field label="Phase introduction (Bahasa Indonesia)"><TextArea required rows={2} maxLength={500} value={phase.introId} onChange={(value) => updateProcessPhase(phaseIndex, "introId", value)} /></Field>
                    </div>
                    <div className="rv-lapidary-admin__process-steps">
                      {phase.steps.map((step, stepIndex) => <details key={`step-edit-${phaseIndex}-${stepIndex}`}>
                        <summary>{String(phaseIndex * 5 + stepIndex + 1).padStart(2, "0")} · {step.titleEn}</summary>
                        <div className="rv-lapidary-admin__edit-grid">
                          <Field label="Step title (English)"><TextInput required maxLength={120} value={step.titleEn} onChange={(value) => updateProcessStep(phaseIndex, stepIndex, "titleEn", value)} /></Field>
                          <Field label="Step title (Bahasa Indonesia)"><TextInput required maxLength={120} value={step.titleId} onChange={(value) => updateProcessStep(phaseIndex, stepIndex, "titleId", value)} /></Field>
                          <Field label="Step explanation (English)"><TextArea required rows={3} maxLength={700} value={step.bodyEn} onChange={(value) => updateProcessStep(phaseIndex, stepIndex, "bodyEn", value)} /></Field>
                          <Field label="Step explanation (Bahasa Indonesia)"><TextArea required rows={3} maxLength={700} value={step.bodyId} onChange={(value) => updateProcessStep(phaseIndex, stepIndex, "bodyId", value)} /></Field>
                        </div>
                      </details>)}
                    </div>
                  </div>
                </details>)}
              </div>

              <div className="rv-lapidary-admin__section-heading"><h3>Natural stone note and next action</h3><p className="rv-hint">The note, contact prompt, and project button appear beneath all process steps.</p></div>
              <div className="rv-lapidary-admin__edit-grid">
                <Field label="Note label (English)"><TextInput required maxLength={100} value={processPresentation.noteEyebrowEn} onChange={(value) => updateProcessPresentation("noteEyebrowEn", value)} /></Field>
                <Field label="Note label (Bahasa Indonesia)"><TextInput required maxLength={100} value={processPresentation.noteEyebrowId} onChange={(value) => updateProcessPresentation("noteEyebrowId", value)} /></Field>
                <Field label="Note heading (English)"><TextInput required maxLength={160} value={processPresentation.noteTitleEn} onChange={(value) => updateProcessPresentation("noteTitleEn", value)} /></Field>
                <Field label="Note heading (Bahasa Indonesia)"><TextInput required maxLength={160} value={processPresentation.noteTitleId} onChange={(value) => updateProcessPresentation("noteTitleId", value)} /></Field>
                <Field label="Note text (English)"><TextArea required rows={3} maxLength={1200} value={processPresentation.noteBodyEn} onChange={(value) => updateProcessPresentation("noteBodyEn", value)} /></Field>
                <Field label="Note text (Bahasa Indonesia)"><TextArea required rows={3} maxLength={1200} value={processPresentation.noteBodyId} onChange={(value) => updateProcessPresentation("noteBodyId", value)} /></Field>
                <Field label="Back link (English)"><TextInput required maxLength={100} value={processPresentation.backLabelEn} onChange={(value) => updateProcessPresentation("backLabelEn", value)} /></Field>
                <Field label="Back link (Bahasa Indonesia)"><TextInput required maxLength={100} value={processPresentation.backLabelId} onChange={(value) => updateProcessPresentation("backLabelId", value)} /></Field>
                <Field label="Contact prompt (English)"><TextInput required maxLength={160} value={processPresentation.contactPromptEn} onChange={(value) => updateProcessPresentation("contactPromptEn", value)} /></Field>
                <Field label="Contact prompt (Bahasa Indonesia)"><TextInput required maxLength={160} value={processPresentation.contactPromptId} onChange={(value) => updateProcessPresentation("contactPromptId", value)} /></Field>
                <Field label="Contact link text (English)"><TextInput required maxLength={160} value={processPresentation.contactLabelEn} onChange={(value) => updateProcessPresentation("contactLabelEn", value)} /></Field>
                <Field label="Contact link text (Bahasa Indonesia)"><TextInput required maxLength={160} value={processPresentation.contactLabelId} onChange={(value) => updateProcessPresentation("contactLabelId", value)} /></Field>
                <Field label="Project button (English)"><TextInput required maxLength={160} value={processPresentation.ctaLabelEn} onChange={(value) => updateProcessPresentation("ctaLabelEn", value)} /></Field>
                <Field label="Project button (Bahasa Indonesia)"><TextInput required maxLength={160} value={processPresentation.ctaLabelId} onChange={(value) => updateProcessPresentation("ctaLabelId", value)} /></Field>
                <Field label="Button destination"><Select value={processPresentation.ctaTarget} onChange={(value) => updateProcessPresentation("ctaTarget", value as LapidaryProcessPresentation["ctaTarget"])} options={[{ value: "customOrder", label: "Custom order form" }, { value: "contact", label: "Contact page" }]} /></Field>
              </div>

              <div className="rv-lapidary-admin__section-heading"><h3>Search appearance</h3><p className="rv-hint">Set search result titles and descriptions in both site languages.</p></div>
              <div className="rv-lapidary-admin__edit-grid">
                <Field label="SEO title (English)"><TextInput required maxLength={160} value={processPresentation.metaTitleEn} onChange={(value) => updateProcessPresentation("metaTitleEn", value)} /></Field>
                <Field label="SEO title (Bahasa Indonesia)"><TextInput required maxLength={160} value={processPresentation.metaTitleId} onChange={(value) => updateProcessPresentation("metaTitleId", value)} /></Field>
                <Field label="SEO description (English)"><TextArea required rows={3} maxLength={320} value={processPresentation.metaDescriptionEn} onChange={(value) => updateProcessPresentation("metaDescriptionEn", value)} /></Field>
                <Field label="SEO description (Bahasa Indonesia)"><TextArea required rows={3} maxLength={320} value={processPresentation.metaDescriptionId} onChange={(value) => updateProcessPresentation("metaDescriptionId", value)} /></Field>
              </div>
              <div className="rv-inline rv-lapidary-admin__actions"><span className="rv-hint">{processPresentation.phases.reduce((total, phase) => total + phase.steps.length, 0)} / 15 steps · 3 phases</span><Button variant="primary" disabled={!canSaveProcess} loading={savingProcess || processUploading} onClick={() => void saveProcess()}>Save process page</Button></div>
              {!processStructureValid ? <p className="rv-error-text" role="alert">The process needs exactly 3 phases with 5 steps per phase.</p> : null}
              {processError ? <p className="rv-error-text" role="alert">{processError}</p> : null}
            </div>
          </fieldset> : null}
        </div>
      </Card>
      </div>
      <div id="lapidary-panel-studio" className="rv-lapidary-content__panel" hidden={activeSection !== "studio"}>
      <Card title="Studio gallery & presentation" description="Manage the hero photograph, gallery, bilingual copy, image descriptions, search metadata, and visual treatment shown on the public Studio page.">
        <div className="rv-stack">
          {state.loading && !state.data ? <Loading /> : null}
          {state.error ? <p className="rv-error-text" role="alert">Studio settings could not be loaded. {state.error} <Button onClick={state.refresh}>Try again</Button></p> : null}
          {state.data ? <fieldset className="rv-lapidary-admin__studio-fields" disabled={!studioReady || savingStudio}>
            <div className="rv-stack">
              <div className="rv-lapidary-admin__section-heading"><h3>Hero image</h3><p className="rv-hint">This image is independent from the gallery and will not be counted as a gallery photograph.</p></div>
              <MediaPicker value={studioHeroImage ? [studioHeroImage] : []} onChange={(urls) => setStudioHeroImage(urls[0] ?? "")} folder="lapidary" multiple={false} label="Studio hero photograph" onBusyChange={setHeroUploading} />
              <Field label="Hero image focus"><Select value={studioPresentation.heroImagePosition} onChange={(value) => updateStudioPresentation("heroImagePosition", value as StudioPresentation["heroImagePosition"])} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} /></Field>

              <div className="rv-lapidary-admin__section-heading"><h3>Studio photo gallery</h3><p className="rv-hint">Keep 11–24 photographs. Reorder them with the arrows, then write accurate descriptions for accessibility and captions for visitors.</p></div>
              <MediaPicker value={studioImages.map((image) => image.url)} onChange={updateStudioImageUrls} folder="lapidary" label="Studio photographs" minImages={11} maxImages={24} onBusyChange={setGalleryUploading} />
              <p className={`rv-hint ${studioImageCountValid ? "" : "rv-error-text"}`} role={studioImageCountValid ? undefined : "alert"}>{studioImages.length} / 24 photographs selected · minimum 11</p>
              {!studioImagesUnique ? <p className="rv-error-text" role="alert">Each gallery photograph must be unique.</p> : null}
              {!heroImageUnique ? <p className="rv-error-text" role="alert">Choose a hero photograph that is different from the gallery photos.</p> : null}
              {!studioAltTextValid ? <p className="rv-error-text" role="alert">Every gallery photo needs English and Bahasa Indonesia alt text between 2 and 180 characters.</p> : null}
              <div className="rv-lapidary-admin__photo-details">
                {studioImages.map((image, index) => <details key={`${image.url}-${index}`}>
                  <summary>Photo {String(index + 1).padStart(2, "0")} · {image.captionEn || image.altEn}</summary>
                  <div className="rv-lapidary-admin__edit-grid">
                    <Field label="Alt text (English)" hint="Describe what is visible; used by screen readers."><TextInput required minLength={2} maxLength={180} value={image.altEn} onChange={(value) => updateStudioImage(index, "altEn", value)} /></Field>
                    <Field label="Alt text (Bahasa Indonesia)"><TextInput required minLength={2} maxLength={180} value={image.altId} onChange={(value) => updateStudioImage(index, "altId", value)} /></Field>
                    <Field label="Caption (English, optional)"><TextInput maxLength={160} value={image.captionEn} onChange={(value) => updateStudioImage(index, "captionEn", value)} /></Field>
                    <Field label="Caption (Bahasa Indonesia, optional)"><TextInput maxLength={160} value={image.captionId} onChange={(value) => updateStudioImage(index, "captionId", value)} /></Field>
                  </div>
                </details>)}
              </div>

              <div className="rv-lapidary-admin__section-heading"><h3>Page content</h3><p className="rv-hint">All copy below is shown in the matching site language.</p></div>
              <div className="rv-lapidary-admin__edit-grid">
                <Field label="Studio title (English)"><TextInput maxLength={160} value={studioPresentation.titleEn} onChange={(value) => updateStudioPresentation("titleEn", value)} /></Field>
                <Field label="Studio title (Bahasa Indonesia)"><TextInput maxLength={160} value={studioPresentation.titleId} onChange={(value) => updateStudioPresentation("titleId", value)} /></Field>
                <Field label="Introduction (English)"><TextArea rows={4} maxLength={2000} value={studioPresentation.introEn} onChange={(value) => updateStudioPresentation("introEn", value)} /></Field>
                <Field label="Introduction (Bahasa Indonesia)"><TextArea rows={4} maxLength={2000} value={studioPresentation.introId} onChange={(value) => updateStudioPresentation("introId", value)} /></Field>
                <Field label="Hero label (English)"><TextInput maxLength={100} value={studioPresentation.eyebrowEn} onChange={(value) => updateStudioPresentation("eyebrowEn", value)} /></Field>
                <Field label="Hero label (Bahasa Indonesia)"><TextInput maxLength={100} value={studioPresentation.eyebrowId} onChange={(value) => updateStudioPresentation("eyebrowId", value)} /></Field>
                <Field label="Back link (English)"><TextInput maxLength={100} value={studioPresentation.backLabelEn} onChange={(value) => updateStudioPresentation("backLabelEn", value)} /></Field>
                <Field label="Back link (Bahasa Indonesia)"><TextInput maxLength={100} value={studioPresentation.backLabelId} onChange={(value) => updateStudioPresentation("backLabelId", value)} /></Field>
                <Field label="Gallery label (English)"><TextInput maxLength={100} value={studioPresentation.galleryEyebrowEn} onChange={(value) => updateStudioPresentation("galleryEyebrowEn", value)} /></Field>
                <Field label="Gallery label (Bahasa Indonesia)"><TextInput maxLength={100} value={studioPresentation.galleryEyebrowId} onChange={(value) => updateStudioPresentation("galleryEyebrowId", value)} /></Field>
                <Field label="Gallery heading (English)"><TextInput maxLength={160} value={studioPresentation.galleryTitleEn} onChange={(value) => updateStudioPresentation("galleryTitleEn", value)} /></Field>
                <Field label="Gallery heading (Bahasa Indonesia)"><TextInput maxLength={160} value={studioPresentation.galleryTitleId} onChange={(value) => updateStudioPresentation("galleryTitleId", value)} /></Field>
                <Field label="Custom order button (English)"><TextInput maxLength={160} value={studioPresentation.ctaLabelEn} onChange={(value) => updateStudioPresentation("ctaLabelEn", value)} /></Field>
                <Field label="Custom order button (Bahasa Indonesia)"><TextInput maxLength={160} value={studioPresentation.ctaLabelId} onChange={(value) => updateStudioPresentation("ctaLabelId", value)} /></Field>
                <Field label="Button destination"><Select value={studioPresentation.ctaTarget} onChange={(value) => updateStudioPresentation("ctaTarget", value as StudioPresentation["ctaTarget"])} options={[{ value: "customOrder", label: "Custom order form" }, { value: "contact", label: "Contact page" }]} /></Field>
                <Field label="Photo count label (English)"><TextInput maxLength={100} value={studioPresentation.photoCountLabelEn} onChange={(value) => updateStudioPresentation("photoCountLabelEn", value)} /></Field>
                <Field label="Photo count label (Bahasa Indonesia)"><TextInput maxLength={100} value={studioPresentation.photoCountLabelId} onChange={(value) => updateStudioPresentation("photoCountLabelId", value)} /></Field>
                <Field label="Approach label (English)"><TextInput maxLength={100} value={studioPresentation.approachEyebrowEn} onChange={(value) => updateStudioPresentation("approachEyebrowEn", value)} /></Field>
                <Field label="Approach label (Bahasa Indonesia)"><TextInput maxLength={100} value={studioPresentation.approachEyebrowId} onChange={(value) => updateStudioPresentation("approachEyebrowId", value)} /></Field>
                <Field label="Approach heading (English)"><TextInput maxLength={160} value={studioPresentation.approachTitleEn} onChange={(value) => updateStudioPresentation("approachTitleEn", value)} /></Field>
                <Field label="Approach heading (Bahasa Indonesia)"><TextInput maxLength={160} value={studioPresentation.approachTitleId} onChange={(value) => updateStudioPresentation("approachTitleId", value)} /></Field>
                <Field label="Approach points (English)" hint="One point per line, up to 8 points."><TextArea rows={4} value={studioPresentation.approachPointsEn.join("\n")} onChange={(value) => updateStudioPresentation("approachPointsEn", value.split("\n").slice(0, 8))} /></Field>
                <Field label="Approach points (Bahasa Indonesia)" hint="One point per line, up to 8 points."><TextArea rows={4} value={studioPresentation.approachPointsId.join("\n")} onChange={(value) => updateStudioPresentation("approachPointsId", value.split("\n").slice(0, 8))} /></Field>
              </div>

              <div className="rv-lapidary-admin__section-heading"><h3>Search appearance</h3><p className="rv-hint">These values control the page title and description used by search engines and shared links.</p></div>
              <div className="rv-lapidary-admin__edit-grid">
                <Field label="SEO title (English)"><TextInput maxLength={160} value={studioPresentation.metaTitleEn} onChange={(value) => updateStudioPresentation("metaTitleEn", value)} /></Field>
                <Field label="SEO title (Bahasa Indonesia)"><TextInput maxLength={160} value={studioPresentation.metaTitleId} onChange={(value) => updateStudioPresentation("metaTitleId", value)} /></Field>
                <Field label="SEO description (English)"><TextArea rows={3} maxLength={320} value={studioPresentation.metaDescriptionEn} onChange={(value) => updateStudioPresentation("metaDescriptionEn", value)} /></Field>
                <Field label="SEO description (Bahasa Indonesia)"><TextArea rows={3} maxLength={320} value={studioPresentation.metaDescriptionId} onChange={(value) => updateStudioPresentation("metaDescriptionId", value)} /></Field>
              </div>
              <div className="rv-lapidary-admin__edit-grid">
                <Field label="Visual style"><Select value={studioPresentation.visualStyle} onChange={(value) => updateStudioPresentation("visualStyle", value as StudioPresentation["visualStyle"])} options={[{ value: "mineral", label: "Mineral glow" }, { value: "forest", label: "Forest atmosphere" }, { value: "quartz", label: "Quartz light" }]} /></Field>
              </div>
              <Switch checked={studioPresentation.motionEnabled} onChange={(value) => updateStudioPresentation("motionEnabled", value)} label="Enable subtle visual motion on the Studio page" />
              <div className="rv-inline rv-lapidary-admin__actions"><span className="rv-hint">{studioImages.length} / 24 gallery photographs · hero image set separately</span><Button variant="primary" disabled={!canSaveStudio} loading={savingStudio || galleryUploading || heroUploading} onClick={() => void saveStudio()}>Save studio presentation</Button></div>
              {studioError ? <p className="rv-error-text" role="alert">{studioError}</p> : null}
            </div>
          </fieldset> : null}
        </div>
      </Card>

      </div>
      <div id="lapidary-panel-artists" className="rv-lapidary-content__panel" hidden={activeSection !== "artists"}>
      <Card title="Artists page presentation" description="Edit the page introduction, shared full-process statement, empty state, hero image, search details, and visual treatment in both languages." actions={<Button href="/lapidary/artists">Preview Artists page ↗</Button>}>
        <div className="rv-stack">
          {state.data ? <>
            <div className="rv-lapidary-admin__section-heading"><h3>Hero and visual style</h3><p className="rv-hint">Use a studio image to establish the page atmosphere. Portraits and work photographs are managed in each profile.</p></div>
            <MediaPicker value={artistsPresentation.heroImage ? [artistsPresentation.heroImage] : []} onChange={(urls) => updateArtistsPresentation("heroImage", urls[0] ?? "")} folder="lapidary" multiple={false} label="Artists page hero image" onBusyChange={setArtistsHeroUploading} />
            <div className="rv-lapidary-admin__edit-grid">
              <Field label="Hero image alt text (English)"><TextInput required maxLength={180} value={artistsPresentation.heroAltEn} onChange={(value) => updateArtistsPresentation("heroAltEn", value)} /></Field>
              <Field label="Hero image alt text (Bahasa Indonesia)"><TextInput required maxLength={180} value={artistsPresentation.heroAltId} onChange={(value) => updateArtistsPresentation("heroAltId", value)} /></Field>
              <Field label="Hero image focus"><Select value={artistsPresentation.heroImagePosition} onChange={(value) => updateArtistsPresentation("heroImagePosition", value as LapidaryArtistsPresentation["heroImagePosition"])} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} /></Field>
              <Field label="Visual style"><Select value={artistsPresentation.visualStyle} onChange={(value) => updateArtistsPresentation("visualStyle", value as LapidaryArtistsPresentation["visualStyle"])} options={[{ value: "mineral", label: "Mineral / bronze" }, { value: "forest", label: "Forest / sage" }, { value: "quartz", label: "Quartz / stone" }]} /></Field>
            </div>
            <Switch checked={artistsPresentation.motionEnabled} onChange={(value) => updateArtistsPresentation("motionEnabled", value)} label="Enable subtle motion on the public Artists pages" />
            <div className="rv-lapidary-admin__section-heading"><h3>Page introduction</h3></div>
            <div className="rv-lapidary-admin__edit-grid">
              <Field label="Eyebrow (English)"><TextInput required maxLength={100} value={artistsPresentation.eyebrowEn} onChange={(value) => updateArtistsPresentation("eyebrowEn", value)} /></Field>
              <Field label="Eyebrow (Bahasa Indonesia)"><TextInput required maxLength={100} value={artistsPresentation.eyebrowId} onChange={(value) => updateArtistsPresentation("eyebrowId", value)} /></Field>
              <Field label="Heading (English)"><TextInput required maxLength={160} value={artistsPresentation.titleEn} onChange={(value) => updateArtistsPresentation("titleEn", value)} /></Field>
              <Field label="Heading (Bahasa Indonesia)"><TextInput required maxLength={160} value={artistsPresentation.titleId} onChange={(value) => updateArtistsPresentation("titleId", value)} /></Field>
              <Field label="Introduction (English)"><TextArea required rows={3} maxLength={1200} value={artistsPresentation.introEn} onChange={(value) => updateArtistsPresentation("introEn", value)} /></Field>
              <Field label="Introduction (Bahasa Indonesia)"><TextArea required rows={3} maxLength={1200} value={artistsPresentation.introId} onChange={(value) => updateArtistsPresentation("introId", value)} /></Field>
            </div>
            <div className="rv-lapidary-admin__section-heading"><h3>Shared capability</h3><p className="rv-hint">This statement explains that every artist can handle the full process. Profile differences describe style and stone experience.</p></div>
            <div className="rv-lapidary-admin__edit-grid">
              <Field label="Heading (English)"><TextInput required maxLength={160} value={artistsPresentation.capabilityTitleEn} onChange={(value) => updateArtistsPresentation("capabilityTitleEn", value)} /></Field>
              <Field label="Heading (Bahasa Indonesia)"><TextInput required maxLength={160} value={artistsPresentation.capabilityTitleId} onChange={(value) => updateArtistsPresentation("capabilityTitleId", value)} /></Field>
              <Field label="Description (English)"><TextArea required rows={4} maxLength={1200} value={artistsPresentation.capabilityBodyEn} onChange={(value) => updateArtistsPresentation("capabilityBodyEn", value)} /></Field>
              <Field label="Description (Bahasa Indonesia)"><TextArea required rows={4} maxLength={1200} value={artistsPresentation.capabilityBodyId} onChange={(value) => updateArtistsPresentation("capabilityBodyId", value)} /></Field>
            </div>
            <div className="rv-lapidary-admin__section-heading"><h3>No published profiles</h3><p className="rv-hint">This message appears publicly while every artist profile is still a draft.</p></div>
            <div className="rv-lapidary-admin__edit-grid">
              <Field label="Empty-state heading (English)"><TextInput required maxLength={160} value={artistsPresentation.emptyTitleEn} onChange={(value) => updateArtistsPresentation("emptyTitleEn", value)} /></Field>
              <Field label="Empty-state heading (Bahasa Indonesia)"><TextInput required maxLength={160} value={artistsPresentation.emptyTitleId} onChange={(value) => updateArtistsPresentation("emptyTitleId", value)} /></Field>
              <Field label="Empty-state message (English)"><TextArea required rows={3} maxLength={1200} value={artistsPresentation.emptyBodyEn} onChange={(value) => updateArtistsPresentation("emptyBodyEn", value)} /></Field>
              <Field label="Empty-state message (Bahasa Indonesia)"><TextArea required rows={3} maxLength={1200} value={artistsPresentation.emptyBodyId} onChange={(value) => updateArtistsPresentation("emptyBodyId", value)} /></Field>
              <Field label="Contact button (English)"><TextInput required maxLength={100} value={artistsPresentation.ctaLabelEn} onChange={(value) => updateArtistsPresentation("ctaLabelEn", value)} /></Field>
              <Field label="Contact button (Bahasa Indonesia)"><TextInput required maxLength={100} value={artistsPresentation.ctaLabelId} onChange={(value) => updateArtistsPresentation("ctaLabelId", value)} /></Field>
              <Field label="Empty-state button destination"><Select value={artistsPresentation.ctaTarget} onChange={(value) => updateArtistsPresentation("ctaTarget", value as LapidaryArtistsPresentation["ctaTarget"])} options={[{ value: "contact", label: "Contact page" }, { value: "customOrder", label: "Custom order form" }]} /></Field>
              <Field label="Profile detail button destination"><Select value={artistsPresentation.detailCtaTarget} onChange={(value) => updateArtistsPresentation("detailCtaTarget", value as LapidaryArtistsPresentation["detailCtaTarget"])} options={[{ value: "contact", label: "Contact page" }, { value: "customOrder", label: "Custom order form" }]} /></Field>
            </div>
            <div className="rv-lapidary-admin__section-heading"><h3>Search and shared links</h3></div>
            <div className="rv-lapidary-admin__edit-grid">
              <Field label="SEO title (English)"><TextInput required maxLength={160} value={artistsPresentation.metaTitleEn} onChange={(value) => updateArtistsPresentation("metaTitleEn", value)} /></Field>
              <Field label="SEO title (Bahasa Indonesia)"><TextInput required maxLength={160} value={artistsPresentation.metaTitleId} onChange={(value) => updateArtistsPresentation("metaTitleId", value)} /></Field>
              <Field label="SEO description (English)"><TextArea required rows={3} maxLength={320} value={artistsPresentation.metaDescriptionEn} onChange={(value) => updateArtistsPresentation("metaDescriptionEn", value)} /></Field>
              <Field label="SEO description (Bahasa Indonesia)"><TextArea required rows={3} maxLength={320} value={artistsPresentation.metaDescriptionId} onChange={(value) => updateArtistsPresentation("metaDescriptionId", value)} /></Field>
            </div>
            <div className="rv-inline rv-lapidary-admin__actions"><span className="rv-hint">Page copy and appearance settings are saved together.</span><Button variant="primary" disabled={savingArtistsPresentation || artistsHeroUploading} loading={savingArtistsPresentation || artistsHeroUploading} onClick={() => void saveArtistsPage()}>Save Artists page</Button></div>
            {artistsPresentationError ? <p className="rv-error-text" role="alert">{artistsPresentationError}</p> : null}
          </> : state.loading ? <Loading /> : <p className="rv-hint">Artists page settings could not be loaded. {state.error}</p>}
        </div>
      </Card>

      <Card title="Lapidary artist profiles" description="Each profile covers the full lapidary process. Use signature style and stone experience to explain how artists differ. Publish only verified details and approved photographs." actions={<Button variant="primary" onClick={() => editArtist()}>Add artist profile</Button>}>
        {state.loading && !state.data ? <Loading /> : state.data?.artists.length ? <div className="rv-lapidary-admin__artists">{state.data.artists.map((artist) => <article key={artist.id} className="rv-lapidary-admin__artist">
          <div className="rv-lapidary-admin__artist-photo">{artist.imageUrl ? <img src={artist.imageUrl} alt="" /> : <span>{artist.name.slice(0, 1)}</span>}</div>
          <div className="rv-lapidary-admin__artist-info"><div className="rv-inline"><Badge tone={artist.isPublished ? "green" : "gray"}>{artist.isPublished ? "Published" : "Draft"}</Badge><span className="rv-hint">Order {artist.sortOrder}</span></div><h3>{artist.name}</h3><p>{artist.signatureStyle || "Signature style not set"}{artist.location ? ` · ${artist.location}` : ""}</p><p>{artist.stoneExperienceEn.join(" · ") || "Stone experience not listed"} · {artist.portfolioImages.length} portfolio photos</p></div>
          <div className="rv-lapidary-admin__artist-actions"><Button onClick={() => editArtist(artist)}>Edit</Button><Button variant="danger" onClick={() => void removeArtist(artist)}>Delete</Button></div>
        </article>)}</div> : <p className="rv-hint">No cutter profiles yet. Add a profile using verified information and a photo with permission.</p>}
      </Card>
      </div>
    </div>
    <Modal open={artistOpen} title={editing ? "Edit cutter profile" : "New cutter profile"} onClose={() => !savingArtist && !artistPortfolioUploading && !artistPortraitUploading && setArtistOpen(false)} wide>
      <form className="rv-stack" onSubmit={saveArtist}>
        <p className="rv-hint">The legacy role field is no longer shown publicly. Describe each artist through style and material familiarity rather than one production step.</p>
        <div className="rv-lapidary-admin__edit-grid"><Field label="Name"><TextInput required minLength={2} maxLength={120} value={form.name} onChange={(name) => setForm({ ...form, name })} /></Field><Field label="Profile URL slug"><TextInput maxLength={160} value={form.slug} onChange={(slug) => setForm({ ...form, slug })} placeholder="Generated from name if empty" /></Field><Field label="Signature style (English)"><TextInput maxLength={120} value={form.signatureStyle} onChange={(signatureStyle) => setForm({ ...form, signatureStyle })} placeholder="e.g. Organic freeform" /></Field><Field label="Signature style (Bahasa Indonesia)"><TextInput maxLength={120} value={form.signatureStyleId} onChange={(signatureStyleId) => setForm({ ...form, signatureStyleId })} /></Field><Field label="Location (optional)"><TextInput maxLength={120} value={form.location} onChange={(location) => setForm({ ...form, location })} /></Field><Field label="Display order"><TextInput type="number" min={0} max={100000} value={form.sortOrder} onChange={(sortOrder) => setForm({ ...form, sortOrder })} /></Field></div>
        <Field label="Profile bio (English)"><TextArea required value={form.bio} onChange={(bio) => setForm({ ...form, bio })} rows={5} maxLength={5000} /></Field>
        <Field label="Profile bio (Bahasa Indonesia, optional)"><TextArea value={form.bioId} onChange={(bioId) => setForm({ ...form, bioId })} rows={5} maxLength={5000} /></Field>
        <div className="rv-lapidary-admin__edit-grid"><Field label="Stone experience (English)" hint="One stone type per line, up to 12."><TextArea rows={4} value={form.stoneExperienceEn} onChange={(stoneExperienceEn) => setForm({ ...form, stoneExperienceEn })} placeholder="Moss agate\nJasper" /></Field><Field label="Stone experience (Bahasa Indonesia)" hint="One stone type per line, up to 12."><TextArea rows={4} value={form.stoneExperienceId} onChange={(stoneExperienceId) => setForm({ ...form, stoneExperienceId })} /></Field></div>
        <div className="rv-lapidary-admin__edit-grid"><Field label="Verified experience (English, optional)"><TextArea rows={3} maxLength={5000} value={form.experienceEn} onChange={(experienceEn) => setForm({ ...form, experienceEn })} placeholder="Only include details approved for publication." /></Field><Field label="Verified experience (Bahasa Indonesia, optional)"><TextArea rows={3} maxLength={5000} value={form.experienceId} onChange={(experienceId) => setForm({ ...form, experienceId })} /></Field></div>
        <MediaPicker value={form.imageUrl ? [form.imageUrl] : []} onChange={(images) => setForm({ ...form, imageUrl: images[0] ?? "" })} folder="lapidary" multiple={false} label="Artist portrait" onBusyChange={setArtistPortraitUploading} />
        <div className="rv-lapidary-admin__edit-grid"><Field label="Portrait alt text (English)"><TextInput maxLength={180} value={form.imageAltEn} onChange={(imageAltEn) => setForm({ ...form, imageAltEn })} /></Field><Field label="Portrait alt text (Bahasa Indonesia)"><TextInput maxLength={180} value={form.imageAltId} onChange={(imageAltId) => setForm({ ...form, imageAltId })} /></Field><Field label="Portrait focus"><Select value={form.imagePosition} onChange={(value) => setForm({ ...form, imagePosition: value as Artist["imagePosition"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} /></Field></div>
        <div className="rv-lapidary-admin__section-heading"><h3>Portfolio gallery</h3><p className="rv-hint">Add up to 12 finished pieces or studio photographs. Alt text and optional captions can be edited in both languages.</p></div>
        <MediaPicker value={form.portfolioImages.map((image) => image.url)} onChange={updateArtistPortfolio} folder="lapidary" multiple onBusyChange={setArtistPortfolioUploading} label="Portfolio photographs" />
        {form.portfolioImages.map((image, index) => <details className="rv-lapidary-admin__process-phase" key={`${image.url}-${index}`}><summary>PHOTO {String(index + 1).padStart(2, "0")} · {image.captionEn || image.url.split("/").pop()}</summary><div className="rv-stack"><div className="rv-lapidary-admin__edit-grid"><Field label="Alt text (English)"><TextInput required maxLength={180} value={image.altEn} onChange={(value) => updateArtistPortfolioImage(index, "altEn", value)} /></Field><Field label="Alt text (Bahasa Indonesia)"><TextInput required maxLength={180} value={image.altId} onChange={(value) => updateArtistPortfolioImage(index, "altId", value)} /></Field><Field label="Caption (English)"><TextInput maxLength={160} value={image.captionEn} onChange={(value) => updateArtistPortfolioImage(index, "captionEn", value)} /></Field><Field label="Caption (Bahasa Indonesia)"><TextInput maxLength={160} value={image.captionId} onChange={(value) => updateArtistPortfolioImage(index, "captionId", value)} /></Field></div></div></details>)}
        <Switch checked={form.isPublished} onChange={(isPublished) => setForm({ ...form, isPublished })} label="Publish this cutter profile on the public Artists page" />
        {artistError ? <p className="rv-error-text" role="alert">{artistError}</p> : null}
        <div className="rv-inline rv-lapidary-admin__actions"><Button onClick={() => setArtistOpen(false)} disabled={savingArtist || artistPortfolioUploading || artistPortraitUploading}>Cancel</Button><Button type="submit" variant="primary" disabled={artistPortfolioUploading || artistPortraitUploading} loading={savingArtist || artistPortfolioUploading || artistPortraitUploading}>{editing ? "Save profile" : "Create profile"}</Button></div>
      </form>
    </Modal>
  </>;
}
