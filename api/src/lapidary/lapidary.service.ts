import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { publicAppOrigin } from "../common/utils/public-app-origin";
import { access, chmod, mkdir, unlink, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, resolve, sep } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { detectImageType } from "../uploads/image-validation";
import { LapidaryEmailOutboxService } from "./lapidary-email-outbox.service";
import {
  AcceptLapidaryEstimateDto,
  ConfirmLapidaryPaymentDto,
  CreateLapidaryProgressUpdateDto,
  ClaimLapidaryRequestDto,
  CreateLapidaryRequestDto,
  LapidaryRequestItemDto,
  LapidaryRequestQueryDto,
  SaveLapidaryArtistsPresentationDto,
  SaveLapidaryArtistDto,
  SaveLapidaryProcessDto,
  SaveLapidaryStudioDto,
  SaveLapidaryDomeDto,
  SaveLapidaryServicePricingDto,
  SubmitLapidaryInboundShipmentDto,
  UpdateLapidaryRequestDto,
} from "./lapidary.dto";

const STUDIO_IMAGES_KEY = "lapidary.studioImages";
const STUDIO_PRESENTATION_KEY = "lapidary.studioPresentation";
const STUDIO_HERO_IMAGE_KEY = "lapidary.studioHeroImage";
const PROCESS_PRESENTATION_KEY = "lapidary.processPresentation";
const ARTISTS_PRESENTATION_KEY = "lapidary.artistsPresentation";
const SERVICE_PRICING_KEY = "lapidary.servicePricing";
const DEFAULT_STUDIO_HERO_IMAGE = "/images/lapidary/studio/studio-hero.jpg";
const DEFAULT_LAPIDARY_SERVICE_PRICING = { pendantUsd: 4, matchedPairUsd: 6 };
type LapidaryArtistsPresentationValue = Omit<Required<SaveLapidaryArtistsPresentationDto>, "heroImagePosition" | "visualStyle" | "ctaTarget" | "detailCtaTarget"> & {
  heroImagePosition: "left" | "center" | "right";
  visualStyle: "mineral" | "forest" | "quartz";
  ctaTarget: "customOrder" | "contact";
  detailCtaTarget: "customOrder" | "contact";
};
const DEFAULT_STUDIO_IMAGES = [
  { url: "/images/lapidary/studio/studio-overview.jpg", altEn: "Lapidary workshop with stone cutting and polishing equipment", altId: "Studio lapidary dengan alat pemotong dan pemoles batu", captionEn: "The lapidary workroom", captionId: "Ruang kerja lapidary" },
  { url: "/images/lapidary/studio/studio-cutting.jpg", altEn: "Lapidary cutter shaping a natural stone at a saw", altId: "Pengrajin lapidary membentuk batu alam dengan mesin potong", captionEn: "Careful shaping", captionId: "Pembentukan yang cermat" },
  { url: "/images/lapidary/studio/rough-selection.jpg", altEn: "Rough stones examined before a cut is planned", altId: "Batu rough diperiksa sebelum rencana pemotongan", captionEn: "Material selection", captionId: "Pemilihan material" },
  { url: "/images/lapidary/studio/faceting-machine.jpg", altEn: "Faceting machine prepared for precision gemstone cutting", altId: "Mesin faceting yang disiapkan untuk memotong batu permata dengan presisi", captionEn: "Precision cutting", captionId: "Pemotongan presisi" },
  { url: "/images/lapidary/studio/cabochon-polishing.jpg", altEn: "Natural stone cabochon being polished in the studio", altId: "Cabochon batu alam sedang dipoles di studio", captionEn: "Polishing the surface", captionId: "Memoles permukaan" },
  { url: "/images/lapidary/studio/tool-wall.jpg", altEn: "Lapidary hand tools arranged at the studio workbench", altId: "Peralatan lapidary tersusun di meja kerja studio", captionEn: "Tools of the craft", captionId: "Peralatan pengerjaan" },
  { url: "/images/lapidary/studio/studio-shaping-detail.jpg", altEn: "Close view of a stone being shaped by hand", altId: "Tampilan dekat batu yang sedang dibentuk dengan tangan", captionEn: "Shaping by hand", captionId: "Membentuk dengan tangan" },
  { url: "/images/lapidary/studio/stone-assessment.jpg", altEn: "Lapidary artist assessing a stone's natural structure", altId: "Pengrajin lapidary menilai struktur alami batu", captionEn: "Reading the stone", captionId: "Membaca karakter batu" },
  { url: "/images/lapidary/studio/dimension-review.jpg", altEn: "Stone dimensions checked before custom lapidary work", altId: "Dimensi batu diperiksa sebelum pengerjaan lapidary custom", captionEn: "Reviewing dimensions", captionId: "Memeriksa dimensi" },
  { url: "/images/lapidary/studio/studio-stone-review.jpg", altEn: "Finished and rough stones reviewed together at the studio", altId: "Batu hasil pengerjaan dan rough ditinjau bersama di studio", captionEn: "A final material review", captionId: "Peninjauan material akhir" },
  { url: "/images/lapidary/studio/finished-collection.jpg", altEn: "Polished natural stone pieces arranged after studio work", altId: "Batu alam yang telah dipoles dan ditata setelah pengerjaan studio", captionEn: "Finished pieces", captionId: "Batu hasil akhir" },
];

const DEFAULT_ARTISTS_PRESENTATION: LapidaryArtistsPresentationValue = {
  eyebrowEn: "THE PEOPLE BEHIND THE CRAFT",
  eyebrowId: "PARA PENGRAJIN DI BALIK KARYA",
  titleEn: "One craft. Distinct ways of seeing stone.",
  titleId: "Satu keahlian. Cara berbeda memahami batu.",
  introEn: "Meet the lapidary artists who bring their own point of view to natural material, from first assessment through the final finish.",
  introId: "Kenali para pengrajin lapidary yang membawa sudut pandang masing-masing pada material alami, dari penilaian awal hingga sentuhan akhir.",
  capabilityTitleEn: "Every artist, through every stage.",
  capabilityTitleId: "Setiap pengrajin menangani seluruh tahap.",
  capabilityBodyEn: "Our artists can guide a commission through material assessment, planning, shaping, cutting, polishing, and final review. Their individual character comes from the styles they favor and the stones they know well.",
  capabilityBodyId: "Setiap pengrajin dapat menangani pesanan dari penilaian material, perencanaan, pembentukan, pemotongan, pemolesan, hingga pemeriksaan akhir. Karakter masing-masing terlihat dari gaya yang disukai dan jenis batu yang mereka kenal.",
  emptyTitleEn: "Artist profiles are being prepared.",
  emptyTitleId: "Profil pengrajin sedang disiapkan.",
  emptyBodyEn: "Contact our studio with your project brief. We will help you find the right approach for your stone.",
  emptyBodyId: "Hubungi studio kami dengan brief proyek Anda. Kami akan membantu menentukan pendekatan yang sesuai untuk batu Anda.",
  ctaLabelEn: "Talk to the studio",
  ctaLabelId: "Hubungi studio",
  ctaTarget: "contact" as const,
  detailCtaTarget: "customOrder" as const,
  heroImage: "/images/lapidary/studio/studio-hero.jpg",
  heroAltEn: "Lapidary workbench in the RENDI VIRGO studio",
  heroAltId: "Meja kerja lapidary di studio RENDI VIRGO",
  heroImagePosition: "center" as const,
  metaTitleEn: "Lapidary Artists — RENDI VIRGO",
  metaTitleId: "Pengrajin Lapidary — RENDI VIRGO",
  metaDescriptionEn: "Meet the RENDI VIRGO lapidary artists, their individual styles, and the natural stones they know well.",
  metaDescriptionId: "Kenali pengrajin lapidary RENDI VIRGO, gaya masing-masing, dan jenis batu alam yang mereka kenal.",
  visualStyle: "mineral" as const,
  motionEnabled: true,
};

function artistsPresentation(value: unknown): LapidaryArtistsPresentationValue {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result = { ...DEFAULT_ARTISTS_PRESENTATION };
  for (const key of Object.keys(DEFAULT_ARTISTS_PRESENTATION) as Array<keyof typeof DEFAULT_ARTISTS_PRESENTATION>) {
    const candidate = saved[key];
    if (key === "motionEnabled") {
      if (typeof candidate === "boolean") result.motionEnabled = candidate;
    } else if (key === "heroImagePosition") {
      if (candidate === "left" || candidate === "center" || candidate === "right") result.heroImagePosition = candidate;
    } else if (key === "visualStyle") {
      if (candidate === "mineral" || candidate === "forest" || candidate === "quartz") result.visualStyle = candidate;
    } else if (key === "ctaTarget" || key === "detailCtaTarget") {
      if (candidate === "contact" || candidate === "customOrder") result[key] = candidate;
    } else if (typeof candidate === "string" && candidate.trim()) {
      (result as unknown as Record<string, unknown>)[key] = candidate;
    }
  }
  return result;
}
const DEFAULT_STUDIO_PRESENTATION = {
  titleEn: "The work, up close.",
  titleId: "Melihat proses dari dekat.",
  introEn: "A considered look at the tools, hands, and decisions that shape natural stone in the RENDI VIRGO lapidary studio.",
  introId: "Melihat lebih dekat alat, tangan, dan keputusan yang membentuk batu alam di studio lapidary RENDI VIRGO.",
  galleryTitleEn: "Inside the studio",
  galleryTitleId: "Suasana studio",
  eyebrowEn: "THE WORKROOM · RENDI VIRGO",
  eyebrowId: "RUANG KERJA · RENDI VIRGO",
  galleryEyebrowEn: "A LOOK INSIDE",
  galleryEyebrowId: "DARI RUANG KERJA",
  ctaLabelEn: "Start a custom request",
  ctaLabelId: "Mulai permintaan custom",
  approachTitleEn: "A material-first practice",
  approachTitleId: "Bekerja dengan memahami material",
  approachEyebrowEn: "OUR APPROACH",
  approachEyebrowId: "PENDEKATAN KAMI",
  approachPointsEn: ["Read the material before choosing a cut", "Discuss risks and natural inclusions openly", "Agree on scope and finish before work begins"],
  approachPointsId: ["Memahami material sebelum menentukan bentuk", "Membahas risiko dan inklusi alami secara terbuka", "Menyepakati lingkup dan hasil akhir sebelum pengerjaan"],
  photoCountLabelEn: "STUDIO VIEWS",
  photoCountLabelId: "SUASANA STUDIO",
  backLabelEn: "Lapidary",
  backLabelId: "Lapidary",
  ctaTarget: "customOrder" as const,
  heroImagePosition: "center" as const,
  metaTitleEn: "Lapidary Studio — RENDI VIRGO",
  metaTitleId: "Studio Lapidary — RENDI VIRGO",
  metaDescriptionEn: "Learn how the RENDI VIRGO studio assesses, shapes, and finishes natural stones.",
  metaDescriptionId: "Kenali pendekatan studio RENDI VIRGO dalam menilai, membentuk, dan memoles batu alam.",
  visualStyle: "mineral" as const,
  motionEnabled: true,
};

function studioPresentation(value: unknown) {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const style = saved.visualStyle;
  const stringList = (key: string, fallback: string[]) => Array.isArray(saved[key])
    ? (saved[key] as unknown[]).filter((item): item is string => typeof item === "string").slice(0, 8)
    : fallback;
  return {
    titleEn: typeof saved.titleEn === "string" ? saved.titleEn : DEFAULT_STUDIO_PRESENTATION.titleEn,
    titleId: typeof saved.titleId === "string" ? saved.titleId : DEFAULT_STUDIO_PRESENTATION.titleId,
    introEn: typeof saved.introEn === "string" ? saved.introEn : DEFAULT_STUDIO_PRESENTATION.introEn,
    introId: typeof saved.introId === "string" ? saved.introId : DEFAULT_STUDIO_PRESENTATION.introId,
    galleryTitleEn: typeof saved.galleryTitleEn === "string" ? saved.galleryTitleEn : DEFAULT_STUDIO_PRESENTATION.galleryTitleEn,
    galleryTitleId: typeof saved.galleryTitleId === "string" ? saved.galleryTitleId : DEFAULT_STUDIO_PRESENTATION.galleryTitleId,
    eyebrowEn: typeof saved.eyebrowEn === "string" ? saved.eyebrowEn : DEFAULT_STUDIO_PRESENTATION.eyebrowEn,
    eyebrowId: typeof saved.eyebrowId === "string" ? saved.eyebrowId : DEFAULT_STUDIO_PRESENTATION.eyebrowId,
    galleryEyebrowEn: typeof saved.galleryEyebrowEn === "string" ? saved.galleryEyebrowEn : DEFAULT_STUDIO_PRESENTATION.galleryEyebrowEn,
    galleryEyebrowId: typeof saved.galleryEyebrowId === "string" ? saved.galleryEyebrowId : DEFAULT_STUDIO_PRESENTATION.galleryEyebrowId,
    ctaLabelEn: typeof saved.ctaLabelEn === "string" ? saved.ctaLabelEn : DEFAULT_STUDIO_PRESENTATION.ctaLabelEn,
    ctaLabelId: typeof saved.ctaLabelId === "string" ? saved.ctaLabelId : DEFAULT_STUDIO_PRESENTATION.ctaLabelId,
    approachTitleEn: typeof saved.approachTitleEn === "string" ? saved.approachTitleEn : DEFAULT_STUDIO_PRESENTATION.approachTitleEn,
    approachTitleId: typeof saved.approachTitleId === "string" ? saved.approachTitleId : DEFAULT_STUDIO_PRESENTATION.approachTitleId,
    approachEyebrowEn: typeof saved.approachEyebrowEn === "string" ? saved.approachEyebrowEn : DEFAULT_STUDIO_PRESENTATION.approachEyebrowEn,
    approachEyebrowId: typeof saved.approachEyebrowId === "string" ? saved.approachEyebrowId : DEFAULT_STUDIO_PRESENTATION.approachEyebrowId,
    approachPointsEn: stringList("approachPointsEn", DEFAULT_STUDIO_PRESENTATION.approachPointsEn),
    approachPointsId: stringList("approachPointsId", DEFAULT_STUDIO_PRESENTATION.approachPointsId),
    photoCountLabelEn: typeof saved.photoCountLabelEn === "string" ? saved.photoCountLabelEn : DEFAULT_STUDIO_PRESENTATION.photoCountLabelEn,
    photoCountLabelId: typeof saved.photoCountLabelId === "string" ? saved.photoCountLabelId : DEFAULT_STUDIO_PRESENTATION.photoCountLabelId,
    backLabelEn: typeof saved.backLabelEn === "string" ? saved.backLabelEn : DEFAULT_STUDIO_PRESENTATION.backLabelEn,
    backLabelId: typeof saved.backLabelId === "string" ? saved.backLabelId : DEFAULT_STUDIO_PRESENTATION.backLabelId,
    ctaTarget: saved.ctaTarget === "contact" ? "contact" : DEFAULT_STUDIO_PRESENTATION.ctaTarget,
    heroImagePosition: saved.heroImagePosition === "left" || saved.heroImagePosition === "right" ? saved.heroImagePosition : DEFAULT_STUDIO_PRESENTATION.heroImagePosition,
    metaTitleEn: typeof saved.metaTitleEn === "string" && saved.metaTitleEn.trim() ? saved.metaTitleEn : DEFAULT_STUDIO_PRESENTATION.metaTitleEn,
    metaTitleId: typeof saved.metaTitleId === "string" && saved.metaTitleId.trim() ? saved.metaTitleId : DEFAULT_STUDIO_PRESENTATION.metaTitleId,
    metaDescriptionEn: typeof saved.metaDescriptionEn === "string" && saved.metaDescriptionEn.trim() ? saved.metaDescriptionEn : DEFAULT_STUDIO_PRESENTATION.metaDescriptionEn,
    metaDescriptionId: typeof saved.metaDescriptionId === "string" && saved.metaDescriptionId.trim() ? saved.metaDescriptionId : DEFAULT_STUDIO_PRESENTATION.metaDescriptionId,
    visualStyle: style === "forest" || style === "quartz" ? style : DEFAULT_STUDIO_PRESENTATION.visualStyle,
    motionEnabled: saved.motionEnabled !== false,
  };
}

function studioImages(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  const normalized = source.flatMap((item, index) => {
    const url = typeof item === "string" ? item : item && typeof item === "object" && !Array.isArray(item) && "url" in item && typeof item.url === "string" ? item.url : "";
    if (!url) return [];
    const defaults = DEFAULT_STUDIO_IMAGES.find((image) => image.url === url) ?? DEFAULT_STUDIO_IMAGES[index % DEFAULT_STUDIO_IMAGES.length];
    const saved = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
    return [{
      url,
      altEn: typeof saved.altEn === "string" && saved.altEn.trim() ? saved.altEn : defaults.altEn,
      altId: typeof saved.altId === "string" && saved.altId.trim() ? saved.altId : defaults.altId,
      captionEn: typeof saved.captionEn === "string" ? saved.captionEn : defaults.captionEn,
      captionId: typeof saved.captionId === "string" ? saved.captionId : defaults.captionId,
    }];
  });
  const unique = normalized.filter((image, index) => normalized.findIndex((candidate) => candidate.url === image.url) === index).slice(0, 24);
  for (const fallback of DEFAULT_STUDIO_IMAGES) {
    if (unique.length >= 11) break;
    if (!unique.some((image) => image.url === fallback.url)) unique.push(fallback);
  }
  return unique;
}

const DEFAULT_PROCESS_PRESENTATION = {
  eyebrowEn: "FROM FIRST LOOK TO FINAL FORM",
  eyebrowId: "DARI PEMERIKSAAN HINGGA BENTUK AKHIR",
  phaseLabelEn: "PHASE",
  phaseLabelId: "FASE",
  stepCountLabelEn: "STEPS · 3 PHASES",
  stepCountLabelId: "TAHAP · 3 FASE",
  expandDetailsLabelEn: "Read details",
  expandDetailsLabelId: "Lihat detail",
  collapseDetailsLabelEn: "Close details",
  collapseDetailsLabelId: "Tutup detail",
  titleEn: "A careful path through every cut.",
  titleId: "Setiap potongan melalui proses yang cermat.",
  introEn: "Fifteen considered steps guide each commission, from the first material review to the final inspection and handover.",
  introId: "Lima belas tahap terukur memandu setiap pesanan, dari pemeriksaan material pertama hingga pengecekan dan serah terima akhir.",
  heroImage: "/images/lapidary/lapidary-process-hero.png",
  heroAltEn: "A lapidary craftsman polishing a green agate cabochon on a water-fed grinding wheel",
  heroAltId: "Pengrajin lapidary memoles batu akik hijau dengan mesin gerinda berpendingin air",
  heroImagePosition: "center" as const,
  phases: [
    { titleEn: "Understand the material", titleId: "Memahami material", introEn: "We establish what the stone can safely become before work is approved.", introId: "Kami memahami kemungkinan batu sebelum pengerjaan disetujui.", steps: [
      { titleEn: "Receive the brief", titleId: "Menerima brief", bodyEn: "We record your goals, intended use, preferred shape, finish, and timing.", bodyId: "Kami mencatat tujuan, penggunaan, bentuk, hasil akhir, dan waktu yang Anda inginkan." },
      { titleEn: "Confirm material source", titleId: "Memastikan sumber material", bodyEn: "We confirm whether the stone comes from your collection or from RENDI VIRGO stock.", bodyId: "Kami memastikan apakah batu berasal dari koleksi Anda atau dari stok RENDI VIRGO." },
      { titleEn: "Document arrival", titleId: "Mendokumentasikan penerimaan", bodyEn: "Customer supplied material is photographed and its received condition is recorded.", bodyId: "Material milik pelanggan difoto dan kondisi saat diterima dicatat." },
      { titleEn: "Inspect the stone", titleId: "Memeriksa batu", bodyEn: "We examine visible inclusions, fractures, surface condition, and dimensions.", bodyId: "Kami memeriksa inklusi, rekahan, kondisi permukaan, dan dimensi yang terlihat." },
      { titleEn: "Assess feasibility", titleId: "Menilai kelayakan", bodyEn: "The studio considers the requested cut, material behavior, likely yield, and risks.", bodyId: "Studio menilai bentuk yang diminta, karakter material, perkiraan hasil, dan risikonya." },
    ] },
    { titleEn: "Plan and shape", titleId: "Merencanakan dan membentuk", introEn: "Once the scope is approved, the cutter prepares and works to the agreed plan.", introId: "Setelah lingkup disetujui, pengrajin menyiapkan dan mengerjakan batu sesuai rencana.", steps: [
      { titleEn: "Define the scope", titleId: "Menetapkan lingkup", bodyEn: "We agree on dimensions, quantity, tolerances, finish, and any practical limitations.", bodyId: "Kami menyepakati dimensi, jumlah, toleransi, hasil akhir, dan batas pengerjaan." },
      { titleEn: "Prepare the written quote", titleId: "Menyiapkan penawaran tertulis", bodyEn: "The quote sets out the price and estimated studio time before any cutting begins.", bodyId: "Penawaran mencantumkan harga dan perkiraan waktu studio sebelum pemotongan dimulai." },
      { titleEn: "Receive approval", titleId: "Menerima persetujuan", bodyEn: "Work begins only after you approve the scope, price, and material arrangements.", bodyId: "Pengerjaan dimulai setelah Anda menyetujui lingkup, harga, dan pengaturan material." },
      { titleEn: "Mark the orientation", titleId: "Menentukan orientasi", bodyEn: "The cutter maps the intended face and direction around the stone's natural features.", bodyId: "Pengrajin menentukan sisi dan arah potongan berdasarkan karakter alami batu." },
      { titleEn: "Prepare the material", titleId: "Menyiapkan material", bodyEn: "The stone is cleaned, secured, and prepared for the chosen cutting method.", bodyId: "Batu dibersihkan, diamankan, dan disiapkan sesuai metode pemotongan." },
    ] },
    { titleEn: "Finish and hand over", titleId: "Menyelesaikan dan menyerahkan", introEn: "Each piece is refined, checked against the brief, then prepared for collection or return.", introId: "Setiap batu dirapikan, diperiksa berdasarkan brief, lalu disiapkan untuk diambil atau dikirim kembali.", steps: [
      { titleEn: "Rough shape", titleId: "Membentuk dasar", bodyEn: "The cutter removes material gradually to establish the approved outline.", bodyId: "Pengrajin mengurangi material secara bertahap untuk membentuk siluet yang disetujui." },
      { titleEn: "Refine the geometry", titleId: "Merapikan geometri", bodyEn: "Angles, curves, symmetry, and dimensions are brought closer to the agreed design.", bodyId: "Sudut, lengkung, simetri, dan dimensi dirapikan mengikuti desain yang disepakati." },
      { titleEn: "Progress through abrasives", titleId: "Menghaluskan bertahap", bodyEn: "The surface is refined through suitable abrasive grades to remove marks from shaping.", bodyId: "Permukaan dihaluskan dengan tingkat abrasif yang sesuai untuk mengurangi bekas pembentukan." },
      { titleEn: "Polish and clean", titleId: "Memoles dan membersihkan", bodyEn: "The agreed finish is applied, then the piece is cleaned for careful inspection.", bodyId: "Hasil akhir yang disepakati diterapkan, lalu batu dibersihkan untuk pemeriksaan." },
      { titleEn: "Inspect and hand over", titleId: "Memeriksa dan menyerahkan", bodyEn: "We review the result, document completion, and arrange collection or return shipping.", bodyId: "Kami meninjau hasil, mendokumentasikan penyelesaian, dan mengatur pengambilan atau pengiriman kembali." },
    ] },
  ],
  noteEyebrowEn: "A NOTE ON NATURAL STONE",
  noteEyebrowId: "CATATAN TENTANG BATU ALAM",
  noteTitleEn: "The stone always has a say.",
  noteTitleId: "Karakter alami batu tetap menjadi pertimbangan.",
  noteBodyEn: "Inclusions and internal fractures may only become visible during cutting. If a new condition could change the agreed result or risk, we pause and contact you before continuing.",
  noteBodyId: "Inklusi dan rekahan di dalam batu mungkin baru terlihat saat dipotong. Jika kondisi baru dapat mengubah hasil atau risiko, kami berhenti dan menghubungi Anda sebelum melanjutkan.",
  ctaLabelEn: "Discuss a custom project",
  ctaLabelId: "Diskusikan proyek custom",
  ctaTarget: "customOrder" as const,
  backLabelEn: "Lapidary",
  backLabelId: "Lapidary",
  contactPromptEn: "Have a question about a step?",
  contactPromptId: "Ada pertanyaan tentang prosesnya?",
  contactLabelEn: "Talk to our studio",
  contactLabelId: "Hubungi studio kami",
  metaTitleEn: "Lapidary Process — RENDI VIRGO",
  metaTitleId: "Proses Lapidary — RENDI VIRGO",
  metaDescriptionEn: "Explore the 15 steps RENDI VIRGO follows to assess, shape, finish, and review a custom stone commission.",
  metaDescriptionId: "Kenali 15 tahap RENDI VIRGO dalam menilai, membentuk, memoles, dan memeriksa pesanan batu custom.",
  visualStyle: "mineral" as const,
  layout: "timeline" as const,
  motionEnabled: true,
};

function processPresentation(value: unknown) {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const sourcePhases = Array.isArray(saved.phases) ? saved.phases : [];
  const phases = DEFAULT_PROCESS_PRESENTATION.phases.map((fallbackPhase, phaseIndex) => {
    const candidate = sourcePhases[phaseIndex];
    const phase = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate as Record<string, unknown> : {};
    const sourceSteps = Array.isArray(phase.steps) ? phase.steps : [];
    return {
      titleEn: typeof phase.titleEn === "string" && phase.titleEn.trim() ? phase.titleEn : fallbackPhase.titleEn,
      titleId: typeof phase.titleId === "string" && phase.titleId.trim() ? phase.titleId : fallbackPhase.titleId,
      introEn: typeof phase.introEn === "string" && phase.introEn.trim() ? phase.introEn : fallbackPhase.introEn,
      introId: typeof phase.introId === "string" && phase.introId.trim() ? phase.introId : fallbackPhase.introId,
      steps: fallbackPhase.steps.map((fallbackStep, stepIndex) => {
        const candidateStep = sourceSteps[stepIndex];
        const step = candidateStep && typeof candidateStep === "object" && !Array.isArray(candidateStep) ? candidateStep as Record<string, unknown> : {};
        return {
          titleEn: typeof step.titleEn === "string" && step.titleEn.trim() ? step.titleEn : fallbackStep.titleEn,
          titleId: typeof step.titleId === "string" && step.titleId.trim() ? step.titleId : fallbackStep.titleId,
          bodyEn: typeof step.bodyEn === "string" && step.bodyEn.trim() ? step.bodyEn : fallbackStep.bodyEn,
          bodyId: typeof step.bodyId === "string" && step.bodyId.trim() ? step.bodyId : fallbackStep.bodyId,
        };
      }),
    };
  });
  const stringValue = (key: keyof typeof DEFAULT_PROCESS_PRESENTATION) => typeof saved[key] === "string" && (saved[key] as string).trim() ? saved[key] as string : DEFAULT_PROCESS_PRESENTATION[key] as string;
  return {
    ...DEFAULT_PROCESS_PRESENTATION,
    eyebrowEn: stringValue("eyebrowEn"), eyebrowId: stringValue("eyebrowId"),
    phaseLabelEn: stringValue("phaseLabelEn"), phaseLabelId: stringValue("phaseLabelId"),
    stepCountLabelEn: stringValue("stepCountLabelEn"), stepCountLabelId: stringValue("stepCountLabelId"),
    expandDetailsLabelEn: stringValue("expandDetailsLabelEn"), expandDetailsLabelId: stringValue("expandDetailsLabelId"),
    collapseDetailsLabelEn: stringValue("collapseDetailsLabelEn"), collapseDetailsLabelId: stringValue("collapseDetailsLabelId"),
    titleEn: stringValue("titleEn"), titleId: stringValue("titleId"), introEn: stringValue("introEn"), introId: stringValue("introId"),
    heroImage: saved.heroImage === "/images/lapidary/studio/studio-overview.jpg" ? DEFAULT_PROCESS_PRESENTATION.heroImage : stringValue("heroImage"),
    heroAltEn: saved.heroAltEn === "Lapidary workbench with stone shaping and polishing tools" ? DEFAULT_PROCESS_PRESENTATION.heroAltEn : stringValue("heroAltEn"),
    heroAltId: saved.heroAltId === "Meja kerja lapidary dengan alat pembentuk dan pemoles batu" ? DEFAULT_PROCESS_PRESENTATION.heroAltId : stringValue("heroAltId"),
    heroImagePosition: saved.heroImagePosition === "left" || saved.heroImagePosition === "right" ? saved.heroImagePosition : "center",
    phases,
    noteEyebrowEn: stringValue("noteEyebrowEn"), noteEyebrowId: stringValue("noteEyebrowId"),
    noteTitleEn: stringValue("noteTitleEn"), noteTitleId: stringValue("noteTitleId"), noteBodyEn: stringValue("noteBodyEn"), noteBodyId: stringValue("noteBodyId"),
    ctaLabelEn: stringValue("ctaLabelEn"), ctaLabelId: stringValue("ctaLabelId"), ctaTarget: saved.ctaTarget === "contact" ? "contact" : "customOrder",
    backLabelEn: stringValue("backLabelEn"), backLabelId: stringValue("backLabelId"),
    contactPromptEn: stringValue("contactPromptEn"), contactPromptId: stringValue("contactPromptId"), contactLabelEn: stringValue("contactLabelEn"), contactLabelId: stringValue("contactLabelId"),
    metaTitleEn: stringValue("metaTitleEn"), metaTitleId: stringValue("metaTitleId"), metaDescriptionEn: stringValue("metaDescriptionEn"), metaDescriptionId: stringValue("metaDescriptionId"),
    visualStyle: saved.visualStyle === "forest" || saved.visualStyle === "quartz" ? saved.visualStyle : "mineral",
    layout: saved.layout === "cards" ? "cards" : "timeline",
    motionEnabled: saved.motionEnabled !== false,
  };
}

function trimJsonStrings(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(trimJsonStrings);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, trimJsonStrings(item)]));
  return value;
}

function hasValidProcessText(value: unknown, parentKey = ""): boolean {
  if (typeof value === "string") return value.length >= (parentKey === "heroImage" ? 1 : 2);
  if (Array.isArray(value)) return value.every((item) => hasValidProcessText(item));
  if (value && typeof value === "object") return Object.entries(value)
    .filter(([key]) => !key.endsWith("Id"))
    .every(([key, item]) => hasValidProcessText(item, key));
  return true;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function statusLabel(status: string): string {
  return status.replace(/([a-z])([A-Z])/g, "$1 $2");
}

const LAPIDARY_REQUEST_TERMS_VERSION = "lapidary-request-v1";

const LAPIDARY_STATUS_TRANSITIONS: Record<string, Record<string, string[]>> = {
  CustomerSupplied: {
    New: ["Reviewing", "Declined", "Cancelled"],
    Reviewing: ["Approved", "Declined", "Cancelled"],
    QuoteSent: ["Approved", "Declined", "Cancelled"],
    Approved: ["Cancelled", "Declined"],
    MaterialInTransit: ["MaterialReceived", "ReturnPending", "Cancelled"],
    MaterialReceived: ["ReturnPending", "EstimateSent", "InProgress", "Cancelled"],
    EstimateSent: ["ReturnPending", "InProgress", "Cancelled"],
    InProgress: ["ReturnPending", "Completed", "EstimateSent", "Cancelled"],
    Completed: ["ReturnPending", "AwaitingPayment", "Cancelled"],
    AwaitingPayment: ["ReturnPending", "ReturnShipped", "Cancelled"],
    ReturnPending: ["AwaitingPayment"],
    ReturnShipped: ["Delivered"],
    Delivered: [],
    Declined: [],
    Cancelled: [],
  },
  RendiVirgoStock: {
    New: ["Reviewing", "Declined", "Cancelled"],
    Reviewing: ["QuoteSent", "Declined", "Cancelled"],
    QuoteSent: ["Approved", "Declined", "Cancelled"],
    Approved: ["InProgress", "Declined", "Cancelled"],
    InProgress: ["Completed", "Cancelled"],
    Completed: [],
    AwaitingPayment: [],
    ReturnShipped: [],
    Delivered: [],
    Declined: [],
    Cancelled: [],
  },
  Undecided: {
    New: ["Reviewing", "Declined", "Cancelled"],
    Reviewing: ["QuoteSent", "Declined", "Cancelled"],
    QuoteSent: ["Approved", "Declined", "Cancelled"],
    Approved: ["InProgress", "Declined", "Cancelled"],
    InProgress: ["Completed", "Cancelled"],
    Completed: [],
    AwaitingPayment: [],
    ReturnShipped: [],
    Delivered: [],
    Declined: [],
    Cancelled: [],
  },
};

function renderLapidaryEmail(title: string, content: string): string {
  return `<!doctype html><html><body style="margin:0;padding:32px 12px;background:#f5f2eb;color:#26392e;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf8;border:1px solid #dedfd2"><tr><td style="padding:25px 32px;background:#102b23;color:#f7f4ee;font-family:Georgia,serif;font-size:18px;letter-spacing:1px">RENDI VIRGO <span style="color:#d8c49b;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px">· LAPIDARY</span></td></tr><tr><td style="padding:34px 32px 18px"><p style="margin:0 0 12px;color:#896d41;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">LAPIDARY STUDIO</p><h1 style="margin:0 0 20px;color:#183e30;font-family:Georgia,serif;font-size:30px;font-weight:normal;line-height:1.2">${escapeHtml(title)}</h1><div style="font-size:15px;line-height:1.8">${content}</div></td></tr><tr><td style="padding:18px 32px 25px;border-top:1px solid #e6e3da;color:#74786f;font-size:11px;line-height:1.6">RENDI VIRGO · Indonesia to the world<br>Reply to this email if you need help with your project.</td></tr></table></td></tr></table></body></html>`;
}

@Injectable()
export class LapidaryService {
  private readonly logger = new Logger(LapidaryService.name);
  private readonly privateUploadDir = resolve(process.env.LAPIDARY_PRIVATE_UPLOAD_DIR ?? join(process.cwd(), "private-uploads", "lapidary"));

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly emailOutbox: LapidaryEmailOutboxService,
  ) {}

  async domeSettings() {
    const setting = await this.prisma.siteSetting.findUnique({ where: { key: "lapidary.dome" } });
    return { enabled: true, minHeight: 0.5, maxHeight: 8, defaultHeight: 3.2, maxWidthRatio: 0.45, labelEn: "Dome profile & height", labelId: "Profil & tinggi dome", ...(setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value) ? setting.value : {}) };
  }

  async saveDome(input: SaveLapidaryDomeDto, context: AuditContext) {
    if (input.minHeight > input.maxHeight || input.defaultHeight < input.minHeight || input.defaultHeight > input.maxHeight) throw new BadRequestException("Default height must be within the minimum and maximum");
    const value = { ...input } as unknown as Prisma.InputJsonValue;
    await this.prisma.siteSetting.upsert({ where: { key: "lapidary.dome" }, create: { key: "lapidary.dome", value }, update: { value } });
    await this.audit.log({ adminId: context.adminId, action: "lapidary_dome.update", entityType: "SiteSetting", entityId: "lapidary.dome", summary: "Updated dome controls", ip: context.ip, userAgent: context.userAgent });
    return input;
  }

  async servicePricing() {
    const setting = await this.prisma.siteSetting.findUnique({ where: { key: SERVICE_PRICING_KEY } });
    const saved = setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
      ? setting.value as Record<string, unknown>
      : {};
    const price = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100000
      ? Math.round(value * 100) / 100
      : fallback;
    return {
      pendantUsd: price(saved.pendantUsd, DEFAULT_LAPIDARY_SERVICE_PRICING.pendantUsd),
      matchedPairUsd: price(saved.matchedPairUsd, DEFAULT_LAPIDARY_SERVICE_PRICING.matchedPairUsd),
    };
  }

  async saveServicePricing(input: SaveLapidaryServicePricingDto, context: AuditContext) {
    const value = { pendantUsd: input.pendantUsd, matchedPairUsd: input.matchedPairUsd } as unknown as Prisma.InputJsonValue;
    await this.prisma.siteSetting.upsert({ where: { key: SERVICE_PRICING_KEY }, create: { key: SERVICE_PRICING_KEY, value }, update: { value } });
    await this.audit.log({ adminId: context.adminId, action: "lapidary_service_pricing.update", entityType: "SiteSetting", entityId: SERVICE_PRICING_KEY, summary: "Updated lapidary service pricing", ip: context.ip, userAgent: context.userAgent });
    return input;
  }

  async publicContent(language = "en") {
    const [setting, heroSetting, presentationSetting, processSetting, artistsSetting, artists] = await Promise.all([
      this.prisma.siteSetting.findUnique({ where: { key: STUDIO_IMAGES_KEY } }),
      this.prisma.siteSetting.findUnique({ where: { key: STUDIO_HERO_IMAGE_KEY } }),
      this.prisma.siteSetting.findUnique({ where: { key: STUDIO_PRESENTATION_KEY } }),
      this.prisma.siteSetting.findUnique({ where: { key: PROCESS_PRESENTATION_KEY } }),
      this.prisma.siteSetting.findUnique({ where: { key: ARTISTS_PRESENTATION_KEY } }),
      this.prisma.lapidaryArtist.findMany({
        where: { isPublished: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);
    return {
      domeSettings: await this.domeSettings(),
      servicePricing: await this.servicePricing(),
      studioHeroImage: typeof heroSetting?.value === "string" && heroSetting.value ? heroSetting.value : DEFAULT_STUDIO_HERO_IMAGE,
      studioImages: studioImages(setting?.value),
      studioPresentation: studioPresentation(presentationSetting?.value),
      processPresentation: processPresentation(processSetting?.value),
      artistsPresentation: artistsPresentation(artistsSetting?.value),
      artists: artists.map((artist) => {
        const portfolio = Array.isArray(artist.portfolioImages) ? artist.portfolioImages : [];
        const idReady = Boolean(artist.bioId?.trim()) &&
          (!artist.experienceEn?.trim() || Boolean(artist.experienceId?.trim())) &&
          (!artist.signatureStyle?.trim() || Boolean(artist.signatureStyleId?.trim())) &&
          (artist.stoneExperienceEn.length === 0 || artist.stoneExperienceId.length >= artist.stoneExperienceEn.length &&
            artist.stoneExperienceEn.every((_, index) => Boolean(artist.stoneExperienceId[index]?.trim())));
        return {
          id: artist.id,
          slug: artist.slug,
          name: artist.name,
          contentLocale: language === "id" && idReady ? "id" : "en",
          signatureStyle: language === "id" ? artist.signatureStyleId || artist.signatureStyle || "" : artist.signatureStyle || "",
          location: artist.location,
          bio: language === "id" ? artist.bioId || artist.bio : artist.bio,
          experience: language === "id" ? artist.experienceId || artist.experienceEn || "" : artist.experienceEn || "",
          stoneExperience: language === "id" ? artist.stoneExperienceId : artist.stoneExperienceEn,
          imageUrl: artist.imageUrl,
          imageAlt: language === "id" ? artist.imageAltId || artist.imageAltEn || artist.name : artist.imageAltEn || artist.name,
          imagePosition: artist.imagePosition,
          portfolioImages: portfolio.flatMap((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
            const image = entry as Record<string, unknown>;
            if (typeof image.url !== "string") return [];
            return [{
              url: image.url,
              altText: language === "id" ? (typeof image.altId === "string" ? image.altId : artist.name) : (typeof image.altEn === "string" ? image.altEn : artist.name),
              caption: language === "id" ? (typeof image.captionId === "string" ? image.captionId : "") : (typeof image.captionEn === "string" ? image.captionEn : ""),
            }];
          }),
        };
      }),
    };
  }

  async createRequest(input: CreateLapidaryRequestDto, files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }> = [], customerId: string | null = null) {
    // A filled honeypot is reported as received, but never stored or emailed.
    if (input.website?.trim()) return { ok: true, requestNumber: "LR-RECEIVED" };
    if (input.country.trim().length < 2) throw new BadRequestException("Add your country");

    if (input.submissionKey) {
      const previous = await this.prisma.lapidaryRequest.findUnique({
        where: { submissionKey: input.submissionKey },
        select: { requestNumber: true, email: true, customerId: true },
      });
      if (previous) {
        if (previous.email !== input.email.trim().toLowerCase()) throw new ConflictException("This submission key belongs to a different request");
        return { ok: true, requestNumber: previous.requestNumber, accountLinked: Boolean(previous.customerId) };
      }
    }

    if (input.materialSource === "CustomerSupplied") {
      if (!input.materialDescription?.trim() || input.materialDescription.trim().length < 2) throw new BadRequestException("Describe the stone you will provide");
      if (!input.materialWeightGram || input.materialWeightGram <= 0) throw new BadRequestException("Add the approximate weight of your stone");
      if (!files.length) throw new BadRequestException("Add at least one photo or video of your stone");
      if (input.items.some((item) => item.productId)) throw new BadRequestException("Customer supplied material cannot include catalog products");
    } else if (input.materialSource === "RendiVirgoStock") {
      if (input.items.some((item) => !item.productId)) throw new BadRequestException("Choose a RENDI VIRGO stone for each work item");
      if (input.items.some((item) => !item.materialQuantity || item.materialQuantity <= 0)) throw new BadRequestException("Add the amount of catalog material needed for every work item");
    } else {
      if (input.items.some((item) => item.productId)) throw new BadRequestException("Choose a material source before selecting catalog products");
      if ((input.materialDescription?.trim().length ?? 0) < 5 && (input.additionalDetails?.trim().length ?? 0) < 5) {
        throw new BadRequestException("Tell us a little about the stone or result you have in mind");
      }
    }

    if (input.items.some((item) => item.serviceType === "DecorationOther" && !item.desiredShape?.trim())) {
      throw new BadRequestException("Describe the decoration shape for custom decoration work");
    }
    if (input.items.some((item) => item.serviceType === "Other" && !item.workDescription?.trim())) {
      throw new BadRequestException("Describe the other lapidary work you need");
    }
    const dome = await this.domeSettings();
    for (const item of input.items) {
      if (item.domeProfile && item.domeProfile !== "Studio") {
        if (!dome.enabled) throw new BadRequestException("Dome controls are currently unavailable; choose studio recommendation");
        if (!item.domeHeightMm || item.domeHeightMm < dome.minHeight || item.domeHeightMm > dome.maxHeight) throw new BadRequestException("Dome height is outside the studio limits");
        if (item.widthMm && item.domeHeightMm > item.widthMm * dome.maxWidthRatio) throw new BadRequestException("Dome height is too high for the requested width");
        if (item.depthMm && item.depthMm <= item.domeHeightMm) throw new BadRequestException("Overall thickness must be greater than dome height to allow a base");
      } else if (item.domeHeightMm !== undefined) throw new BadRequestException("Choose a dome profile for the requested height");
      if (item.serviceType === "CabochonSuite") {
        const keys = item.components?.map((component) => component.key).sort();
        if (!keys || keys.length !== 2 || keys[0] !== "MatchingPair" || keys[1] !== "Pendant") {
          throw new BadRequestException("A cabochon suite needs specifications for one pendant and one matching pair");
        }
        if (item.components?.some((component) => component.shapeKey === "custom" && !component.desiredShape?.trim())) {
          throw new BadRequestException("Describe each custom shape in the cabochon suite");
        }
        if (item.components?.some((component) => Boolean(component.lengthMm) !== Boolean(component.widthMm))) {
          throw new BadRequestException("For each suite component, provide both length and width, or leave both blank");
        }
      } else if (item.components?.length) {
        throw new BadRequestException("Suite component specifications are only valid for cabochon suites");
      }
    }
    if (input.items.some((item) => item.shapeKey === "custom" && !item.desiredShape?.trim())) {
      throw new BadRequestException("Describe each custom shape");
    }
    if (input.items.some((item) => Boolean(item.lengthMm) !== Boolean(item.widthMm))) {
      throw new BadRequestException("Provide both length and width, or leave both blank");
    }

    const jakartaToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
    if (input.targetDate) {
      const parsedTargetDate = new Date(`${input.targetDate}T00:00:00.000Z`);
      if (!Number.isFinite(parsedTargetDate.getTime()) || parsedTargetDate.toISOString().slice(0, 10) !== input.targetDate) {
        throw new BadRequestException("Enter a valid preferred completion date");
      }
      if (input.targetDate < jakartaToday) throw new BadRequestException("The preferred completion date must be today or later");
    }

    const uploadedFiles = this.validateRequestMedia(files);
    const productIds = [...new Set(input.items.map((item) => item.productId).filter((id): id is string => Boolean(id)))];
    const products = productIds.length ? await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: "Published",
        sellOnWeb: true,
        category: { slug: { in: ["rough", "slab"] }, isActive: true },
      },
      select: {
        id: true, name: true, sku: true, slug: true, stoneType: true, origin: true, price: true, currency: true, unit: true, stockModel: true, stockQuantity: true,
        variants: { select: { stockQuantity: true } },
        category: { select: { slug: true } },
      },
    }) : [];
    const productById = new Map(products.map((product) => [product.id, product]));
    if (products.length !== productIds.length) throw new BadRequestException("One or more selected RENDI VIRGO stones are no longer available");
    const availableByProduct = new Map<string, number>();
    for (const product of products) {
      const available = product.variants.length
        ? product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0)
        : product.stockModel === "Unique" ? 1 : (product.stockQuantity ?? 0);
      if (available <= 0) throw new BadRequestException(`The selected stone “${product.name}” is no longer available`);
      availableByProduct.set(product.id, available);
    }
    const requestedByProduct = new Map<string, number>();
    for (const item of input.items) {
      if (!item.productId) continue;
      requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + (item.materialQuantity ?? 0));
    }
    for (const [productId, requested] of requestedByProduct) {
      const available = availableByProduct.get(productId) ?? 0;
      if (requested > available) {
        const productName = productById.get(productId)?.name ?? "Selected stone";
        throw new BadRequestException(`Requested material for “${productName}” exceeds its current available quantity (${available})`);
      }
    }

    const firstItem = input.items[0];
    const firstProduct = firstItem.productId ? productById.get(firstItem.productId) : undefined;
    const materialDescription = input.materialDescription?.trim() || (firstProduct
      ? `${firstProduct.stoneType} · ${firstProduct.name} (${firstProduct.sku})`
      : input.materialSource === "CustomerSupplied" ? "Customer supplied stone" : "Customer would like studio guidance selecting material");
    const finishLabels: Record<string, string> = {
      HighGloss: "High gloss polish", SatinMatte: "Satin / matte", Natural: "Keep a natural finish", NotSure: "Studio guidance requested", Other: "Custom finish",
    };
    const finishPreference = input.finishPreference ?? null;
    const details = [
      finishPreference ? `Finish preference: ${finishLabels[finishPreference] ?? finishPreference}` : "Finish preference: Not specified",
      input.additionalDetails?.trim(),
    ].filter(Boolean).join("\n\n");

    const stagedMedia = await this.storeRequestMedia(uploadedFiles);

    const now = new Date();
    const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now).replaceAll("-", "");
    const claimToken = customerId ? null : randomBytes(32).toString("base64url");
    const claimTokenHash = claimToken ? createHash("sha256").update(claimToken).digest("hex") : null;
    const request = await this.prisma.$transaction(async (tx) => {
        const sequence = await tx.sequence.upsert({
          where: { key: `lapidary-request:${dateKey}` },
          create: { key: `lapidary-request:${dateKey}`, value: 1 },
          update: { value: { increment: 1 } },
        });
        const requestNumber = `LR-${dateKey}-${String(sequence.value).padStart(4, "0")}`;
        const created = await tx.lapidaryRequest.create({
          data: {
            requestNumber,
            submissionKey: input.submissionKey ?? null,
            termsVersion: LAPIDARY_REQUEST_TERMS_VERSION,
            customerId,
            claimTokenHash,
            claimTokenExpiresAt: claimTokenHash ? new Date(Date.now() + 30 * 24 * 60 * 60_000) : null,
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            phone: input.phone.trim(),
            country: input.country.trim() || null,
            utmSource: input.utmSource?.trim() || null,
            utmMedium: input.utmMedium?.trim() || null,
            utmCampaign: input.utmCampaign?.trim() || null,
            utmContent: input.utmContent?.trim() || null,
            utmTerm: input.utmTerm?.trim() || null,
            landingPath: input.landingPath?.trim() || null,
            company: input.company?.trim() || null,
            materialOrigin: input.materialOrigin?.trim() || null,
            materialCondition: input.materialCondition?.trim() || null,
            materialWeightGram: input.materialWeightGram ?? null,
            materialSource: input.materialSource,
            materialDescription,
            serviceType: firstItem.serviceType,
            desiredShape: firstItem.desiredShape?.trim() || firstItem.shapeKey || null,
            lengthMm: firstItem.lengthMm ?? null,
            widthMm: firstItem.widthMm ?? null,
            depthMm: firstItem.depthMm ?? null,
            // Parent columns mirror the first row for legacy readers. Work-item rows are the source of truth because their quantity units can differ.
            quantity: firstItem.quantity,
            targetDate: input.targetDate ? new Date(`${input.targetDate}T12:00:00.000Z`) : null,
            details: details || "No additional requirements supplied.",
            finishPreference,
            additionalDetails: input.additionalDetails?.trim() || null,
            referenceImageUrls: (input.referenceImageUrls ?? []).map((url) => url.trim()),
            items: {
              create: input.items.map((item, sortOrder) => {
                const product = item.productId ? productById.get(item.productId) : undefined;
                return {
                  serviceType: item.serviceType,
                  workDescription: [item.workDescription?.trim(), item.domeProfile ? `Dome: ${item.domeProfile}${item.domeHeightMm ? ` · height ${item.domeHeightMm} mm above girdle` : " · studio recommendation"}` : ""].filter(Boolean).join("\n") || null,
                  shapeKey: item.shapeKey ?? null,
                  desiredShape: item.desiredShape?.trim() || null,
                  lengthMm: item.lengthMm ?? null,
                  widthMm: item.widthMm ?? null,
                  depthMm: item.depthMm ?? null,
                  quantity: item.quantity,
                  materialQuantity: item.materialQuantity ?? null,
                  materialUnitSnapshot: product?.unit ?? null,
                  components: item.components?.length ? item.components as unknown as Prisma.InputJsonValue : undefined,
                  productId: product?.id ?? null,
                  productNameSnapshot: product?.name ?? null,
                  productSkuSnapshot: product?.sku ?? null,
                  productSlugSnapshot: product?.slug ?? null,
                  productStoneTypeSnapshot: product?.stoneType ?? null,
                  productOriginSnapshot: product?.origin ?? null,
                  productPriceSnapshot: product?.price ?? null,
                  productCurrencySnapshot: product?.currency ?? null,
                  sortOrder,
                };
              }),
            },
            media: stagedMedia.length ? {
              create: stagedMedia.map((media) => ({
                storagePath: media.storagePath,
                originalName: media.originalName,
                mimeType: media.mimeType,
                size: media.size,
              })),
            } : undefined,
          },
        });
        await tx.notification.create({
          data: {
            type: "System",
            title: `Lapidary request ${created.requestNumber}`,
            body: `${created.name} · ${input.items.length} shape ${input.items.length === 1 ? "specification" : "specifications"}`,
            href: `/admin/lapidary/requests?open=${created.id}`,
            entityType: "LapidaryRequest",
            entityId: created.id,
          },
        });
        await this.enqueueIntakeEmails(tx, created, input, claimToken, claimTokenHash);
        return created;
      }).catch(async (error) => {
        await Promise.all(stagedMedia.map((media) => unlink(media.absolutePath).catch(() => undefined)));
        const uniqueConflict = typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
        if (uniqueConflict && input.submissionKey) {
          const previous = await this.prisma.lapidaryRequest.findUnique({
            where: { submissionKey: input.submissionKey },
            select: { requestNumber: true, email: true, customerId: true },
          });
          if (previous) {
            if (previous.email !== input.email.trim().toLowerCase()) {
              throw new ConflictException("This submission key belongs to a different request");
            }
            return previous;
          }
        }
        throw error;
      });
    return { ok: true, requestNumber: request.requestNumber, accountLinked: Boolean(request.customerId) };
  }

  private async enqueueIntakeEmails(
    tx: Prisma.TransactionClient,
    request: { id: string; name: string; requestNumber: string; email: string; phone: string },
    input: CreateLapidaryRequestDto,
    claimToken: string | null,
    claimTokenHash: string | null,
  ) {
    const safeName = escapeHtml(request.name);
    const safeNumber = escapeHtml(request.requestNumber);
    const adminUrl = `${publicAppOrigin()}/admin/lapidary/requests?open=${encodeURIComponent(request.id)}`;
    const workSummary = input.items.map((item) => {
      const service = escapeHtml(statusLabel(item.serviceType));
      const shape = escapeHtml(item.desiredShape?.trim() || item.shapeKey?.replace(/-/g, " ") || "Shape to be discussed");
      const unit = item.serviceType === "CabochonPair" ? (item.quantity === 1 ? "pair" : "pairs") : (item.quantity === 1 ? "finished piece" : "finished pieces");
      return `<li>${service} · ${shape} — ${item.quantity} ${unit}</li>`;
    }).join("");
    const adminHtml = renderLapidaryEmail("A new service request is ready for review.", `<p><strong>${safeNumber}</strong></p><p>${safeName} submitted these shape specifications:</p><ul>${workSummary}</ul><p>Email: ${escapeHtml(request.email)}<br>Phone: ${escapeHtml(request.phone)}</p><p><a href="${escapeHtml(adminUrl)}" style="display:inline-block;margin-top:8px;padding:12px 18px;background:#183e30;color:#fffdf8;text-decoration:none">Review request</a></p>`);
    const accountUrl = claimToken
      ? `${publicAppOrigin()}/account/login?next=${encodeURIComponent(`/account/lapidary?claim=${encodeURIComponent(claimToken)}&request=${encodeURIComponent(request.requestNumber)}`)}`
      : `${publicAppOrigin()}/account/lapidary`;
    const accountInstructions = claimToken
      ? `<p>To follow this project in your account, create an account or sign in using the same email address as this request. Your secure project link expires in 30 days.</p>`
      : `<p>This project is linked to your customer account. Sign in to follow its progress; we will continue to send email notifications.</p>`;
    const customerAccountHtml = renderLapidaryEmail(
      "We received your project brief.",
      `<p>Hello ${safeName},</p><p>Your reference number is <strong>${safeNumber}</strong>. Our studio team will review the material and service details, then contact you about availability and a quote.</p>${accountInstructions}<p><a href="${escapeHtml(accountUrl)}">${claimToken ? "Create an account or sign in to follow this project" : "Open your project account"}</a></p><p>This is a service inquiry. Work and payment are only confirmed after you approve the written quote and we confirm the material arrangements.</p>`,
    );
    const store = await this.settings.getPublicSettings();
    const storeEmail = store["store.email"] as string;
    await this.emailOutbox.enqueue(tx, request.id, `lapidary:${request.id}:intake-admin`, { to: storeEmail, replyTo: request.email, subject: `Lapidary request ${request.requestNumber} — ${request.name}`, html: adminHtml });
    await this.emailOutbox.enqueue(tx, request.id, `lapidary:${request.id}:intake-customer`, {
      to: request.email,
      ...(claimTokenHash ? { claimTokenHash } : {}),
      subject: `Lapidary request received — ${request.requestNumber}`,
      html: customerAccountHtml,
    });
  }

  private validateRequestMedia(files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>) {
    if (files.length > 5) throw new BadRequestException("Add no more than 5 photos or videos");
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 30 * 1024 * 1024) throw new BadRequestException("Keep all uploaded files under 30 MB total");

    return files.map((file) => {
      if (!file.buffer?.length || file.size < 1 || file.size > 6 * 1024 * 1024) throw new BadRequestException("Each photo or video must be 6 MB or smaller");
      const detectedImage = detectImageType(file.buffer);
      if (detectedImage && detectedImage.mime === file.mimetype && ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(detectedImage.mime)) {
        return { file, mimeType: detectedImage.mime, extension: detectedImage.extension };
      }
      const isMp4 = file.mimetype === "video/mp4" && file.buffer.length >= 12 && file.buffer.subarray(4, 8).toString("ascii") === "ftyp";
      if (isMp4) return { file, mimeType: "video/mp4", extension: ".mp4" };
      throw new BadRequestException("A file is invalid or its content does not match its type. Use JPEG, PNG, WebP, AVIF, or MP4.");
    });
  }

  private async storeRequestMedia(files: ReturnType<LapidaryService["validateRequestMedia"]>) {
    if (!files.length) return [];
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date()).replaceAll("/", "-");
    const folder = month.replace(/[^0-9-]/g, "");
    const directory = join(this.privateUploadDir, folder);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(this.privateUploadDir, 0o700);
    await chmod(directory, 0o700);
    const stored: Array<{ storagePath: string; absolutePath: string; originalName: string; mimeType: string; size: number }> = [];
    try {
      for (const entry of files) {
        const rawName = entry.file.originalname.replace(/\\/g, "/").split("/").pop() ?? "reference";
        const originalName = rawName.replace(/[\u0000-\u001f\u007f]/g, "_").slice(0, 180) || "reference";
        const filename = `${randomBytes(16).toString("hex")}${entry.extension}`;
        const absolutePath = join(directory, filename);
        await writeFile(absolutePath, entry.file.buffer, { flag: "wx", mode: 0o600 });
        stored.push({ storagePath: `${folder}/${filename}`, absolutePath, originalName, mimeType: entry.mimeType, size: entry.file.size });
      }
      return stored;
    } catch (error) {
      await Promise.all(stored.map((media) => unlink(media.absolutePath).catch(() => undefined)));
      throw error;
    }
  }

  private resolvePrivateMediaPath(storagePath: string) {
    const path = resolve(this.privateUploadDir, storagePath);
    if (!path.startsWith(`${this.privateUploadDir}${sep}`)) throw new NotFoundException("Lapidary media not found");
    return path;
  }

  async listRequests(query: LapidaryRequestQueryDto) {
    const where: Prisma.LapidaryRequestWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { requestNumber: { contains: term, mode: "insensitive" } },
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
      ];
    }
    const [total, items] = await Promise.all([
      this.prisma.lapidaryRequest.count({ where }),
      this.prisma.lapidaryRequest.findMany({ where, orderBy: { createdAt: "desc" }, include: { items: { select: { id: true, serviceType: true, shapeKey: true, desiredShape: true, quantity: true } } }, ...skipTake(query.page, query.pageSize) }),
    ]);
    return paginated(items, total, query.page, query.pageSize);
  }

  async getRequest(id: string) {
    const request = await this.prisma.lapidaryRequest.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true, email: true, phone: true, addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true, country: true, countryCode: true } },
        items: { orderBy: { sortOrder: "asc" }, include: { product: { select: { id: true, slug: true, name: true, sku: true } } } },
        media: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true } },
        progressUpdates: { orderBy: { createdAt: "desc" }, include: { media: { orderBy: { createdAt: "asc" } } } },
        invoice: true,
        emailOutbox: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, attempts: true, lastError: true, sentAt: true, createdAt: true } },
      },
    });
    if (!request) throw new NotFoundException("Lapidary request not found");
    return request;
  }

  async getRequestMedia(requestId: string, mediaId: string) {
    const media = await this.prisma.lapidaryRequestMedia.findFirst({ where: { id: mediaId, requestId } });
    if (!media) throw new NotFoundException("Lapidary media not found");
    return { ...media, path: this.resolvePrivateMediaPath(media.storagePath) };
  }

  async listCustomerRequests(customerId: string) {
    return this.prisma.lapidaryRequest.findMany({
      where: { customerId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        requestNumber: true,
        materialSource: true,
        materialDescription: true,
        materialOrigin: true,
        materialCondition: true,
        materialWeightGram: true,
        serviceType: true,
        desiredShape: true,
        lengthMm: true,
        widthMm: true,
        depthMm: true,
        quantity: true,
        finishPreference: true,
        status: true,
        quoteCurrency: true,
        serviceEstimateMin: true,
        serviceEstimateMax: true,
        estimateAcceptedAt: true,
        materialShippingInstructions: true,
        inboundCarrier: true,
        inboundTrackingNumber: true,
        inboundTrackingUrl: true,
        materialReceivedAt: true,
        returnCarrier: true,
        returnTrackingNumber: true,
        returnTrackingUrl: true,
        returnShippedAt: true,
        deliveredAt: true,
        workCancelledAt: true,
        cancellationReason: true,
        createdAt: true,
        updatedAt: true,
        items: { orderBy: { sortOrder: "asc" }, select: { id: true, serviceType: true, workDescription: true, shapeKey: true, desiredShape: true, lengthMm: true, widthMm: true, depthMm: true, quantity: true } },
        progressUpdates: {
          where: { isCustomerVisible: true },
          orderBy: { createdAt: "desc" },
          include: { media: { select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true } } },
        },
        invoice: { select: { id: true, revision: true, revisionReason: true, currency: true, serviceAmount: true, returnShippingAmount: true, totalAmount: true, returnRecipientName: true, returnPhone: true, returnAddressLine1: true, returnAddressLine2: true, returnCity: true, returnState: true, returnPostalCode: true, returnCountry: true, returnCountryCode: true, status: true, paymentProofUploadedAt: true, paidAt: true, createdAt: true } },
      },
    });
  }

  async getCustomerRequest(customerId: string, requestNumber: string) {
    const request = await this.prisma.lapidaryRequest.findFirst({
      where: { customerId, requestNumber },
      select: {
        id: true,
        requestNumber: true,
        materialSource: true,
        materialDescription: true,
        materialOrigin: true,
        materialCondition: true,
        materialWeightGram: true,
        serviceType: true,
        desiredShape: true,
        lengthMm: true,
        widthMm: true,
        depthMm: true,
        quantity: true,
        finishPreference: true,
        status: true,
        quoteCurrency: true,
        serviceEstimateMin: true,
        serviceEstimateMax: true,
        estimateAcceptedAt: true,
        materialShippingInstructions: true,
        inboundCarrier: true,
        inboundTrackingNumber: true,
        inboundTrackingUrl: true,
        materialReceivedAt: true,
        returnCarrier: true,
        returnTrackingNumber: true,
        returnTrackingUrl: true,
        returnShippedAt: true,
        deliveredAt: true,
        workCancelledAt: true,
        cancellationReason: true,
        createdAt: true,
        updatedAt: true,
        items: { orderBy: { sortOrder: "asc" }, select: { id: true, serviceType: true, workDescription: true, shapeKey: true, desiredShape: true, lengthMm: true, widthMm: true, depthMm: true, quantity: true } },
        progressUpdates: {
          where: { isCustomerVisible: true },
          orderBy: { createdAt: "desc" },
          include: { media: { select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true } } },
        },
        invoice: { select: { id: true, revision: true, revisionReason: true, currency: true, serviceAmount: true, returnShippingAmount: true, totalAmount: true, returnRecipientName: true, returnPhone: true, returnAddressLine1: true, returnAddressLine2: true, returnCity: true, returnState: true, returnPostalCode: true, returnCountry: true, returnCountryCode: true, status: true, paymentProofUploadedAt: true, paidAt: true, createdAt: true } },
      },
    });
    if (!request) throw new NotFoundException("Lapidary project not found");
    return request;
  }

  async claimCustomerRequest(customerId: string, input: ClaimLapidaryRequestDto) {
    const tokenHash = createHash("sha256").update(input.token.trim()).digest("hex");
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, email: true, emailVerifiedAt: true } });
    if (!customer?.emailVerifiedAt) throw new ConflictException("Verify your email before linking this project");
    const request = await this.prisma.lapidaryRequest.findFirst({
      where: { claimTokenHash: tokenHash, claimTokenExpiresAt: { gt: new Date() }, email: customer.email, customerId: null },
      select: { id: true, requestNumber: true },
    });
    if (!request) throw new NotFoundException("This project link is invalid, expired, or belongs to another email address");
    const linked = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.lapidaryRequest.updateMany({
        where: { id: request.id, claimTokenHash: tokenHash, claimTokenExpiresAt: { gt: new Date() }, customerId: null },
        data: { customerId, claimTokenHash: null, claimTokenExpiresAt: null },
      });
      if (claimed.count !== 1) throw new ConflictException("This project has already been linked to an account");
      await tx.lapidaryProgressUpdate.create({
        data: { requestId: request.id, title: "Customer account linked", body: "The customer linked this project to a verified account.", isCustomerVisible: false },
      });
      return tx.lapidaryRequest.findUniqueOrThrow({ where: { id: request.id }, select: { id: true, requestNumber: true } });
    });
    return { ok: true, requestNumber: linked.requestNumber };
  }

  async acceptEstimate(customerId: string, requestNumber: string, input: AcceptLapidaryEstimateDto) {
    if (input.accepted !== true) throw new BadRequestException("Confirm the service price range before work begins");
    const request = await this.prisma.lapidaryRequest.findFirst({ where: { requestNumber, customerId } });
    if (!request) throw new NotFoundException("Lapidary project not found");
    if (request.serviceEstimateMin === null || request.serviceEstimateMax === null) throw new ConflictException("The studio has not added a service estimate yet");
    if (!["Approved", "MaterialInTransit", "MaterialReceived", "EstimateSent", "ReturnPending"].includes(request.status)) {
      throw new ConflictException("The service estimate cannot be accepted at this project stage");
    }
    if (request.estimateAcceptedAt) return { ok: true, acceptedAt: request.estimateAcceptedAt };
    const acceptedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.lapidaryRequest.updateMany({
        where: {
          id: request.id,
          customerId,
          estimateAcceptedAt: null,
          status: { in: ["Approved", "MaterialInTransit", "MaterialReceived", "EstimateSent"] },
          serviceEstimateMin: request.serviceEstimateMin,
          serviceEstimateMax: request.serviceEstimateMax,
          quoteCurrency: request.quoteCurrency,
        },
        data: { estimateAcceptedAt: acceptedAt },
      });
      if (result.count !== 1) throw new ConflictException("The estimate changed while you were accepting it. Refresh and review the latest amount.");
      await tx.lapidaryProgressUpdate.create({
        data: { requestId: request.id, title: "Service estimate accepted", body: `Customer accepted the service estimate range ${request.quoteCurrency} ${Number(request.serviceEstimateMin).toFixed(2)}–${Number(request.serviceEstimateMax).toFixed(2)}.`, isCustomerVisible: false },
      });
    });
    return { ok: true, acceptedAt };
  }

  async submitInboundShipment(customerId: string, requestNumber: string, input: SubmitLapidaryInboundShipmentDto) {
    const request = await this.prisma.lapidaryRequest.findFirst({ where: { requestNumber, customerId } });
    if (!request) throw new NotFoundException("Lapidary project not found");
    if (request.status !== "Approved") throw new ConflictException("Material shipment details can only be added after the studio approves the request");
    if (!request.estimateAcceptedAt) throw new ConflictException("Accept the service estimate before sending material to the studio");
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.lapidaryRequest.updateMany({
        where: { id: request.id, customerId, status: "Approved", estimateAcceptedAt: { not: null } },
        data: {
          status: "MaterialInTransit",
          inboundCarrier: input.carrier.trim(),
          inboundTrackingNumber: input.trackingNumber.trim(),
          inboundTrackingUrl: input.trackingUrl?.trim() || null,
        },
      });
      if (changed.count !== 1) throw new ConflictException("The project stage changed. Refresh before submitting tracking details.");
      await tx.lapidaryProgressUpdate.create({
        data: { requestId: request.id, title: "Material shipment booked", body: `Customer sent the material using ${input.carrier.trim()} · ${input.trackingNumber.trim()}.`, isCustomerVisible: true },
      });
      await tx.notification.create({
        data: { type: "System", title: `Customer shipped material for ${request.requestNumber}`, body: `${input.carrier.trim()} · ${input.trackingNumber.trim()}`, href: `/admin/lapidary/requests?open=${request.id}`, entityType: "LapidaryRequest", entityId: request.id },
      });
      return tx.lapidaryRequest.findUniqueOrThrow({ where: { id: request.id }, select: { requestNumber: true } });
    });
    return { ok: true, requestNumber: updated.requestNumber };
  }

  async addProgressUpdate(requestId: string, input: CreateLapidaryProgressUpdateDto, files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }> = [], adminId?: string) {
    const request = await this.prisma.lapidaryRequest.findUnique({ where: { id: requestId }, select: { id: true, requestNumber: true, customerId: true, email: true, name: true } });
    if (!request) throw new NotFoundException("Lapidary request not found");
    const uploaded = this.validateRequestMedia(files);
    if (uploaded.some((media) => !media.mimeType.startsWith("image/"))) throw new BadRequestException("Progress updates accept photos only");
    const staged = await this.storeRequestMedia(uploaded);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const update = await tx.lapidaryProgressUpdate.create({
          data: {
            requestId,
            title: input.title.trim(),
            body: input.body.trim(),
            isCustomerVisible: input.isCustomerVisible !== false,
            createdByAdminId: adminId ?? null,
            media: staged.length ? { create: staged.map((media) => ({ storagePath: media.storagePath, originalName: media.originalName, mimeType: media.mimeType, size: media.size })) } : undefined,
          },
          include: { media: { select: { id: true, originalName: true, mimeType: true, size: true } } },
        });
        if (update.isCustomerVisible) {
          const projectUrl = `${publicAppOrigin()}/account/lapidary`;
          const accountAccess = request.customerId
            ? `<p><a href="${escapeHtml(projectUrl)}">Open your project dashboard</a></p>`
            : `<p>To see this project in your account, use the secure project link in your request confirmation email after signing in or creating an account with this same email address.</p>`;
          await this.emailOutbox.enqueue(tx, requestId, `lapidary:${requestId}:progress:${update.id}`, {
            to: request.email,
            subject: `Lapidary progress update — ${request.requestNumber}`,
            html: renderLapidaryEmail("There is a new update on your stone.", `<p>Hello ${escapeHtml(request.name)},</p><p>Project <strong>${escapeHtml(request.requestNumber)}</strong></p><p><strong>${escapeHtml(update.title)}</strong></p><p>${escapeHtml(update.body).replaceAll("\n", "<br>")}</p>${accountAccess}`),
          });
        }
        return update;
      });
    } catch (error) {
      await Promise.all(staged.map((media) => unlink(media.absolutePath).catch(() => undefined)));
      throw error;
    }
  }

  async getProgressMediaForCustomer(customerId: string, requestNumber: string, updateId: string, mediaId: string) {
    const media = await this.prisma.lapidaryProgressMedia.findFirst({
      where: { id: mediaId, updateId, update: { request: { requestNumber, customerId }, isCustomerVisible: true } },
    });
    if (!media) throw new NotFoundException("Lapidary media not found");
    return { ...media, path: this.resolvePrivateMediaPath(media.storagePath) };
  }

  async getProgressMediaForAdmin(requestId: string, updateId: string, mediaId: string) {
    const media = await this.prisma.lapidaryProgressMedia.findFirst({ where: { id: mediaId, updateId, update: { requestId } } });
    if (!media) throw new NotFoundException("Lapidary media not found");
    return { ...media, path: this.resolvePrivateMediaPath(media.storagePath) };
  }

  async getInvoicePaymentProof(requestId: string) {
    const invoice = await this.prisma.lapidaryInvoice.findUnique({ where: { requestId }, select: { paymentProofPath: true, paymentProofMime: true } });
    if (!invoice?.paymentProofPath || !invoice.paymentProofMime) throw new NotFoundException("No bank transfer proof has been uploaded");
    return { path: this.resolvePrivateMediaPath(invoice.paymentProofPath), mimeType: invoice.paymentProofMime };
  }

  async uploadInvoicePaymentProof(customerId: string, requestNumber: string, file?: { originalname: string; mimetype: string; size: number; buffer: Buffer }, revision?: number) {
    if (!file) throw new BadRequestException("Upload a bank transfer receipt");
    const request = await this.prisma.lapidaryRequest.findFirst({ where: { requestNumber, customerId }, select: { id: true, requestNumber: true } });
    if (!request) throw new NotFoundException("Lapidary project not found");
    const invoice = await this.prisma.lapidaryInvoice.findUnique({ where: { requestId: request.id } });
    if (!invoice || invoice.status !== "AwaitingPayment") throw new ConflictException("This project is not awaiting payment");
    if (revision !== invoice.revision) throw new ConflictException("The invoice changed. Refresh before uploading a receipt.");
    const [media] = this.validateRequestMedia([file]);
    if (!media.mimeType.startsWith("image/")) throw new BadRequestException("Bank transfer receipts must be an image");
    const [staged] = await this.storeRequestMedia([media]);
    let replacedProof: string | null = null;
    try {
      await this.withRequestLock(request.id, async (tx) => {
        const current = await tx.lapidaryInvoice.findUnique({ where: { requestId: request.id } });
        if (!current || current.status !== "AwaitingPayment" || current.revision !== invoice.revision) throw new ConflictException("The invoice changed. Refresh it before uploading a receipt.");
        replacedProof = current.paymentProofPath;
        await tx.lapidaryInvoice.update({ where: { id: current.id }, data: { paymentProofPath: staged.storagePath, paymentProofMime: staged.mimeType, paymentProofUploadedAt: new Date() } });
        await tx.notification.create({
          data: { type: "System", title: `Lapidary payment proof uploaded for ${request.requestNumber}`, body: "Review the transfer receipt before marking the invoice paid.", href: `/admin/lapidary/requests?open=${request.id}`, entityType: "LapidaryRequest", entityId: request.id },
        });
      });
    } catch (error) {
      await unlink(staged.absolutePath).catch(() => undefined);
      throw error;
    }
    if (replacedProof) {
      const previous = this.resolvePrivateMediaPath(replacedProof);
      await unlink(previous).catch(() => undefined);
    }
    return { ok: true };
  }

  async markInvoicePaid(requestId: string, context: AuditContext, confirmation: ConfirmLapidaryPaymentDto) {
    const result = await this.withRequestLock(requestId, async (tx) => {
      const invoice = await tx.lapidaryInvoice.findUnique({ where: { requestId }, include: { request: { select: { requestNumber: true, status: true, name: true, email: true } } } });
      if (!invoice) throw new NotFoundException("Lapidary invoice not found");
      if (invoice.status === "Paid") return { paidAt: invoice.paidAt, requestNumber: invoice.request.requestNumber };
      if (invoice.request.status !== "AwaitingPayment" || invoice.status !== "AwaitingPayment" || !invoice.paymentProofPath) throw new ConflictException("Review the current unpaid invoice and customer's receipt before confirming payment");
      if (invoice.revision !== confirmation.revision || !invoice.paymentProofUploadedAt || invoice.paymentProofUploadedAt.toISOString() !== new Date(confirmation.proofUploadedAt).toISOString()) throw new ConflictException("The invoice or receipt changed. Review the current receipt before confirming payment");
      const paidAt = new Date();
      await tx.lapidaryInvoice.update({ where: { id: invoice.id }, data: { status: "Paid", paidAt } });
      await tx.lapidaryProgressUpdate.create({ data: { requestId, title: "Payment confirmed", body: "The studio confirmed receipt of payment and will prepare the return shipment.", isCustomerVisible: true, createdByAdminId: context.adminId } });
      await this.emailOutbox.enqueue(tx, requestId, `lapidary:${requestId}:payment-confirmed:${invoice.id}:v${invoice.revision}`, {
        to: invoice.request.email, subject: `Lapidary payment confirmed — ${invoice.request.requestNumber}`,
        html: renderLapidaryEmail("Payment confirmed.", `<p>Hello ${escapeHtml(invoice.request.name)},</p><p>We confirmed payment for <strong>${escapeHtml(invoice.request.requestNumber)}</strong>. We will prepare your return shipment.</p><p><a href="${publicAppOrigin()}/account/lapidary">Open your project</a></p>`),
      });
      return { paidAt, requestNumber: invoice.request.requestNumber };
    });
    await this.audit.log({ adminId: context.adminId, action: "lapidary_invoice.mark_paid", entityType: "LapidaryRequest", entityId: requestId, summary: `Confirmed payment for ${result.requestNumber}`, ip: context.ip, userAgent: context.userAgent });
    return { ok: true, paidAt: result.paidAt };
  }

  async readiness() {
    let origin: string | null = null;
    let originError: string | null = null;
    try { origin = publicAppOrigin(); } catch (error) { originError = error instanceof Error ? error.message : "Invalid public site URL"; }
    const [pendingEmails, failedEmails] = await Promise.all([
      this.prisma.lapidaryEmailOutbox.count({ where: { status: "Pending" } }),
      this.prisma.lapidaryEmailOutbox.count({ where: { status: "Failed", encryptedPayload: { not: "" } } }),
    ]);
    let privateUploadStorageWritable = false;
    try {
      await mkdir(this.privateUploadDir, { recursive: true, mode: 0o700 });
      await access(this.privateUploadDir, fsConstants.W_OK);
      privateUploadStorageWritable = true;
    } catch {
      // Keep the admin readiness endpoint available when private media storage is unavailable.
    }
    return {
      email: this.email.readiness(), origin, originError, pendingEmails, failedEmails, privateUploadStorageWritable,
      privateUploadStorageNote: "Writable access does not confirm that Coolify uses a persistent volume or that backups can be restored.",
    };
  }

  private async issueCustomerInvitation(requestId: string) {
    if (!this.email.isEnabled() || !this.email.readiness().senderConfigured) throw new ServiceUnavailableException("Configure the email provider and sender before sending a project invitation");
    const origin = publicAppOrigin();
    const result = await this.withRequestLock(requestId, async (tx) => {
      const request = await tx.lapidaryRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException("Lapidary request not found");
      if (request.customerId) throw new ConflictException("This project is already linked to a customer account");
      const lifetime = 30 * 24 * 60 * 60_000;
      if (request.claimTokenExpiresAt && request.claimTokenExpiresAt.getTime() - lifetime > Date.now() - 60_000) throw new ConflictException("Wait one minute before sending another invitation");
      const token = randomBytes(32).toString("base64url");
      const hash = createHash("sha256").update(token).digest("hex");
      await tx.lapidaryRequest.update({ where: { id: requestId }, data: { claimTokenHash: hash, claimTokenExpiresAt: new Date(Date.now() + lifetime) } });
      const accountUrl = `${origin}/account/login?next=${encodeURIComponent(`/account/lapidary?claim=${encodeURIComponent(token)}&request=${encodeURIComponent(request.requestNumber)}`)}`;
      await this.emailOutbox.enqueue(tx, requestId, `lapidary:${requestId}:invitation:${hash.slice(0, 16)}`, {
        to: request.email, claimTokenHash: hash, subject: `Your project account invitation — ${request.requestNumber}`,
        html: renderLapidaryEmail("Your secure project link is ready.", `<p>Hello ${escapeHtml(request.name)},</p><p>Create or sign in to a verified account using the same email as project <strong>${escapeHtml(request.requestNumber)}</strong>. This new link replaces earlier invitations and expires in 30 days.</p><p><a href="${escapeHtml(accountUrl)}">Create account or sign in</a></p>`),
      });
      return { requestNumber: request.requestNumber };
    });
    return result;
  }

  async requestAccessLink(requestNumber: string, email: string) {
    const request = await this.prisma.lapidaryRequest.findUnique({
      where: { requestNumber: requestNumber.trim().toUpperCase() },
      select: { id: true, email: true, customerId: true },
    });
    if (!request || request.email !== email.trim().toLowerCase() || request.customerId) return { ok: true };
    try {
      await this.issueCustomerInvitation(request.id);
    } catch (error) {
      // The response is intentionally identical for mismatches, linked requests, cooldowns, and email failures.
      this.logger.warn(`A lapidary access-link request could not be queued (${error instanceof Error ? error.name : "unknown error"})`);
    }
    return { ok: true };
  }

  async reissueInvitation(requestId: string, context: AuditContext) {
    const result = await this.issueCustomerInvitation(requestId);
    await this.audit.log({ adminId: context.adminId, action: "lapidary_invitation.reissue", entityType: "LapidaryRequest", entityId: requestId, summary: `Reissued account invitation for ${result.requestNumber}`, ip: context.ip, userAgent: context.userAgent });
    return { ok: true };
  }

  async retryCustomerEmails(requestId: string, context: AuditContext) {
    if (!this.email.isEnabled()) throw new ServiceUnavailableException("Email delivery is not configured");
    const request = await this.prisma.lapidaryRequest.findUnique({ where: { id: requestId }, select: { requestNumber: true } });
    if (!request) throw new NotFoundException("Lapidary request not found");
    const retried = await this.prisma.lapidaryEmailOutbox.updateMany({
      where: { requestId, status: "Failed", encryptedPayload: { not: "" } },
      data: { status: "Pending", attempts: 0, availableAt: new Date(), lockedAt: null, lastError: null },
    });
    if (retried.count === 0) throw new ConflictException("There are no failed customer emails available to retry");
    await this.audit.log({
      adminId: context.adminId,
      action: "lapidary_email.retry",
      entityType: "LapidaryRequest",
      entityId: requestId,
      summary: `Retried ${retried.count} customer email${retried.count === 1 ? "" : "s"} for ${request.requestNumber}`,
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return { ok: true, retried: retried.count };
  }

  private async withRequestLock<T>(id: string, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "LapidaryRequest" WHERE "id" = ${id} FOR UPDATE`;
      return operation(tx);
    }, { timeout: 15_000 });
  }

  private async assertSelectedStockAvailable(
    tx: Prisma.TransactionClient,
    items: Array<{ productId: string | null; materialQuantity: Prisma.Decimal | null }>,
  ) {
    const requestedByProduct = new Map<string, number>();
    for (const item of items) {
      if (!item.productId) throw new ConflictException("This stock project no longer has a complete material selection");
      requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + Number(item.materialQuantity ?? 0));
    }
    const productIds = [...requestedByProduct.keys()];
    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        status: "Published",
        sellOnWeb: true,
        category: { slug: { in: ["rough", "slab"] }, isActive: true },
      },
      select: {
        id: true,
        name: true,
        stockModel: true,
        stockQuantity: true,
        variants: { select: { stockQuantity: true } },
      },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    for (const [productId, requested] of requestedByProduct) {
      const product = productById.get(productId);
      if (!product) throw new ConflictException("A selected catalog stone is no longer available. Review the material choice before quoting");
      const available = product.variants.length
        ? product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0)
        : product.stockModel === "Unique" ? 1 : (product.stockQuantity ?? 0);
      if (available <= 0 || requested > available) {
        throw new ConflictException(`The selected stone “${product.name}” no longer has enough available material. Review the request before quoting`);
      }
    }
  }

  async updateRequest(id: string, input: UpdateLapidaryRequestDto, context: AuditContext) {
    const outcome = await this.withRequestLock(id, async (tx) => {
      const previousProof = input.reviseInvoice ? await tx.lapidaryInvoice.findUnique({ where: { requestId: id }, select: { paymentProofPath: true } }) : null;
      const request = await this.updateRequestLocked(tx, id, input, context);
      return { request, obsoleteProof: previousProof?.paymentProofPath && previousProof.paymentProofPath !== request.invoice?.paymentProofPath ? previousProof.paymentProofPath : null };
    });
    if (outcome.obsoleteProof) await Promise.resolve().then(() => unlink(this.resolvePrivateMediaPath(outcome.obsoleteProof!))).catch(() => undefined);
    return outcome.request;
  }

  private async updateRequestLocked(tx: Prisma.TransactionClient, id: string, input: UpdateLapidaryRequestDto, context: AuditContext) {
    const existing = await tx.lapidaryRequest.findUnique({
      where: { id },
      include: {
        invoice: true,
        items: true,
        customer: { select: { name: true, email: true, phone: true, addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true, country: true, countryCode: true } },
      },
    });
    if (!existing) throw new NotFoundException("Lapidary request not found");
    const quoteAmount = input.quoteAmount !== undefined ? input.quoteAmount : existing.quoteAmount;
    if (input.status === "QuoteSent" && quoteAmount === null) {
      throw new BadRequestException("Add a quote amount before sending a quote");
    }
    let nextStatus = input.status ?? existing.status;
    // Cancelling studio work must not lose custody of a customer's stone.
    const returnRequired = existing.materialSource === "CustomerSupplied" && nextStatus === "Cancelled"
      && (Boolean(existing.materialReceivedAt) || existing.status === "MaterialInTransit") && !existing.returnShippedAt;
    if (returnRequired) nextStatus = "ReturnPending";
    const customerMaterial = existing.materialSource === "CustomerSupplied";
    const data: Prisma.LapidaryRequestUpdateInput = {};
    if (input.status !== undefined) data.status = nextStatus;
    if (input.confirmMaterialReceived) {
      if (existing.status !== "ReturnPending") throw new ConflictException("This receipt action is for cancelled material returns");
      data.materialReceivedAt = existing.materialReceivedAt ?? new Date();
    }
    if (returnRequired) {
      if (!input.cancellationReason?.trim()) throw new BadRequestException("Add a cancellation reason and arrange the customer's material return");
      data.workCancelledAt = new Date();
      data.cancellationReason = input.cancellationReason.trim();
    }
    if (input.quoteAmount !== undefined) data.quoteAmount = input.quoteAmount;
    if (input.quoteCurrency != null) data.quoteCurrency = input.quoteCurrency.trim().toUpperCase();
    if (input.estimatedDays !== undefined) data.estimatedDays = input.estimatedDays;
    if (input.adminNotes !== undefined) data.adminNotes = input.adminNotes?.trim() || null;
    if (input.serviceEstimateMin !== undefined) data.serviceEstimateMin = input.serviceEstimateMin;
    if (input.serviceEstimateMax !== undefined) data.serviceEstimateMax = input.serviceEstimateMax;
    if (input.materialShippingInstructions !== undefined) data.materialShippingInstructions = input.materialShippingInstructions?.trim() || null;
    if (input.returnCarrier !== undefined) data.returnCarrier = input.returnCarrier?.trim() || null;
    if (input.returnTrackingNumber !== undefined) data.returnTrackingNumber = input.returnTrackingNumber?.trim() || null;
    if (input.returnTrackingUrl !== undefined) data.returnTrackingUrl = input.returnTrackingUrl?.trim() || null;
    if (input.status && input.status !== "New" && existing.reviewedAt === null) data.reviewedAt = new Date();

    const estimateMin = input.serviceEstimateMin !== undefined ? input.serviceEstimateMin : existing.serviceEstimateMin;
    const estimateMax = input.serviceEstimateMax !== undefined ? input.serviceEstimateMax : existing.serviceEstimateMax;
    const estimateValueChanged = (inputValue: number | null | undefined, existingValue: Prisma.Decimal | null) => inputValue !== undefined
      && (inputValue === null ? existingValue !== null : existingValue === null || Number(inputValue) !== Number(existingValue));
    const estimateCurrency = (input.quoteCurrency ?? existing.quoteCurrency).trim().toUpperCase();
    const estimateChanged = estimateValueChanged(input.serviceEstimateMin, existing.serviceEstimateMin)
      || estimateValueChanged(input.serviceEstimateMax, existing.serviceEstimateMax)
      || estimateCurrency !== existing.quoteCurrency;
    const shippingInstructions = input.materialShippingInstructions !== undefined
      ? input.materialShippingInstructions?.trim() || null
      : existing.materialShippingInstructions;
    const shippingInstructionsChanged = shippingInstructions !== existing.materialShippingInstructions;
    if ((estimateMin === null) !== (estimateMax === null)) {
      throw new BadRequestException("Enter both service estimate values or clear both values");
    }
    if (customerMaterial && estimateChanged) {
      if (["MaterialInTransit", "Completed", "AwaitingPayment", "ReturnShipped", "Delivered", "Cancelled", "Declined"].includes(existing.status)) {
        throw new ConflictException("The service estimate cannot be changed at this project stage");
      }
      if (["MaterialReceived", "EstimateSent", "InProgress"].includes(existing.status) && nextStatus !== "EstimateSent") {
        throw new ConflictException("Set the project to Estimate Sent so the customer can review and accept the revised range");
      }
    }
    if (customerMaterial && shippingInstructionsChanged && !["New", "Reviewing", "QuoteSent", "Approved"].includes(existing.status)) {
      throw new ConflictException("Material shipping instructions can only be changed before the studio receives the stone");
    }
    if (estimateMin !== null && estimateMax !== null && Number(estimateMin) > Number(estimateMax)) {
      throw new BadRequestException("The service estimate maximum must be at least the minimum");
    }
    if (estimateChanged && existing.estimateAcceptedAt) data.estimateAcceptedAt = null;

    if (customerMaterial && nextStatus === "ReturnPending" && !returnRequired && existing.status !== "ReturnPending") throw new BadRequestException("Use Cancelled with a reason to arrange material return");

    const allowed = LAPIDARY_STATUS_TRANSITIONS[existing.materialSource]?.[existing.status] ?? [];
    if (nextStatus !== existing.status && !allowed.includes(nextStatus)) {
      throw new ConflictException(`Cannot move this ${statusLabel(existing.materialSource)} project from ${statusLabel(existing.status)} to ${statusLabel(nextStatus)}`);
    }
    if (!customerMaterial && nextStatus === "Approved" && (existing.status !== "QuoteSent" || quoteAmount === null)) {
      throw new ConflictException("Send a written quote and record the customer's approval before approving this project");
    }
    if (nextStatus !== existing.status && (input.statusReason?.trim().length ?? 0) < 5) {
      throw new BadRequestException("Add an internal reason of at least 5 characters when changing the project status");
    }
    if (existing.materialSource === "RendiVirgoStock" && nextStatus !== existing.status && ["QuoteSent", "Approved"].includes(nextStatus)) {
      await this.assertSelectedStockAvailable(tx, existing.items);
    }

    if (customerMaterial && nextStatus === "Approved") {
      if (estimateMin === null || estimateMax === null) throw new BadRequestException("Add the service estimate range before approving this customer supplied stone");
      if (!shippingInstructions?.trim()) throw new BadRequestException("Add the studio address and material shipping instructions before approving this request");
    }
    if (customerMaterial && nextStatus === "EstimateSent" && (existing.status !== "EstimateSent" || estimateChanged)) {
      if (estimateMin === null || estimateMax === null) throw new BadRequestException("Add both estimate values before sending the updated estimate");
      if (existing.status !== "MaterialReceived" && existing.status !== "InProgress" && existing.status !== "EstimateSent") throw new ConflictException("An updated estimate can only be sent after the material has arrived");
    }
    if (customerMaterial && nextStatus === "InProgress") {
      if (!existing.materialReceivedAt) throw new ConflictException("Confirm receipt of the customer's material before starting work");
      if (!existing.estimateAcceptedAt || estimateChanged) throw new ConflictException("The customer must accept the current estimate before work begins");
    }
    if (customerMaterial && nextStatus === "AwaitingPayment" && (existing.status !== "AwaitingPayment" || input.reviseInvoice)) {
      if (!["Completed", "ReturnPending", "AwaitingPayment"].includes(existing.status)) throw new ConflictException("Complete the work or arrange the cancelled material return before issuing an invoice");
      if (existing.workCancelledAt && !existing.materialReceivedAt && !input.confirmMaterialReceived) throw new ConflictException("Confirm receipt of the cancelled material before arranging its return invoice");
      if (input.reviseInvoice && (existing.status !== "AwaitingPayment" || !existing.invoice || !input.invoiceRevisionReason?.trim())) throw new BadRequestException("Revise only an unpaid invoice and include a reason");
      if (!existing.workCancelledAt && (!existing.estimateAcceptedAt || estimateChanged)) throw new ConflictException("The customer must accept the current service estimate before work can be invoiced");
      if (existing.workCancelledAt && input.invoiceServiceAmount !== 0) throw new ConflictException("A cancelled material return invoice must have zero service fee; agree any separate work charges with the customer first");
      if (input.invoiceServiceAmount == null || input.invoiceReturnShippingAmount == null) {
        throw new BadRequestException("Enter both the final service fee and return shipping fee to issue the invoice");
      }
      if (estimateMax !== null && input.invoiceServiceAmount > Number(estimateMax)) {
        throw new ConflictException("The final service fee exceeds the accepted maximum. Keep the invoice within the accepted limit; additional work requires a revised estimate approved before completion");
      }
      if (!existing.customerId) throw new ConflictException("Link the verified customer account before issuing the final invoice");
      const returnAddress = existing.customer;
      if (!returnAddress?.addressLine1?.trim() || !returnAddress.city?.trim() || !returnAddress.postalCode?.trim() || !(returnAddress.country?.trim() || returnAddress.countryCode?.trim())) {
        throw new ConflictException("Ask the customer to complete their delivery address in their account before issuing the return shipping invoice");
      }
      const invoiceCurrency = (input.invoiceCurrency ?? estimateCurrency).trim().toUpperCase();
      if (invoiceCurrency !== existing.quoteCurrency.trim().toUpperCase()) {
        throw new ConflictException("The final invoice must use the same currency as the customer accepted service estimate");
      }
      if (existing.invoice?.status === "Paid") throw new ConflictException("This lapidary invoice is already paid");
    }
    const finalCarrier = input.returnCarrier !== undefined ? input.returnCarrier?.trim() : existing.returnCarrier?.trim();
    const finalTracking = input.returnTrackingNumber !== undefined ? input.returnTrackingNumber?.trim() : existing.returnTrackingNumber?.trim();
    if (customerMaterial && existing.returnShippedAt && (!finalCarrier || !finalTracking)) throw new BadRequestException("Keep the return carrier and tracking number after dispatch");
    const trackingCorrected = Boolean(existing.returnShippedAt) && (
      (input.returnCarrier !== undefined && finalCarrier !== existing.returnCarrier)
      || (input.returnTrackingNumber !== undefined && finalTracking !== existing.returnTrackingNumber)
      || (input.returnTrackingUrl !== undefined && (input.returnTrackingUrl?.trim() || null) !== existing.returnTrackingUrl));
    const receivedCancelledMaterial = input.confirmMaterialReceived && !existing.materialReceivedAt;
    if (customerMaterial && nextStatus === "ReturnShipped") {
      if (existing.invoice?.status !== "Paid") throw new ConflictException("Confirm payment before shipping the finished stone back");
      if (!(input.returnCarrier !== undefined ? input.returnCarrier?.trim() : existing.returnCarrier?.trim()) || !(input.returnTrackingNumber !== undefined ? input.returnTrackingNumber?.trim() : existing.returnTrackingNumber?.trim())) {
        throw new BadRequestException("Add the return carrier and tracking number before marking the parcel shipped");
      }
      if (existing.status !== "ReturnShipped") data.returnShippedAt = new Date();
    }
    const voidInvoice = customerMaterial && ["Cancelled", "ReturnPending"].includes(nextStatus) && existing.invoice?.status === "AwaitingPayment";
    if (customerMaterial && ["Cancelled", "ReturnPending"].includes(nextStatus) && existing.invoice?.status === "Paid") {
      throw new ConflictException("A paid lapidary invoice cannot be cancelled. Contact the customer and handle any refund separately.");
    }
    if (customerMaterial && nextStatus === "Delivered") {
      if (existing.status !== "Delivered") {
        if (existing.status !== "ReturnShipped") throw new ConflictException("The return parcel must be shipped before it can be marked delivered");
        data.deliveredAt = new Date();
      }
    }

    let claimToken: string | null = null;
    const approvalNoticeChanged = nextStatus === "Approved"
      && (existing.status !== "Approved" || estimateChanged || shippingInstructionsChanged);
    if (customerMaterial && approvalNoticeChanged && (!this.email.isEnabled() || !this.email.readiness().senderConfigured)) throw new ServiceUnavailableException("Configure email delivery before approving the project or sending studio instructions");
    const hasActiveClaimLink = Boolean(existing.claimTokenHash && existing.claimTokenExpiresAt && existing.claimTokenExpiresAt > new Date());
    if (customerMaterial && approvalNoticeChanged && !existing.customerId && !hasActiveClaimLink) {
      claimToken = randomBytes(32).toString("base64url");
      data.claimTokenHash = createHash("sha256").update(claimToken).digest("hex");
      data.claimTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
    }
    if (customerMaterial && nextStatus === "MaterialReceived" && existing.status !== "MaterialReceived") data.materialReceivedAt = new Date();

    const request = await (async () => {
      const updated = await tx.lapidaryRequest.update({ where: { id }, data });
      if (voidInvoice && existing.invoice) {
        await tx.lapidaryInvoice.update({ where: { id: existing.invoice.id }, data: { status: "Void" } });
      }
      if (nextStatus !== existing.status || receivedCancelledMaterial || trackingCorrected || (customerMaterial && estimateChanged) || (customerMaterial && nextStatus === "Approved" && shippingInstructionsChanged)) {
        let body: string;
        if (trackingCorrected) {
          body = `Return tracking corrected to ${finalCarrier} · ${finalTracking}.`;
        } else if (receivedCancelledMaterial) {
          body = "The studio confirmed receipt of the cancelled material and is arranging its return.";
        } else if (nextStatus === "Approved") {
          body = existing.status === "Approved"
            ? estimateChanged
              ? "The studio revised the service estimate. Customer approval is required before work begins."
              : "The studio updated material shipping instructions."
            : "The studio approved the project and sent material delivery instructions.";
        } else if (estimateChanged) {
          body = `The service estimate was revised to ${estimateCurrency} ${Number(estimateMin).toFixed(2)}–${Number(estimateMax).toFixed(2)}. Customer approval is required before work continues.`;
        } else if (nextStatus === "MaterialReceived") {
          body = "The studio confirmed receipt of the customer's material.";
        } else {
          body = nextStatus === "ReturnPending" ? `Studio work cancelled. Material return is being arranged. ${input.cancellationReason?.trim() || ""}` : `Project status updated to ${statusLabel(nextStatus)}.`;
        }
        const progressTitle = trackingCorrected ? "Return tracking corrected" : receivedCancelledMaterial ? "Material received for return" : estimateChanged
          ? "Updated service estimate"
          : nextStatus === "Approved" && existing.status === "Approved"
            ? "Material shipping instructions updated"
            : statusLabel(nextStatus);
        await tx.lapidaryProgressUpdate.create({
          data: {
            requestId: id,
            title: progressTitle,
            body,
            isCustomerVisible: true,
            createdByAdminId: context.adminId,
          },
        });
      }

      if (customerMaterial && nextStatus === "AwaitingPayment" && (existing.status !== "AwaitingPayment" || input.reviseInvoice)) {
        const currency = (input.invoiceCurrency ?? estimateCurrency).trim().toUpperCase();
        const serviceAmount = input.invoiceServiceAmount!;
        const returnShippingAmount = input.invoiceReturnShippingAmount!;
        const returnAddress = existing.customer!;
        const invoiceData = {
            requestId: id,
            currency,
            serviceAmount,
            returnShippingAmount,
            totalAmount: Math.round((serviceAmount + returnShippingAmount) * 100) / 100,
            status: serviceAmount + returnShippingAmount === 0 ? "Paid" as const : "AwaitingPayment" as const,
            paidAt: serviceAmount + returnShippingAmount === 0 ? new Date() : null,
            returnRecipientName: returnAddress.name,
            returnPhone: returnAddress.phone || existing.phone,
            returnAddressLine1: returnAddress.addressLine1,
            returnAddressLine2: returnAddress.addressLine2,
            returnCity: returnAddress.city,
            returnState: returnAddress.state,
            returnPostalCode: returnAddress.postalCode,
            returnCountry: returnAddress.country,
            returnCountryCode: returnAddress.countryCode,
        };
        if (existing.invoice) {
          if (existing.invoice.status === "Paid") throw new ConflictException("A paid invoice cannot be revised");
          await tx.lapidaryInvoice.update({ where: { id: existing.invoice.id }, data: {
            ...invoiceData, revision: { increment: 1 }, revisionReason: input.invoiceRevisionReason?.trim() || "Cancelled material return",
            paymentProofPath: null, paymentProofMime: null, paymentProofUploadedAt: null,
          } });
          await tx.auditLog.create({ data: {
            adminId: context.adminId ?? null, action: "lapidary_invoice.revise", entityType: "LapidaryRequest", entityId: id,
            summary: `Revised invoice for ${existing.requestNumber}: ${input.invoiceRevisionReason?.trim() || "Cancelled material return"}`,
            metadata: { previousRevision: existing.invoice.revision, previousServiceAmount: String(existing.invoice.serviceAmount), previousReturnShippingAmount: String(existing.invoice.returnShippingAmount), previousTotal: String(existing.invoice.totalAmount), previousAddress: [existing.invoice.returnRecipientName, existing.invoice.returnAddressLine1, existing.invoice.returnAddressLine2, existing.invoice.returnCity, existing.invoice.returnState, existing.invoice.returnPostalCode, existing.invoice.returnCountry].filter(Boolean).join(", "), nextServiceAmount: serviceAmount, nextReturnShippingAmount: returnShippingAmount, nextTotal: invoiceData.totalAmount, nextAddress: [returnAddress.name, returnAddress.addressLine1, returnAddress.addressLine2, returnAddress.city, returnAddress.state, returnAddress.postalCode, returnAddress.country].filter(Boolean).join(", ") },
          } });
          await tx.lapidaryProgressUpdate.create({ data: { requestId: id, title: "Invoice revised", body: input.invoiceRevisionReason?.trim() || "A return shipping invoice was prepared for the cancelled work.", isCustomerVisible: true, createdByAdminId: context.adminId } });
        } else {
          await tx.lapidaryInvoice.create({ data: invoiceData });
        }
      }

      if (customerMaterial && approvalNoticeChanged) {
        const baseUrl = publicAppOrigin();
        const nextPath = claimToken
          ? `/account/lapidary?claim=${encodeURIComponent(claimToken)}&request=${encodeURIComponent(updated.requestNumber)}`
          : "/account/lapidary";
        const accountUrl = `${baseUrl}/account/login?next=${encodeURIComponent(nextPath)}`;
        const accountAccessInstructions = !claimToken && !existing.customerId
          ? `<p>Use the secure project link in our request confirmation email to link this project to your account. Sign in or create an account using the same email address as this request. If that link expires, request another from the account sign-in page using your project reference.</p>`
          : "";
        const accountLinkLabel = claimToken ? "Create account or sign in" : existing.customerId ? "Open your project account" : "Sign in to your account";
        const emailInstructions = (shippingInstructions || "").split("\n").map(escapeHtml).join("<br>");
        const customerEmail = renderLapidaryEmail("Your stone can be sent to our studio.", `<p>Hello ${escapeHtml(updated.name)},</p><p>Your customer supplied stone project <strong>${escapeHtml(updated.requestNumber)}</strong> has been approved for studio intake.</p><p><strong>Service estimate range:</strong> ${escapeHtml(updated.quoteCurrency)} ${Number(updated.serviceEstimateMin).toFixed(2)}–${Number(updated.serviceEstimateMax).toFixed(2)}. The final service fee will be set after the work is complete and will not exceed the accepted maximum unless you approve a revised estimate. Return shipping is calculated at completion and included as a separate invoice line.</p><p><strong>Ship your stone to:</strong><br>${emailInstructions}</p><p>Please pay the shipment to the studio yourself, use protective packaging and include your project reference ${escapeHtml(updated.requestNumber)} inside the parcel. Accept the estimate and enter your carrier and tracking number in your account before dispatch.</p>${accountAccessInstructions}<p><a href="${escapeHtml(accountUrl)}" style="display:inline-block;margin-top:8px;padding:12px 18px;background:#183e30;color:#fffdf8;text-decoration:none">${accountLinkLabel}</a></p>`);
        await this.emailOutbox.enqueue(tx, id, `lapidary:${id}:approved:${randomBytes(12).toString("hex")}`, {
          to: updated.email,
          ...(claimToken ? { claimTokenHash: createHash("sha256").update(claimToken).digest("hex") } : {}),
          subject: `Studio approval and shipping instructions — ${updated.requestNumber}`,
          html: customerEmail,
        });
      } else if (customerMaterial && nextStatus === "EstimateSent" && (nextStatus !== existing.status || estimateChanged)) {
        await this.emailOutbox.enqueue(tx, id, `lapidary:${id}:estimate:${randomBytes(12).toString("hex")}`, {
          to: updated.email,
          subject: `Updated lapidary estimate — ${updated.requestNumber}`,
          html: renderLapidaryEmail("Please review the updated estimate.", `<p>The studio updated the service estimate for <strong>${escapeHtml(updated.requestNumber)}</strong> to ${escapeHtml(updated.quoteCurrency)} ${Number(updated.serviceEstimateMin).toFixed(2)}–${Number(updated.serviceEstimateMax).toFixed(2)}. Please sign in to review and accept the current range before work continues.</p><p><a href="${escapeHtml(publicAppOrigin() + "/account/lapidary")}">Open your lapidary project</a></p>`),
        });
      } else if (customerMaterial && nextStatus === "AwaitingPayment" && (nextStatus !== existing.status || input.reviseInvoice)) {
        const invoice = await tx.lapidaryInvoice.findUniqueOrThrow({ where: { requestId: id } });
        await this.emailOutbox.enqueue(tx, id, `lapidary:${id}:invoice:${invoice.id}:v${invoice.revision}`, {
          to: updated.email,
          subject: `${updated.workCancelledAt ? "Material return invoice" : input.reviseInvoice ? "Revised lapidary invoice" : "Final lapidary invoice"} — ${updated.requestNumber}`,
          html: renderLapidaryEmail(updated.workCancelledAt ? "Your material return invoice is ready." : "Your final invoice is ready.", `<p>Hello ${escapeHtml(updated.name)},</p><p>${updated.workCancelledAt ? "The studio is arranging the return of your material for" : "The studio completed the work for"} <strong>${escapeHtml(updated.requestNumber)}</strong>. Your final invoice separates the lapidary service from return shipping.</p><p>Service: ${escapeHtml(invoice.currency)} ${Number(invoice.serviceAmount).toFixed(2)}<br>Return shipping: ${escapeHtml(invoice.currency)} ${Number(invoice.returnShippingAmount).toFixed(2)}<br><strong>Total due: ${escapeHtml(invoice.currency)} ${Number(invoice.totalAmount).toFixed(2)}</strong></p><p>${Number(invoice.totalAmount) === 0 ? "No payment is required. The studio will arrange the return shipment." : "Sign in to view bank transfer instructions and upload your payment receipt. We will arrange the return after payment is confirmed."}</p><p><a href="${escapeHtml(publicAppOrigin() + "/account/lapidary")}">View invoice</a></p>`),
        });
      } else if (customerMaterial && nextStatus === "ReturnShipped" && nextStatus !== existing.status) {
        await this.emailOutbox.enqueue(tx, id, `lapidary:${id}:return-shipped:${randomBytes(12).toString("hex")}`, {
          to: updated.email,
          subject: `Your finished stone is on its way — ${updated.requestNumber}`,
          html: renderLapidaryEmail("Your finished stone has shipped.", `<p>The return parcel for <strong>${escapeHtml(updated.requestNumber)}</strong> has been handed to ${escapeHtml(updated.returnCarrier ?? input.returnCarrier ?? "the carrier")}.</p><p>Tracking: ${escapeHtml(updated.returnTrackingNumber ?? input.returnTrackingNumber ?? "")}${updated.returnTrackingUrl ? ` · <a href="${escapeHtml(updated.returnTrackingUrl)}">Track parcel</a>` : ""}</p><p>View the project dashboard for progress updates and delivery details.</p>`),
        });
      } else if (trackingCorrected) {
        await this.emailOutbox.enqueue(tx, id, `lapidary:${id}:tracking-correction:${randomBytes(12).toString("hex")}`, {
          to: updated.email, subject: `Return tracking corrected — ${updated.requestNumber}`,
          html: renderLapidaryEmail("Your return tracking was updated.", `<p>Tracking for <strong>${escapeHtml(updated.requestNumber)}</strong>: ${escapeHtml(finalCarrier || "")} · ${escapeHtml(finalTracking || "")}</p><p><a href="${publicAppOrigin()}/account/lapidary">View your project</a></p>`),
        });
      } else if (nextStatus !== existing.status) {
        const quote = updated.quoteAmount === null ? "" : `<p>Quote: <strong>${escapeHtml(updated.quoteCurrency)} ${Number(updated.quoteAmount).toFixed(2)}</strong></p>`;
        const turnaround = updated.estimatedDays ? `<p>Estimated studio time: ${updated.estimatedDays} days after material and scope are confirmed.</p>` : "";
        await this.emailOutbox.enqueue(tx, id, `lapidary:${id}:status:${randomBytes(12).toString("hex")}`, {
          to: updated.email,
          subject: nextStatus === "QuoteSent" ? `Your Lapidary quote — ${updated.requestNumber}` : `Lapidary request update — ${updated.requestNumber}`,
          html: renderLapidaryEmail("Your project has an update.", `<p>Hello ${escapeHtml(updated.name)},</p><p>Your request <strong>${escapeHtml(updated.requestNumber)}</strong> is now ${escapeHtml(statusLabel(updated.status))}.</p>${quote}${turnaround}<p>${updated.status === "QuoteSent" ? "Reply to this email to discuss or approve the quote. Work begins after you approve it and the studio confirms material arrangements." : "Reply to this email if you have questions about the next step."}</p>`),
        });
      }

      return tx.lapidaryRequest.findUniqueOrThrow({ where: { id }, include: { invoice: true } });
    })();

    await this.audit.log({
      adminId: context.adminId,
      action: "lapidary_request.update",
      entityType: "LapidaryRequest",
      entityId: id,
      summary: `Updated ${request.requestNumber} to ${statusLabel(request.status)}`,
      metadata: {
        previousStatus: existing.status,
        status: request.status,
        statusReason: input.statusReason?.trim() || null,
        quoteAmount: request.quoteAmount ? Number(request.quoteAmount) : null,
      },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return request;
  }

  async adminContent() {
    const [setting, heroSetting, presentationSetting, processSetting, artistsPresentationSetting, artists] = await Promise.all([
      this.prisma.siteSetting.findUnique({ where: { key: STUDIO_IMAGES_KEY } }),
      this.prisma.siteSetting.findUnique({ where: { key: STUDIO_HERO_IMAGE_KEY } }),
      this.prisma.siteSetting.findUnique({ where: { key: STUDIO_PRESENTATION_KEY } }),
      this.prisma.siteSetting.findUnique({ where: { key: PROCESS_PRESENTATION_KEY } }),
      this.prisma.siteSetting.findUnique({ where: { key: ARTISTS_PRESENTATION_KEY } }),
      this.prisma.lapidaryArtist.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    ]);
    return {
      domeSettings: await this.domeSettings(),
      servicePricing: await this.servicePricing(),
      studioHeroImage: typeof heroSetting?.value === "string" && heroSetting.value ? heroSetting.value : DEFAULT_STUDIO_HERO_IMAGE,
      studioImages: studioImages(setting?.value),
      studioPresentation: studioPresentation(presentationSetting?.value),
      processPresentation: processPresentation(processSetting?.value),
      artistsPresentation: artistsPresentation(artistsPresentationSetting?.value),
      artists,
    };
  }

  async saveArtistsPresentation(input: SaveLapidaryArtistsPresentationDto, context: AuditContext) {
    const cleaned = trimJsonStrings(input) as SaveLapidaryArtistsPresentationDto;
    const textFields = Object.entries(cleaned)
      .filter(([key]) => !key.endsWith("Id") && !["motionEnabled", "heroImagePosition", "visualStyle", "ctaTarget", "detailCtaTarget"].includes(key))
      .map(([, value]) => value);
    if (textFields.some((value) => typeof value !== "string" || value.trim().length < 2)) {
      throw new BadRequestException("All Artists page text fields must contain at least two non-space characters");
    }
    this.validateImageUrls([cleaned.heroImage]);
    const presentation = artistsPresentation(cleaned);
    await this.prisma.siteSetting.upsert({
      where: { key: ARTISTS_PRESENTATION_KEY },
      create: { key: ARTISTS_PRESENTATION_KEY, value: presentation as Prisma.InputJsonValue },
      update: { value: presentation as Prisma.InputJsonValue },
    });
    await this.audit.log({ adminId: context.adminId, action: "lapidary_artists_presentation.update", entityType: "SiteSetting", entityId: ARTISTS_PRESENTATION_KEY, summary: "Updated Lapidary Artists page presentation", metadata: { visualStyle: presentation.visualStyle, motionEnabled: presentation.motionEnabled }, ip: context.ip, userAgent: context.userAgent });
    return presentation;
  }

  async saveProcess(input: SaveLapidaryProcessDto, context: AuditContext) {
    const cleaned = trimJsonStrings(input) as SaveLapidaryProcessDto;
    if (!hasValidProcessText(cleaned)) throw new BadRequestException("All process page text fields must contain at least two non-space characters");
    this.validateImageUrls([cleaned.heroImage]);
    const presentation = processPresentation(cleaned);
    await this.prisma.siteSetting.upsert({
      where: { key: PROCESS_PRESENTATION_KEY },
      create: { key: PROCESS_PRESENTATION_KEY, value: presentation as Prisma.InputJsonValue },
      update: { value: presentation as Prisma.InputJsonValue },
    });
    await this.audit.log({ adminId: context.adminId, action: "lapidary_process.update", entityType: "SiteSetting", entityId: PROCESS_PRESENTATION_KEY, summary: "Updated Lapidary process page presentation", metadata: { stepCount: presentation.phases.reduce((total, phase) => total + phase.steps.length, 0), visualStyle: presentation.visualStyle, layout: presentation.layout }, ip: context.ip, userAgent: context.userAgent });
    return presentation;
  }

  async saveStudio(input: SaveLapidaryStudioDto, context: AuditContext) {
    this.validateImageUrls([input.heroImage, ...input.images.map((image) => image.url)]);
    const images = input.images.map((image) => ({
      url: image.url.trim(),
      altEn: image.altEn.trim(),
      altId: image.altId?.trim() ?? "",
      captionEn: image.captionEn?.trim() ?? "",
      captionId: image.captionId?.trim() ?? "",
    }));
    if (new Set(images.map((image) => image.url)).size !== images.length) {
      throw new BadRequestException("Each gallery photograph must be unique");
    }
    if (images.some((image) => image.url === input.heroImage.trim())) {
      throw new BadRequestException("Choose a hero photograph that is different from the gallery photos");
    }
    if (images.some((image) => image.altEn.length < 2)) {
      throw new BadRequestException("Every gallery photograph needs English alt text");
    }
    const presentation = studioPresentation({
      titleEn: input.titleEn?.trim(), titleId: input.titleId?.trim(), introEn: input.introEn?.trim(), introId: input.introId?.trim(),
      galleryTitleEn: input.galleryTitleEn?.trim(), galleryTitleId: input.galleryTitleId?.trim(), visualStyle: input.visualStyle,
      eyebrowEn: input.eyebrowEn?.trim(), eyebrowId: input.eyebrowId?.trim(), galleryEyebrowEn: input.galleryEyebrowEn?.trim(), galleryEyebrowId: input.galleryEyebrowId?.trim(),
      ctaLabelEn: input.ctaLabelEn?.trim(), ctaLabelId: input.ctaLabelId?.trim(), approachTitleEn: input.approachTitleEn?.trim(), approachTitleId: input.approachTitleId?.trim(),
      approachEyebrowEn: input.approachEyebrowEn?.trim(), approachEyebrowId: input.approachEyebrowId?.trim(),
      approachPointsEn: input.approachPointsEn?.map((point) => point.trim()).filter(Boolean), approachPointsId: input.approachPointsId?.map((point) => point.trim()).filter(Boolean),
      photoCountLabelEn: input.photoCountLabelEn?.trim(), photoCountLabelId: input.photoCountLabelId?.trim(),
      backLabelEn: input.backLabelEn?.trim(), backLabelId: input.backLabelId?.trim(),
      ctaTarget: input.ctaTarget, heroImagePosition: input.heroImagePosition,
      metaTitleEn: input.metaTitleEn?.trim(), metaTitleId: input.metaTitleId?.trim(),
      metaDescriptionEn: input.metaDescriptionEn?.trim(), metaDescriptionId: input.metaDescriptionId?.trim(),
      motionEnabled: input.motionEnabled,
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.siteSetting.upsert({
        where: { key: STUDIO_IMAGES_KEY },
        create: { key: STUDIO_IMAGES_KEY, value: images as Prisma.InputJsonValue },
        update: { value: images as Prisma.InputJsonValue },
      });
      await tx.siteSetting.upsert({
        where: { key: STUDIO_HERO_IMAGE_KEY },
        create: { key: STUDIO_HERO_IMAGE_KEY, value: input.heroImage.trim() as Prisma.InputJsonValue },
        update: { value: input.heroImage.trim() as Prisma.InputJsonValue },
      });
      await tx.siteSetting.upsert({
        where: { key: STUDIO_PRESENTATION_KEY },
        create: { key: STUDIO_PRESENTATION_KEY, value: presentation as Prisma.InputJsonValue },
        update: { value: presentation as Prisma.InputJsonValue },
      });
    });
    await this.audit.log({ adminId: context.adminId, action: "lapidary_studio.update", entityType: "SiteSetting", entityId: STUDIO_IMAGES_KEY, summary: "Updated Lapidary studio gallery and presentation", metadata: { imageCount: images.length, visualStyle: presentation.visualStyle, motionEnabled: presentation.motionEnabled }, ip: context.ip, userAgent: context.userAgent });
    return { images, heroImage: input.heroImage.trim(), presentation };
  }

  async saveArtist(id: string | null, input: SaveLapidaryArtistDto, context: AuditContext) {
    const existing = id ? await this.prisma.lapidaryArtist.findUnique({ where: { id } }) : null;
    if (id && !existing) throw new NotFoundException("Artist profile not found");
    const portfolioImages = input.portfolioImages ?? (existing?.portfolioImages as unknown as SaveLapidaryArtistDto["portfolioImages"] | null) ?? [];
    if (new Set(portfolioImages.map((image) => image.url.trim())).size !== portfolioImages.length) {
      throw new BadRequestException("Each portfolio photograph must be unique");
    }
    const imageUrls = [input.imageUrl, ...portfolioImages.map((image) => image.url)].filter((url): url is string => Boolean(url));
    this.validateImageUrls(imageUrls);
    const slug = (input.slug?.trim() || existing?.slug || input.name)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 160);
    if (!slug) throw new BadRequestException("Add a valid profile URL slug");
    const slugOwner = await this.prisma.lapidaryArtist.findUnique({ where: { slug }, select: { id: true } });
    if (slugOwner && slugOwner.id !== id) throw new ConflictException("That artist profile URL is already in use");
    const data = {
      slug,
      name: input.name.trim(),
      role: input.role?.trim() || existing?.role || "Lapidary Artist",
      roleId: input.roleId?.trim() || existing?.roleId || null,
      signatureStyle: input.signatureStyle?.trim() || null,
      signatureStyleId: input.signatureStyleId?.trim() || null,
      location: input.location?.trim() || null,
      bio: input.bio.trim(),
      bioId: input.bioId?.trim() || null,
      experienceEn: input.experienceEn?.trim() || null,
      experienceId: input.experienceId?.trim() || null,
      specialties: input.specialties ? input.specialties.map((item) => item.trim()).filter(Boolean) : existing?.specialties ?? [],
      stoneExperienceEn: (input.stoneExperienceEn ?? []).map((item) => item.trim()).filter(Boolean),
      stoneExperienceId: (input.stoneExperienceId ?? []).map((item) => item.trim()).filter(Boolean),
      imageUrl: input.imageUrl?.trim() || null,
      imageAltEn: input.imageAltEn?.trim() || null,
      imageAltId: input.imageAltId?.trim() || null,
      imagePosition: input.imagePosition ?? "center",
      portfolioImages: portfolioImages as unknown as Prisma.InputJsonValue,
      isPublished: input.isPublished,
      sortOrder: input.sortOrder,
    };
    const artist = id
      ? await this.prisma.lapidaryArtist.update({ where: { id }, data })
      : await this.prisma.lapidaryArtist.create({ data });
    await this.audit.log({ adminId: context.adminId, action: id ? "lapidary_artist.update" : "lapidary_artist.create", entityType: "LapidaryArtist", entityId: artist.id, summary: `${id ? "Updated" : "Created"} Lapidary artist ${artist.name}`, metadata: { isPublished: artist.isPublished }, ip: context.ip, userAgent: context.userAgent });
    return artist;
  }

  async deleteArtist(id: string, context: AuditContext) {
    const existing = await this.prisma.lapidaryArtist.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Artist profile not found");
    await this.prisma.lapidaryArtist.delete({ where: { id } });
    await this.audit.log({ adminId: context.adminId, action: "lapidary_artist.delete", entityType: "LapidaryArtist", entityId: id, summary: `Deleted Lapidary artist ${existing.name}`, ip: context.ip, userAgent: context.userAgent });
    return { ok: true };
  }

  private validateImageUrls(urls: string[]) {
    if (urls.some((url) => !/^\/(?:uploads|images)\//.test(url) && !/^https?:\/\//.test(url))) {
      throw new BadRequestException("Use an uploaded image or an HTTP(S) image URL");
    }
  }
}
