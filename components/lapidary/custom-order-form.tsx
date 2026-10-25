"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Language } from "@/lib/i18n";
import { FilterDropdown } from "@/components/filter-dropdown";
import { CountryDropdown } from "@/components/country-dropdown";
import { CountryCallingCodeDropdown } from "@/components/country-calling-code-dropdown";
import { LapidaryDatePicker } from "@/components/lapidary/date-picker";
import { COUNTRY_CALLING_CODES, countryFlagEmoji, internationalPhoneNumber } from "@/lib/country-calling-codes";
import { countryNameForCode } from "@/lib/countries";
import { Cabochon3DPreview, type CabochonShape } from "./oval-cabochon-preview";
import { cabochonShapes, standardCabochonKeys, cabochonAssetVersion } from "@/lib/lapidary-shapes";

import { defaultDomeSettings, type DomeSettings } from "@/lib/lapidary-dome-settings";
import { defaultLapidaryServicePricing, type LapidaryServicePricing } from "@/lib/lapidary-service-pricing";

type Submission = { ok: true; requestNumber: string; accountLinked?: boolean };
type LapidaryCustomerProfile = {
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  phone: string | null;
  address?: { countryCode: string | null };
};
type MaterialSource = "CustomerSupplied" | "RendiVirgoStock" | "Undecided";
type ServiceType = "CabochonPendant" | "CabochonPair" | "CabochonSuite" | "CabochonFreeform" | "SlabPolishing" | "DecorationSphere" | "DecorationTower" | "DecorationTumbled" | "DecorationSpear" | "DecorationOther" | "Faceting" | "Reshaping" | "Other";
type ShapeKey = CabochonShape | "custom";
type SuiteComponent = { key: "Pendant" | "MatchingPair"; shapeKey: ShapeKey | ""; desiredShape: string; lengthMm: string; widthMm: string; depthMm: string };
type WorkItem = { domeProfile?: string; domeHeightMm?: number; id: string; serviceType: ServiceType; workDescription: string; shapeKey: ShapeKey | ""; desiredShape: string; lengthMm: string; widthMm: string; depthMm: string; quantity: string; productId: string; materialQuantity: string; components: SuiteComponent[] };
type Product = { id: string; slug: string; sku: string; name: string; stoneType: string; origin: string; categorySlug: string; price: number | string; currency: string; unit: string; stockModel: string; stockQuantity: number; weightGram: number; imageUrls: string[]; inStock: boolean };
type CustomOrderDraft = {
  version: 1; savedAt: string; step: number; source: MaterialSource; materialDescription: string; materialOrigin: string; materialCondition: string; materialWeight: string; weightUnit: "g" | "kg"; items: WorkItem[]; selectedCatalogIds: string[]; finish: string; customFinish: string; additionalDetails: string; referenceLinks: string; targetDate: string;
};
const DRAFT_KEY = "rendi-lapidary-custom-order:v1";
const phonePattern = /^\+[1-9]\d{7,14}$/;
const phoneRegionsByCallingCode = Object.entries(COUNTRY_CALLING_CODES).sort((left, right) => right[1].length - left[1].length);
const primaryRegionsByCallingCode: Readonly<Record<string, string>> = { "1": "US", "7": "RU", "44": "GB", "61": "AU", "262": "RE", "358": "FI", "590": "GP", "599": "CW" };
const shapeKeys: ShapeKey[] = [...standardCabochonKeys, "custom"];

const steps = [
  { en: "Material", id: "Material" },
  { en: "Work", id: "Pengerjaan" },
  { en: "Shape & quantity", id: "Bentuk & jumlah" },
  { en: "Finish & references", id: "Finishing & referensi" },
  { en: "Contact & review", id: "Kontak & ringkasan" },
];

const serviceChoices: Array<{ value: ServiceType; en: string; id: string; groupEn: string; groupId: string }> = [
  { value: "CabochonPendant", en: "Cabochons – Pendant", id: "Cabochons – Pendant", groupEn: "Cabochons", groupId: "Cabochon" },
  { value: "CabochonPair", en: "Cabochons – Matched Pairs", id: "Cabochons – Matched Pairs", groupEn: "Cabochons", groupId: "Cabochon" },
  { value: "Other", en: "Other", id: "Lainnya", groupEn: "Other services", groupId: "Layanan lain" },
];

const shapeOptions: Array<{ value: ShapeKey; en: string; id: string }> = [
  ...standardCabochonKeys.map((value) => ({ value, ...cabochonShapes[value] })),
  { value: "custom", en: "Other shape", id: "Bentuk lainnya" },
];

function makeSuiteComponents(): SuiteComponent[] {
  return [
    { key: "Pendant", shapeKey: "", desiredShape: "", lengthMm: "", widthMm: "", depthMm: "" },
    { key: "MatchingPair", shapeKey: "", desiredShape: "", lengthMm: "", widthMm: "", depthMm: "" },
  ];
}

function makeItem(id: string, productId = ""): WorkItem {
  return { id, serviceType: "CabochonPendant", workDescription: "", shapeKey: "", desiredShape: "", lengthMm: "", widthMm: "", depthMm: "", quantity: "1", productId, materialQuantity: "", components: [] };
}

function normalizeDraftItems(value: unknown): WorkItem[] | null {
  if (!Array.isArray(value)) return null;
  const text = (input: unknown) => typeof input === "string" ? input : "";
  const shape = (input: unknown): ShapeKey | "" => typeof input === "string" && shapeKeys.includes(input as ShapeKey) ? input as ShapeKey : "";
  const normalized = value.slice(0, 8).flatMap((entry, index): WorkItem[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const raw = entry as Record<string, unknown>;
    const retiredService = typeof raw.serviceType === "string" && !serviceChoices.some((choice) => choice.value === raw.serviceType);
    const serviceType = retiredService ? "Other" : serviceChoices.some((choice) => choice.value === raw.serviceType) ? raw.serviceType as ServiceType : "CabochonPendant";
    let components: SuiteComponent[] = [];
    if (serviceType === "CabochonSuite") {
      const values = Array.isArray(raw.components) ? raw.components : [];
      components = makeSuiteComponents().map((fallback) => {
        const candidate = values.find((component) => component && typeof component === "object" && !Array.isArray(component) && (component as Record<string, unknown>).key === fallback.key) as Record<string, unknown> | undefined;
        return candidate ? { ...fallback, shapeKey: shape(candidate.shapeKey), desiredShape: text(candidate.desiredShape), lengthMm: text(candidate.lengthMm), widthMm: text(candidate.widthMm), depthMm: text(candidate.depthMm) } : fallback;
      });
    }
    const legacyNotes = retiredService ? `Previous draft: ${text(raw.serviceType).replace(/([a-z])([A-Z])/g, "$1 $2")}. Please choose an available service. ${text(raw.workDescription)}${Array.isArray(raw.components) && raw.components.length ? `\nPrevious component details: ${JSON.stringify(raw.components)}` : ""}`.slice(0,1000) : text(raw.workDescription);
    return [{ domeProfile: ["Studio", "Low", "Medium", "High"].includes(text(raw.domeProfile)) ? text(raw.domeProfile) : "Studio", domeHeightMm: typeof raw.domeHeightMm === "number" && raw.domeHeightMm >= .3 && raw.domeHeightMm <= 20 ? raw.domeHeightMm : undefined, id: text(raw.id) || `work-${index + 1}`, serviceType, workDescription: legacyNotes, shapeKey: shape(raw.shapeKey), desiredShape: text(raw.desiredShape), lengthMm: text(raw.lengthMm), widthMm: text(raw.widthMm), depthMm: text(raw.depthMm), quantity: text(raw.quantity) || "1", productId: text(raw.productId), materialQuantity: text(raw.materialQuantity), components }];
  });
  return normalized.length ? normalized : null;
}

export function CustomOrderForm({ language }: { language: Language }) {
  const isId = language === "id";
  const t = (en: string, id: string) => isId ? id : en;
  const [domeSettings, setDomeSettings] = useState<DomeSettings>(defaultDomeSettings);
  const [servicePricing, setServicePricing] = useState<LapidaryServicePricing>(defaultLapidaryServicePricing);
  const [servicePricingReady, setServicePricingReady] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/lapidary/content", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => {
      if (active && data?.domeSettings) setDomeSettings(data.domeSettings);
    }).catch(() => {});
    fetch("/api/lapidary/service-pricing", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => {
      if (!active || typeof data?.pendantUsd !== "number" || typeof data?.matchedPairUsd !== "number") return;
      setServicePricing({ pendantUsd: data.pendantUsd, matchedPairUsd: data.matchedPairUsd });
      setServicePricingReady(true);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Submission | null>(null);
  const [source, setSource] = useState<MaterialSource>("Undecided");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialOrigin, setMaterialOrigin] = useState("");
  const [materialCondition, setMaterialCondition] = useState("");
  const [materialWeight, setMaterialWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<"g" | "kg">("g");
  const [items, setItems] = useState<WorkItem[]>([makeItem("work-1")]);
  const [showAddSpecificationOptions, setShowAddSpecificationOptions] = useState(false);
  const [newSpecificationServiceType, setNewSpecificationServiceType] = useState<ServiceType | "">("");
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [catalogPages, setCatalogPages] = useState({ rough: { current: 1, total: 1 }, slab: { current: 1, total: 1 } });
  const [catalogSearch, setCatalogSearch] = useState("");
  const [productsError, setProductsError] = useState("");
  const [catalogCategory, setCatalogCategory] = useState<"rough" | "slab">("rough");
  const [finish, setFinish] = useState("NotSure");
  const [customFinish, setCustomFinish] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [referenceLinks, setReferenceLinks] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("US");
  const [country, setCountry] = useState("US");
  const [company, setCompany] = useState("");
  const [accountProfile, setAccountProfile] = useState<LapidaryCustomerProfile | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [draftExists, setDraftExists] = useState(false);
  const [shapePreviewKey, setShapePreviewKey] = useState<string | null>(null);
  const [shapeSearches, setShapeSearches] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const previousStep = useRef(step);
  const contactEdited = useRef(false);

  useEffect(() => {
    let active = true;
    fetch("/api/customer-account/me", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as LapidaryCustomerProfile : null)
      .then((profile) => {
        if (!active || !profile?.emailVerifiedAt) return;
        setAccountProfile(profile);
        if (contactEdited.current) return;
        setName((current) => current.trim() ? current : profile.name);
        setEmail((current) => current.trim() ? current : profile.email);
        if (profile.phone) {
          const value = profile.phone.trim();
          const digits = value.replace(/\D/g, "");
          const internationalDigits = value.startsWith("00") ? digits.slice(2) : digits;
          const match = value.startsWith("+") || value.startsWith("00")
            ? phoneRegionsByCallingCode.find(([, callingCode]) => internationalDigits.startsWith(callingCode))
            : undefined;
          if (!match) setPhone(value);
          else {
            const region = primaryRegionsByCallingCode[match[1]] ?? match[0];
            setPhoneCountry(region);
            setPhone(internationalDigits.slice(match[1].length));
          }
        }
        const profileCountry = profile.address?.countryCode?.toUpperCase();
        if (profileCountry && /^[A-Z]{2}$/.test(profileCountry)) {
          setCountry(profileCountry);
          if (COUNTRY_CALLING_CODES[profileCountry]) setPhoneCountry(profileCountry);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setItems((current) => current.some((item) => !serviceChoices.some((choice) => choice.value === item.serviceType)) ? normalizeDraftItems(current) ?? [makeItem("work-1")] : current);
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<CustomOrderDraft>;
        if (draft.version === 1) {
          setDraftExists(true);
          if (typeof draft.step === "number" && Number.isInteger(draft.step)) setStep(Math.max(0, Math.min(4, draft.step)));
          if (draft.source === "CustomerSupplied" || draft.source === "RendiVirgoStock" || draft.source === "Undecided") setSource(draft.source);
          if (typeof draft.materialDescription === "string") setMaterialDescription(draft.materialDescription);
          if (typeof draft.materialOrigin === "string") setMaterialOrigin(draft.materialOrigin);
          if (typeof draft.materialCondition === "string") setMaterialCondition(draft.materialCondition);
          if (typeof draft.materialWeight === "string") setMaterialWeight(draft.materialWeight);
          if (draft.weightUnit === "g" || draft.weightUnit === "kg") setWeightUnit(draft.weightUnit);
          const normalizedItems = normalizeDraftItems(draft.items);
          if (normalizedItems) setItems(normalizedItems);
          if (Array.isArray(draft.selectedCatalogIds)) setSelectedCatalogIds(draft.selectedCatalogIds.filter((id): id is string => typeof id === "string"));
          if (typeof draft.finish === "string") setFinish(draft.finish);
          if (typeof draft.customFinish === "string") setCustomFinish(draft.customFinish);
          if (typeof draft.additionalDetails === "string") setAdditionalDetails(draft.additionalDetails);
          if (typeof draft.referenceLinks === "string") setReferenceLinks(draft.referenceLinks);
          if (typeof draft.targetDate === "string") setTargetDate(draft.targetDate);
        }
      }
    } catch {
      sessionStorage.removeItem(DRAFT_KEY);
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      const hasDraft = source !== "Undecided" || materialDescription || materialOrigin || materialCondition || materialWeight || selectedCatalogIds.length || items.some((item) => item.serviceType !== "CabochonPendant" || item.productId || item.workDescription || item.shapeKey || item.lengthMm || item.widthMm || item.depthMm || item.quantity !== "1" || item.materialQuantity || item.domeProfile && item.domeProfile !== "Studio" || item.components.some((component) => component.shapeKey || component.desiredShape || component.lengthMm || component.widthMm || component.depthMm)) || finish !== "NotSure" || customFinish || additionalDetails || referenceLinks || targetDate;
      if (!hasDraft) {
        sessionStorage.removeItem(DRAFT_KEY);
        setDraftExists(false);
        return;
      }
      const draft: CustomOrderDraft = { version: 1, savedAt: new Date().toISOString(), step, source, materialDescription, materialOrigin, materialCondition, materialWeight, weightUnit, items, selectedCatalogIds, finish, customFinish, additionalDetails, referenceLinks, targetDate };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftExists(true);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draftReady, step, source, materialDescription, materialOrigin, materialCondition, materialWeight, weightUnit, items, selectedCatalogIds, finish, customFinish, additionalDetails, referenceLinks, targetDate]);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    requestAnimationFrame(() => document.getElementById("lapidary-step-title")?.focus());
  }, [step]);

  useEffect(() => {
    const previews = mediaFiles.map((file) => URL.createObjectURL(file));
    setMediaPreviews(previews);
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [mediaFiles]);

  useEffect(() => {
    if (source !== "RendiVirgoStock") return;
    let active = true;
    setProductsLoading(true);
    setProductsError("");
    Promise.all((["rough", "slab"] as const).map(async (category) => {
      const response = await fetch(`/api/products?category=${category}&inStock=true&page=1&pageSize=100`, { headers: { accept: "application/json", "x-rv-language": language }, cache: "no-store" });
      if (!response.ok) throw new Error("Could not load catalog stones");
      const payload = await response.json() as { items?: Product[]; pageCount?: number };
      return { category, items: payload.items ?? [], pageCount: payload.pageCount ?? 1 };
    })).then((groups) => { if (active) { setProducts(groups.flatMap((group) => group.items)); setCatalogPages({ rough: { current: 1, total: groups.find((group) => group.category === "rough")?.pageCount ?? 1 }, slab: { current: 1, total: groups.find((group) => group.category === "slab")?.pageCount ?? 1 } }); } })
      .catch(() => { if (active) setProductsError(t("The stone catalog could not load. Please try again.", "Katalog batu belum dapat dimuat. Silakan coba lagi.")); })
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, [source, language]);

  const selectedProductIds = selectedCatalogIds;
  const visibleProducts = products.filter((product) => product.categorySlug === catalogCategory && product.inStock && (!catalogSearch.trim() || `${product.name} ${product.stoneType} ${product.origin} ${product.sku}`.toLowerCase().includes(catalogSearch.trim().toLowerCase())));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const pricedServiceCount = servicePricingReady ? items.filter((item) => serviceUnitFee(item.serviceType) !== null).length : 0;
  const estimatedServiceFeeTotal = items.reduce((total, item) => total + (serviceUnitFee(item.serviceType) ?? 0) * Number(item.quantity || 0), 0);
  const hasUnpricedService = items.some((item) => serviceUnitFee(item.serviceType) === null);

  function updateItem(id: string, change: Partial<WorkItem>) {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...change };
      if (next.domeHeightMm && next.shapeKey && next.shapeKey !== "custom") {
        const width = Number(next.widthMm) || Number(cabochonShapes[next.shapeKey].dimensions.split(" × ")[1]);
        next.domeHeightMm = Math.min(next.domeHeightMm, Math.max(domeSettings.minHeight, Math.min(domeSettings.maxHeight, width * domeSettings.maxWidthRatio)));
      }
      return next;
    }));
  }

  function updateComponent(itemId: string, key: SuiteComponent["key"], change: Partial<SuiteComponent>) {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, components: item.components.map((component) => component.key === key ? { ...component, ...change } : component) } : item));
  }

  function unitLabel(unit: string) {
    const names: Record<string, [string, string]> = {
      piece: ["piece", "buah"], pair: ["pair", "pasang"], gram: ["gram", "gram"], carat: ["carat", "karat"], strand: ["strand", "untai"], bag: ["bag", "kantong"],
    };
    return names[unit]?.[isId ? 1 : 0] ?? unit;
  }

  function serviceUnitFee(serviceType: ServiceType) {
    if (!servicePricingReady) return null;
    if (serviceType === "CabochonPendant") return servicePricing.pendantUsd;
    if (serviceType === "CabochonPair") return servicePricing.matchedPairUsd;
    return null;
  }

  function formatUsd(amount: number) {
    return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)}`;
  }

  function shapeLabel(shape: ShapeKey | "") {
    if (!shape) return t("Shape to be discussed", "Bentuk akan didiskusikan");
    return shapeOptions.find((entry) => entry.value === shape)?.[isId ? "id" : "en"] ?? shape;
  }

  function dimensionSummary(length: string, width: string, depth: string) {
    if (!length && !width && !depth) return t("Dimensions to be discussed", "Ukuran akan didiskusikan");
    return `L ${formatDimension(length)} × W ${formatDimension(width)} × D ${formatDimension(depth)}`;
  }

  function updateServiceType(id: string, serviceType: ServiceType) {
    setItems((current) => current.map((item) => item.id !== id ? item : {
      ...item,
      serviceType,
      workDescription: serviceType === "Other" ? item.workDescription : "",
      components: serviceType === "CabochonSuite" ? (item.components.length === 2 ? item.components : makeSuiteComponents()) : [],
    }));
  }

  function addShapeSpecification(serviceType: ServiceType) {
    setItems((current) => {
      if (current.length >= 8) return current;
      const previous = current[current.length - 1];
      const next = makeItem(`work-${Date.now()}-${current.length}`, previous?.productId || selectedProductIds[0] || "");
      next.serviceType = serviceType;
      return [...current, next];
    });
    setError("");
  }

  function removeWorkItem(id: string) {
    setItems((current) => current.length > 1 ? current.filter((item) => item.id !== id) : current);
    setShapePreviewKey((current) => current === id ? null : current);
  }

  function clearDraft() {
    sessionStorage.removeItem(DRAFT_KEY);
    setShapePreviewKey(null);
    setShowAddSpecificationOptions(false);
    setNewSpecificationServiceType("");
    setDraftExists(false);
    setStep(0); setSource("Undecided"); setMaterialDescription(""); setMaterialOrigin(""); setMaterialCondition(""); setMaterialWeight(""); setWeightUnit("g");
    setItems([makeItem("work-1")]); setSelectedCatalogIds([]); setFinish("NotSure"); setCustomFinish(""); setAdditionalDetails(""); setReferenceLinks(""); setTargetDate("");
    setMediaFiles([]); setName(""); setEmail(""); setPhone(""); setPhoneCountry("US"); setCountry("US"); setCompany(""); setConsent(false); setError("");
  }

  function toggleProduct(productId: string) {
    const isSelected = selectedCatalogIds.includes(productId);
    const next = isSelected ? selectedCatalogIds.filter((id) => id !== productId) : [...selectedCatalogIds, productId];
    if (next.length > 8) { setError(t("Select up to 8 catalog stones.", "Pilih maksimal 8 batu dari katalog.")); return; }
    setSelectedCatalogIds(next);
    setItems((current) => current.map((item, index) => {
      if (isSelected && item.productId === productId) return { ...item, productId: "", materialQuantity: "" };
      if (!isSelected && index === current.findIndex((entry) => !entry.productId)) return { ...item, productId, materialQuantity: "" };
      return item;
    }));
  }

  function validateStep(currentStep: number) {
    if (currentStep === 0) {
      if (source === "CustomerSupplied") {
        if (materialDescription.trim().length < 2) return t("Describe the stone you will provide.", "Jelaskan batu yang akan Anda kirim.");
        if (!Number(materialWeight) || Number(materialWeight) <= 0) return t("Add the approximate stone weight.", "Masukkan perkiraan berat batu.");
        if (!mediaFiles.length) return t("Add at least one photo or video of your stone.", "Tambahkan setidaknya satu foto atau video batu Anda.");
      }
      if (source === "RendiVirgoStock" && !selectedProductIds.length) return t("Select at least one Rough or Slab stone.", "Pilih setidaknya satu batu Rough atau Slab.");
      if (source === "Undecided" && materialDescription.trim().length < 5) return t("Tell us what kind of stone or result you have in mind.", "Ceritakan material atau hasil yang Anda inginkan.");
    }
    if (currentStep === 1) {
      if (!items.length) return t("Add at least one work item.", "Tambahkan setidaknya satu jenis pengerjaan.");
      if (source === "RendiVirgoStock" && items.some((item) => !item.productId || !selectedProductIds.includes(item.productId))) return t("Assign a selected stone to every work item.", "Pilih material untuk setiap jenis pengerjaan.");
      if (source === "RendiVirgoStock" && selectedProductIds.some((id) => !items.some((item) => item.productId === id))) return t("Assign each selected stone to a work item, or remove it from your selection.", "Hubungkan setiap batu yang dipilih ke item pengerjaan, atau hapus dari pilihan.");
    }
    if (currentStep === 2) {
      for (const item of items) {
        if (item.serviceType === "Other" && !item.workDescription.trim()) return t("Describe the work for each Other specification.", "Jelaskan pengerjaan untuk setiap spesifikasi Lainnya.");
        if (!Number(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 500) return t("Each quantity must be between 1 and 500.", "Jumlah setiap item harus antara 1 dan 500.");
        if (source === "RendiVirgoStock" && (!Number(item.materialQuantity) || Number(item.materialQuantity) <= 0)) return t("Add the amount of selected material needed for each work item.", "Masukkan jumlah material stok yang dibutuhkan untuk setiap pengerjaan.");
        if (source === "RendiVirgoStock" && Number(item.materialQuantity) > (selectedProduct(item.productId)?.stockQuantity ?? 0)) return t("Requested material is higher than available stock.", "Jumlah material yang diminta melebihi stok yang tersedia.");
        if (item.shapeKey === "custom" && !item.desiredShape.trim()) return t("Describe the custom shape for every item that uses it.", "Jelaskan bentuk khusus pada setiap item.");
        if (Boolean(item.lengthMm) !== Boolean(item.widthMm)) return t("Add both length and width, or leave both blank.", "Isi panjang dan lebar sekaligus, atau kosongkan keduanya.");
        if (item.serviceType === "CabochonSuite" && item.components.some((component) => component.shapeKey === "custom" && !component.desiredShape.trim())) return t("Describe each custom shape in your suite.", "Jelaskan setiap bentuk khusus dalam suite.");
        if (item.serviceType === "CabochonSuite" && item.components.some((component) => Boolean(component.lengthMm) !== Boolean(component.widthMm))) return t("For each suite component, add both length and width or leave both blank.", "Untuk setiap komponen suite, isi panjang dan lebar sekaligus atau kosongkan keduanya.");
      }
      if (source === "RendiVirgoStock") {
        const requestedByProduct = new Map<string, number>();
        for (const item of items) if (item.productId) requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + Number(item.materialQuantity || 0));
        for (const [productId, amount] of requestedByProduct) if (amount > (selectedProduct(productId)?.stockQuantity ?? 0)) return t("Combined material amounts for a stone exceed available stock.", "Total material untuk satu batu melebihi stok yang tersedia.");
      }
      if (targetDate && targetDate < today) return t("Choose today or a future preferred date.", "Pilih tanggal hari ini atau tanggal berikutnya.");
    }
    if (currentStep === 3) {
      if (finish === "Other" && !customFinish.trim()) return t("Describe the finish you would like.", "Jelaskan finishing yang Anda inginkan.");
      const links = referenceLinks.split(/\n+/).map((url) => url.trim()).filter(Boolean);
      if (links.length > 5 || links.some((url) => {
        try { return !["http:", "https:"].includes(new URL(url).protocol); } catch { return true; }
      })) return t("Use up to 5 valid http or https reference links.", "Gunakan maksimal 5 tautan referensi http atau https yang valid.");
    }
    if (currentStep === 4) {
      if (name.trim().length < 2) return t("Add your full name.", "Masukkan nama lengkap Anda.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return t("Add a valid email address.", "Masukkan alamat email yang valid.");
      const normalizedPhone = internationalPhoneNumber(phoneCountry, phone);
      if (!phonePattern.test(normalizedPhone)) return t("Enter a valid phone number for the selected country code.", "Masukkan nomor telepon yang valid untuk kode negara yang dipilih.");
      if (!country) return t("Choose your country.", "Pilih negara Anda.");
      if (!consent) return t("Accept the quote request terms before sending.", "Setujui ketentuan permintaan penawaran sebelum mengirim.");
    }
    return "";
  }

  function advance() {
    if (!formRef.current?.reportValidity()) return;
    const issue = validateStep(step);
    if (issue) { setError(issue); return; }
    setError("");
    setStep((current) => Math.min(4, current + 1));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || !formRef.current?.reportValidity()) return;
    for (let earlierStep = 0; earlierStep < 4; earlierStep += 1) {
      const earlierIssue = validateStep(earlierStep);
      if (earlierIssue) { setError(earlierIssue); setStep(earlierStep); return; }
    }
    const issue = validateStep(4);
    if (issue) { setError(issue); return; }
    const links = referenceLinks.split(/\n+/).map((url) => url.trim()).filter(Boolean);
    const payload = {
      name: name.trim(), email: email.trim(), phone: internationalPhoneNumber(phoneCountry, phone), country: countryNameForCode(country, "en") ?? country, company: company.trim() || undefined,
      materialSource: source,
      materialDescription: materialDescription.trim() || undefined,
      materialOrigin: materialOrigin.trim() || undefined,
      materialCondition: materialCondition.trim() || undefined,
      materialWeightGram: materialWeight ? Number(materialWeight) * (weightUnit === "kg" ? 1000 : 1) : undefined,
      items: items.map((item) => ({
        domeProfile: domeSettings.enabled ? item.domeProfile ?? "Studio" : undefined, domeHeightMm: domeSettings.enabled && item.domeProfile && item.domeProfile !== "Studio" ? item.domeHeightMm : undefined,
        serviceType: item.serviceType, workDescription: item.workDescription.trim() || undefined, shapeKey: item.shapeKey || undefined, desiredShape: item.desiredShape.trim() || undefined,
        lengthMm: item.lengthMm ? Number(item.lengthMm) : undefined, widthMm: item.widthMm ? Number(item.widthMm) : undefined,
        depthMm: item.depthMm ? Number(item.depthMm) : undefined, quantity: Number(item.quantity),
        materialQuantity: source === "RendiVirgoStock" ? Number(item.materialQuantity) : undefined,
        components: item.serviceType === "CabochonSuite" ? item.components.map((component) => ({
          key: component.key, shapeKey: component.shapeKey || undefined, desiredShape: component.desiredShape.trim() || undefined,
          lengthMm: component.lengthMm ? Number(component.lengthMm) : undefined, widthMm: component.widthMm ? Number(component.widthMm) : undefined,
          depthMm: component.depthMm ? Number(component.depthMm) : undefined,
        })) : undefined,
        productId: source === "RendiVirgoStock" ? item.productId : undefined,
      })),
      targetDate: targetDate || undefined, finishPreference: finish, additionalDetails: [finish === "Other" ? `Custom finish: ${customFinish.trim()}` : "", additionalDetails.trim()].filter(Boolean).join("\n\n") || undefined,
      referenceImageUrls: links, consent, website,
    };
    const data = new FormData();
    data.append("payload", JSON.stringify(payload));
    mediaFiles.forEach((file) => data.append("media", file, file.name));
    setSending(true); setError("");
    try {
      const response = await fetch("/api/lapidary/requests", { method: "POST", headers: { accept: "application/json" }, body: data });
      const body = await response.json().catch(() => null) as Submission | { message?: string | string[] } | null;
      if (!response.ok || !body || !("requestNumber" in body)) {
        const raw = body && "message" in body ? body.message : null;
        setError(Array.isArray(raw) ? raw.join(". ") : typeof raw === "string" ? raw : t("We could not send your request. Please try again.", "Permintaan belum dapat dikirim. Silakan coba lagi."));
        return;
      }
      sessionStorage.removeItem(DRAFT_KEY);
      setResult(body);
    } catch {
      setError(t("We could not send your request. Please check your connection and try again.", "Permintaan belum dapat dikirim. Periksa koneksi Anda dan coba lagi."));
    } finally { setSending(false); }
  }

  function addMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    const total = [...mediaFiles, ...chosen];
    if (total.length > 5) { setError(t("Choose up to 5 files.", "Pilih maksimal 5 berkas.")); return; }
    if (total.some((file) => file.size > 6 * 1024 * 1024) || total.reduce((sum, file) => sum + file.size, 0) > 30 * 1024 * 1024) {
      setError(t("Each file must be 6 MB or less, and all files together can be up to 30 MB.", "Setiap berkas maksimal 6 MB dan total semua berkas maksimal 30 MB.")); return;
    }
    if (total.some((file) => !["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4"].includes(file.type))) {
      setError(t("Use JPEG, PNG, WebP, AVIF, or MP4 files.", "Gunakan berkas JPEG, PNG, WebP, AVIF, atau MP4.")); return;
    }
    setError(""); setMediaFiles(total);
  }

  function updatePhone(value: string) {
    const trimmed = value.trim();
    if (!trimmed.startsWith("+") && !trimmed.startsWith("00")) {
      setPhone(value);
      return;
    }
    const digits = value.replace(/\D/g, "");
    const internationalDigits = trimmed.startsWith("00") ? digits.slice(2) : digits;
    const match = phoneRegionsByCallingCode.find(([, callingCode]) => internationalDigits.startsWith(callingCode));
    if (!match) {
      setPhone(value);
      return;
    }
    const currentCallingCode = COUNTRY_CALLING_CODES[phoneCountry];
    const primaryRegion = primaryRegionsByCallingCode[match[1]];
    const matchedRegion = currentCallingCode === match[1] ? phoneCountry : primaryRegion && COUNTRY_CALLING_CODES[primaryRegion] === match[1] ? primaryRegion : match[0];
    setPhoneCountry(matchedRegion);
    setPhone(internationalDigits.slice(match[1].length));
  }

  function selectedProduct(id: string) { return products.find((product) => product.id === id); }
  async function loadMoreCatalog() {
    const page = catalogPages[catalogCategory];
    if (loadingMoreProducts || page.current >= page.total) return;
    setLoadingMoreProducts(true); setProductsError("");
    try {
      const nextPage = page.current + 1;
      const response = await fetch(`/api/products?category=${catalogCategory}&inStock=true&page=${nextPage}&pageSize=100`, { headers: { accept: "application/json", "x-rv-language": language }, cache: "no-store" });
      if (!response.ok) throw new Error("Could not load more catalog stones");
      const payload = await response.json() as { items?: Product[]; pageCount?: number };
      setProducts((current) => [...current, ...(payload.items ?? []).filter((product) => !current.some((existing) => existing.id === product.id))]);
      setCatalogPages((current) => ({ ...current, [catalogCategory]: { current: nextPage, total: payload.pageCount ?? page.total } }));
    } catch { setProductsError(t("More stones could not load. Please retry.", "Batu lainnya belum dapat dimuat. Silakan coba lagi.")); }
    finally { setLoadingMoreProducts(false); }
  }
  function workName(type: ServiceType) { const item = serviceChoices.find((choice) => choice.value === type); return isId ? item?.id : item?.en; }
  function formatDimension(value: string) { return value.trim() ? `${value} mm` : "—"; }
  function renderShapePicker(selected: ShapeKey | "", onSelect: (shape: ShapeKey) => void, label: string, pickerKey: string, matchedPair = false, workItem?: WorkItem) {
    const searchValue = shapeSearches[pickerKey] ?? "";
    const normalizedSearch = searchValue.trim().toLocaleLowerCase();
    const visibleShapes = normalizedSearch
      ? shapeOptions.filter((shape) => (isId ? shape.id : shape.en).toLocaleLowerCase().includes(normalizedSearch))
      : shapeOptions;
    const selectedShape = shapeOptions.find((shape) => shape.value === selected);
    const searchId = `${pickerKey.replace(/[^a-zA-Z0-9_-]/g, "-")}-shape-search`;
    const renderChoice = (shape: typeof shapeOptions[number]) => <button type="button" key={shape.value} aria-pressed={selected === shape.value} className={selected === shape.value ? "is-selected" : ""} onClick={() => {
        onSelect(shape.value);
        if (shape.value !== "custom") setShapePreviewKey(pickerKey);
        else if (shapePreviewKey === pickerKey) setShapePreviewKey(null);
      }}><Image src={shape.value === "custom" ? "/images/lapidary/shapes/custom.png" : matchedPair ? `/models/lapidary/${shape.value}-v1/matched-pair-front-v1.png` : `/models/lapidary/${shape.value}-v1/front-v${cabochonAssetVersion(shape.value)}.png`} alt="" width={72} height={72} sizes="72px" /><span>{isId ? shape.id : shape.en}</span><span className="lapidary-shape-picker__check" aria-hidden="true">✓</span></button>;
    return <div className="lapidary-shape-picker-group">
      <fieldset className="lapidary-shape-picker"><legend>{label}</legend>
        <p className="lapidary-shape-scroll-hint">{t(`Search or scroll to explore all ${standardCabochonKeys.length} shapes`, `Cari atau scroll untuk melihat seluruh ${standardCabochonKeys.length} bentuk`)} <span aria-hidden="true">↕</span></p>
        <label className="lapidary-shape-search" htmlFor={searchId}>{t("Find a shape", "Cari bentuk")}<input id={searchId} type="search" value={searchValue} onChange={(event) => setShapeSearches((current) => ({ ...current, [pickerKey]: event.target.value }))} placeholder={t("Search by shape name", "Cari berdasarkan nama bentuk")} /></label>
        {selectedShape ? <p className="lapidary-shape-selected">{t("Selected", "Dipilih")}: <strong>{isId ? selectedShape.id : selectedShape.en}</strong></p> : null}
        <div className="lapidary-shape-scroll" role="region" aria-label={t("All basic shapes — scroll to browse", "Seluruh bentuk dasar — scroll untuk melihat")} tabIndex={0}>{visibleShapes.length ? visibleShapes.map(renderChoice) : <p className="lapidary-shape-scroll-empty">{t("No shapes match your search.", "Tidak ada bentuk yang cocok dengan pencarian.")}</p>}</div>
        {matchedPair ? <p className="lapidary-shape-aliases">{t("Two cabochons per pair. Asymmetric shapes are mirrored left and right. Color and pattern matching will be confirmed by the studio.", "Dua cabochon per pasang. Bentuk asimetris dibuat sebagai pasangan cermin kiri–kanan. Kesesuaian warna dan pola dikonfirmasi oleh studio.")}</p> : null}
        <p className="lapidary-shape-aliases">{t("Long oval is also called elongated oval; marquise is also called navette. These are smooth cabochon shapes; Emerald octagon describes the outline.", "Long oval juga disebut elongated oval; marquise juga disebut navette. Semua contoh berkubah halus; Emerald octagon menjelaskan garis bentuknya.")}</p>
      </fieldset>
      {selected && selected !== "custom" && shapePreviewKey !== pickerKey ? <button type="button" className="lapidary-shape-preview-trigger" onClick={() => setShapePreviewKey(pickerKey)}>{t(`Explore ${shapeOptions.find((entry) => entry.value === selected)?.en ?? "shape"} in 3D`, `Jelajahi ${shapeOptions.find((entry) => entry.value === selected)?.id ?? "bentuk"} dalam 3D`)} <span aria-hidden="true">↗</span></button> : null}
      {selected && selected !== "custom" && shapePreviewKey === pickerKey ? <Cabochon3DPreview key={`${pickerKey}-${selected}-${matchedPair}`} domeHeight={domeSettings.enabled && workItem?.domeProfile !== "Studio" ? workItem?.domeHeightMm : undefined} domeProfile={workItem?.domeProfile} matchedPair={matchedPair} shape={selected as CabochonShape} language={language} onClose={() => setShapePreviewKey(null)} /> : null}
    </div>;
  }

  if (result) return (
    <section className="lapidary-form-success" role="status">
      <span className="lapidary-form-success__mark" aria-hidden="true">✓</span>
      <p className="lapidary-eyebrow">{t("REQUEST REFERENCE", "REFERENSI PERMINTAAN")}</p>
      <h2>{result.requestNumber}</h2>
      <p>{t("Your request and reference files are with our studio. We will review availability, scope, and the material arrangements, then contact you with next steps.", "Permintaan dan berkas referensi Anda sudah diterima studio. Kami akan meninjau ketersediaan, ruang lingkup, dan pengaturan material, lalu menghubungi Anda mengenai langkah berikutnya.")}</p>
      {result.accountLinked ? (
        <p>{t("This project is linked to your account. Email notifications will continue as well.", "Proyek ini sudah terhubung ke akun Anda. Notifikasi email tetap akan dikirimkan.")} <a href="/account/lapidary">{t("View your projects", "Lihat proyek Anda")}</a></p>
      ) : result.accountLinked === false ? (
        <p>{t("We’ll email a secure account link to the address you provided. Use that same email to sign in or create an account and follow this project. Email notifications will continue.", "Kami akan mengirim tautan akun yang aman ke alamat yang Anda berikan. Gunakan email yang sama untuk masuk atau membuat akun dan memantau proyek ini. Notifikasi email tetap dikirimkan.")}</p>
      ) : null}
      <button className="lapidary-button" type="button" onClick={() => setResult(null)}>{t("Send another request", "Kirim permintaan lain")}<span aria-hidden="true">↗</span></button>
    </section>
  );

  return <div className="lapidary-form">
    <div className="lapidary-wizard__top">
      <div><p className="lapidary-eyebrow">{t("CUSTOM STUDIO REQUEST", "PERMINTAAN CUSTOM STUDIO")}</p><h2>{t("Build your project brief", "Susun brief proyek Anda")}</h2><p>{t("A few focused steps help us understand the material and the work you have in mind.", "Beberapa langkah singkat membantu kami memahami material dan pengerjaan yang Anda inginkan.")}</p></div>
      <span className="lapidary-wizard__counter">{String(step + 1).padStart(2, "0")} <i>/</i> {String(steps.length).padStart(2, "0")}</span>
    </div>
    <nav className="lapidary-wizard__progress" aria-label={t("Request progress", "Progres permintaan")}>
      {steps.map((entry, index) => <button key={entry.en} type="button" className={`lapidary-wizard__progress-step${step === index ? " is-current" : ""}${step > index ? " is-complete" : ""}`} onClick={() => index < step && (setError(""), setStep(index))} aria-current={step === index ? "step" : undefined} disabled={index >= step}>
        <span>{step > index ? "✓" : String(index + 1).padStart(2, "0")}</span><small>{isId ? entry.id : entry.en}</small>
      </button>)}
    </nav>

    {draftExists ? <div className="lapidary-draft-notice" role="status">
      <p>{t("Project details are saved temporarily in this tab. Contact details and uploaded files stay out of the draft; add files again if you reload.", "Detail proyek tersimpan sementara di tab ini. Kontak dan berkas tidak disimpan; lampirkan ulang berkas jika halaman dimuat kembali.")}</p>
      <button type="button" onClick={clearDraft}>{t("Clear draft", "Hapus draft")}</button>
    </div> : null}
    <form ref={formRef} className="lapidary-wizard__content" onSubmit={submit}>
      {step === 0 ? <section className="lapidary-wizard__panel" aria-labelledby="lapidary-step-title">
        <p className="lapidary-eyebrow">{t("STEP 01 · MATERIAL", "LANGKAH 01 · MATERIAL")}</p><h3 id="lapidary-step-title" tabIndex={-1}>{t("Where will the stone come from?", "Dari mana material batu berasal?")}</h3><p className="lapidary-wizard__intro">{t("Choose the closest option. We will only ask for details that apply to your material.", "Pilih opsi yang paling sesuai. Kami hanya menanyakan detail yang relevan dengan material Anda.")}</p>
        <div className="lapidary-source-grid">
          {([
            ["CustomerSupplied", t("I have my own stone", "Saya memiliki batu sendiri"), t("Share its condition, weight, and a few clear photos.", "Jelaskan kondisi dan beratnya, lalu lampirkan beberapa foto."), "customer-stone"],
            ["RendiVirgoStock", t("Choose a studio stone", "Pilih batu dari studio"), t("Browse available Rough and Slab material.", "Telusuri material Rough dan Slab yang tersedia."), "studio-stock"],
            ["Undecided", t("Help me choose", "Bantu saya memilih"), t("Tell us the outcome you want; our studio can guide the material choice.", "Ceritakan hasil yang Anda inginkan; studio akan membantu memilih material."), "guided-choice"],
          ] as const).map(([value, title, description, icon]) => <button type="button" aria-pressed={source === value} className={`lapidary-source-card${source === value ? " is-selected" : ""}`} key={value} onClick={() => { setSource(value); setError(""); }}><span className="lapidary-source-card__mark" aria-hidden="true"><span className={`lapidary-source-card__icon lapidary-source-card__icon--${icon}`} /></span><strong>{title}</strong><small>{description}</small><span className="lapidary-source-card__select">{source === value ? t("Selected", "Dipilih") : t("Choose", "Pilih")}</span></button>)}
        </div>

        {source === "CustomerSupplied" ? <div className="lapidary-wizard__branch lapidary-wizard__branch--customer-material">
          <h4>{t("Tell us about your stone", "Ceritakan tentang batu Anda")}</h4>
          <div className="lapidary-form__grid">
            <label className="lapidary-form__full">{t("Stone type and notes", "Jenis batu dan catatan material")}<textarea value={materialDescription} onChange={(event) => setMaterialDescription(event.target.value)} minLength={2} maxLength={2000} required rows={3} placeholder={t("For example: moss agate, rough piece…", "Contoh: moss agate, batu rough…")} /></label>
            <label>{t("Origin (if known)", "Asal batu (jika diketahui)")}<input value={materialOrigin} onChange={(event) => setMaterialOrigin(event.target.value)} maxLength={160} placeholder={t("Region or mine", "Daerah atau lokasi tambang")} /></label>
            <div className="lapidary-field"><label htmlFor="lapidary-material-weight">{t("Approximate weight", "Perkiraan berat")}</label><span className="lapidary-input-with-unit"><input id="lapidary-material-weight" type="number" min="0.01" step="0.01" value={materialWeight} onChange={(event) => setMaterialWeight(event.target.value)} required inputMode="decimal" /><FilterDropdown id="lapidary-weight-unit" ariaLabel={t("Weight unit", "Satuan berat")} value={weightUnit} compact wideMenu onChange={(value) => setWeightUnit(value as "g" | "kg")} options={[{ value: "g", label: "g" }, { value: "kg", label: "kg" }]} /></span></div>
            <label className="lapidary-form__full">{t("Condition or known concerns (optional)", "Kondisi atau hal yang perlu diperhatikan (opsional)")}<input value={materialCondition} onChange={(event) => setMaterialCondition(event.target.value)} maxLength={500} placeholder={t("Cracks, inclusions, previous cuts…", "Retakan, inklusi, bekas potongan…")} /></label>
            <p className="lapidary-wizard__notice lapidary-form__full">{t("Please do not ship your stone until our team confirms the packing and delivery instructions.", "Jangan mengirim batu sebelum tim kami mengonfirmasi instruksi pengemasan dan pengiriman.")}</p>
            <MediaPicker isId={isId} files={mediaFiles} previews={mediaPreviews} onChange={addMedia} onRemove={(index) => setMediaFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
          </div>
        </div> : null}

        {source === "RendiVirgoStock" ? <div className="lapidary-wizard__branch">
          <div className="lapidary-branch-heading"><div><h4>{t("Choose available Rough or Slab", "Pilih Rough atau Slab yang tersedia")}</h4><p>{t("Select the stones you want the studio to assess. Product availability will be checked again when you send the request.", "Pilih batu yang ingin dinilai oleh studio. Ketersediaan produk akan diperiksa lagi saat permintaan dikirim.")}</p><small>{t("The listed amount is for material per catalog unit. Studio work is quoted separately; selecting material does not reserve stock.", "Harga yang ditampilkan adalah harga material per satuan katalog. Biaya jasa studio ditawarkan terpisah; pemilihan material tidak memesan stok.")}</small></div><span>{selectedProductIds.length} {t("selected", "dipilih")}</span></div>
          <div className="lapidary-catalog-tabs" aria-label={t("Stone category", "Kategori batu")}><button type="button" aria-pressed={catalogCategory === "rough"} onClick={() => setCatalogCategory("rough")}>{t("Rough material", "Material Rough")}</button><button type="button" aria-pressed={catalogCategory === "slab"} onClick={() => setCatalogCategory("slab")}>{t("Slab material", "Material Slab")}</button></div>
          <label className="lapidary-field lapidary-catalog-search">{t("Search stones", "Cari batu")}<input type="search" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder={t("Name, type, origin, or SKU", "Nama, jenis, asal, atau SKU")} /></label>
          {productsLoading ? <p className="lapidary-wizard__loading">{t("Loading available stones…", "Memuat batu yang tersedia…")}</p> : productsError ? <p className="lapidary-form__error" role="alert">{productsError}</p> : visibleProducts.length ? <div className="lapidary-stock-grid">{visibleProducts.map((product) => {
            const selected = selectedProductIds.includes(product.id);
            return <button type="button" key={product.id} className={`lapidary-stock-card${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={() => toggleProduct(product.id)}>
              <span className="lapidary-stock-card__image">{product.imageUrls?.[0] ? <img src={product.imageUrls[0]} alt="" loading="lazy" /> : <span aria-hidden="true">◇</span>}</span>
              <span className="lapidary-stock-card__meta"><strong>{product.name}</strong><small>{product.stoneType} · {product.origin}</small><small>{product.sku} · {product.categorySlug}</small><small>{new Intl.NumberFormat(isId ? "id-ID" : "en-US", { style: "currency", currency: product.currency || "USD", maximumFractionDigits: 2 }).format(Number(product.price))} / {unitLabel(product.unit)}</small><small>{t("Available", "Tersedia")}: {product.stockQuantity} {unitLabel(product.unit)}</small></span><span className="lapidary-stock-card__check" aria-hidden="true">{selected ? "✓" : "+"}</span>
            </button>;
          })}</div> : <div className="lapidary-empty-catalog"><p>{t("No in-stock stones match this search in the loaded catalog.", "Tidak ada batu tersedia yang cocok dengan pencarian pada katalog yang dimuat.")}</p><a href={`/shop?category=${catalogCategory}`}>{t("Browse the shop", "Lihat katalog toko")} ↗</a></div>}
          {catalogPages[catalogCategory].current < catalogPages[catalogCategory].total ? <button type="button" className="lapidary-add-item" onClick={() => void loadMoreCatalog()} disabled={loadingMoreProducts}><span>{loadingMoreProducts ? "…" : "＋"}</span>{t("Load more stones", "Muat batu lainnya")}</button> : null}
        </div> : null}

        {source === "Undecided" ? <div className="lapidary-wizard__branch"><label className="lapidary-field">{t("What would you like to create or achieve?", "Apa yang ingin Anda buat atau capai?")}<textarea value={materialDescription} onChange={(event) => setMaterialDescription(event.target.value)} required minLength={5} maxLength={2000} rows={4} placeholder={t("Share the intended use, preferred colors, or any stone ideas you already have…", "Ceritakan tujuan penggunaan, warna yang disukai, atau gambaran batu yang Anda inginkan…")} /></label></div> : null}
      </section> : null}

      {step === 1 ? <section className="lapidary-wizard__panel" aria-labelledby="lapidary-step-title">
        <p className="lapidary-eyebrow">{t("STEP 02 · WORK", "LANGKAH 02 · PENGERJAAN")}</p><h3 id="lapidary-step-title" tabIndex={-1}>{t("What would you like us to make?", "Pengerjaan apa yang Anda butuhkan?")}</h3><p className="lapidary-wizard__intro">{t("Each work item can have its own shape, dimensions, output quantity, and material.", "Setiap item dapat memiliki bentuk, ukuran, jumlah hasil, dan material sendiri.")}</p>
        <div className="lapidary-work-list">{items.map((item, index) => <article className="lapidary-work-item" key={item.id}>
          <div className="lapidary-work-item__heading"><span>{t("WORK ITEM", "ITEM PENGERJAAN")} {String(index + 1).padStart(2, "0")}</span>{items.length > 1 ? <button type="button" onClick={() => removeWorkItem(item.id)} aria-label={t(`Remove work item ${index + 1}`, `Hapus item ${index + 1}`)}>×</button> : null}</div>
          <FilterDropdown
            id={`lapidary-service-type-${index}`}
            label={t("Service type", "Jenis pengerjaan")}
            value={item.serviceType}
            searchable={serviceChoices.length > 8}
            searchPlaceholder={t("Search work types…", "Cari jenis pengerjaan…")}
            emptyMessage={t("No work types match your search.", "Tidak ada jenis pengerjaan yang cocok.")}
            onChange={(value) => updateServiceType(item.id, value as ServiceType)}
            options={serviceChoices.map((choice) => ({ value: choice.value, label: isId ? choice.id : choice.en }))}
          />
          {source === "RendiVirgoStock" ? <FilterDropdown
            id={`lapidary-item-material-${index}`}
            label={t("Material for this item", "Material untuk item ini")}
            value={item.productId}
            placeholder={t("Choose a selected stone", "Pilih batu yang sudah dipilih")}
            wideMenu
            searchable={selectedProductIds.length > 5}
            searchPlaceholder={t("Search selected stones…", "Cari batu yang dipilih…")}
            emptyMessage={selectedProductIds.length ? t("No selected stones match your search.", "Tidak ada batu pilihan yang cocok.") : t("Select stones in the Material step first.", "Pilih batu di langkah Material terlebih dahulu.")}
            required
            onChange={(value) => updateItem(item.id, { productId: value, materialQuantity: "" })}
            options={selectedProductIds.flatMap((id) => {
              const product = selectedProduct(id);
              return product ? [{ value: id, label: `${product.name} · ${product.sku}` }] : [];
            })}
          /> : null}
        </article>)}</div>
        {items.length < 8 ? <button type="button" className="lapidary-add-item" onClick={() => setItems((current) => [...current, makeItem(`work-${Date.now()}`, selectedProductIds[0] ?? "")])}><span>＋</span>{t("Add another work item", "Tambah item pengerjaan lain")}</button> : <p className="lapidary-wizard__hint">{t("You can add up to 8 distinct work items.", "Anda dapat menambahkan maksimal 8 item pengerjaan.")}</p>}
      </section> : null}

      {step === 2 ? <section className="lapidary-wizard__panel" aria-labelledby="lapidary-step-title">
        <p className="lapidary-eyebrow">{t("STEP 03 · SPECIFICATIONS", "LANGKAH 03 · SPESIFIKASI")}</p><h3 id="lapidary-step-title" tabIndex={-1}>{t("Set shapes and target sizes", "Tentukan bentuk dan ukuran target")}</h3><p className="lapidary-wizard__intro">{t("Add one specification for each shape and quantity. Each row can use a different shape or size; matched-pair quantities are entered as pairs.", "Tambahkan satu spesifikasi untuk setiap bentuk dan jumlah. Setiap baris dapat memakai bentuk atau ukuran berbeda; jumlah matched pairs dihitung dalam pasang.")}</p>
        <div className="lapidary-spec-list">{items.map((item, index) => <article className="lapidary-spec-item" key={item.id}>
          <div className="lapidary-spec-item__heading"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{workName(item.serviceType)}</strong>{source === "RendiVirgoStock" && selectedProduct(item.productId) ? <small>{selectedProduct(item.productId)?.name}</small> : null}</div>{items.length > 1 ? <button type="button" onClick={() => removeWorkItem(item.id)} aria-label={t(`Remove specification ${index + 1}`, `Hapus spesifikasi ${index + 1}`)}>×</button> : null}</div>
          {item.serviceType === "Other" ? <label className="lapidary-field">{t("Describe the work", "Jelaskan pengerjaan yang dibutuhkan")}<textarea value={item.workDescription} onChange={(event) => updateItem(item.id, { workDescription: event.target.value })} required maxLength={1000} rows={2} placeholder={t("What should the studio make or change?", "Apa yang perlu dibuat atau diubah oleh studio?")} /></label> : null}
          {item.serviceType === "CabochonSuite" ? item.components.map((component) => <div className="lapidary-suite-component" key={component.key}>
            <h4>{component.key === "Pendant" ? t("Pendant · 1 stone per suite", "Pendant · 1 batu per suite") : t("Matching pair · 2 stones per suite", "Sepasang · 2 batu per suite")}</h4>
            {renderShapePicker(component.shapeKey, (shapeKey) => updateComponent(item.id, component.key, { shapeKey, desiredShape: shapeKey === "custom" ? component.desiredShape : "" }), t("Shape for this component", "Bentuk komponen ini"), `${item.id}-${component.key}`)}
            {component.shapeKey === "custom" ? <label className="lapidary-field">{t("Describe the shape", "Jelaskan bentuknya")}<input value={component.desiredShape} onChange={(event) => updateComponent(item.id, component.key, { desiredShape: event.target.value })} required maxLength={120} /></label> : null}
            <fieldset className="lapidary-form__dimensions"><legend>{t("Target size (mm, optional)", "Ukuran target (mm, opsional)")}</legend>{([["lengthMm", t("Length", "Panjang")], ["widthMm", t("Width", "Lebar")], ["depthMm", t("Depth", "Tebal")]] as const).map(([key, label]) => <label key={key}>{label}<input type="number" min="0.1" max="5000" step="0.01" inputMode="decimal" value={component[key]} onChange={(event) => updateComponent(item.id, component.key, { [key]: event.target.value })} /></label>)}</fieldset>
          </div>) : <>
            {renderShapePicker(item.shapeKey, (shapeKey) => updateItem(item.id, { shapeKey, desiredShape: shapeKey === "custom" ? item.desiredShape : "" }), t("Choose a basic shape", "Pilih bentuk dasar"), item.id, item.serviceType === "CabochonPair", item)}
            {item.shapeKey === "custom" || item.serviceType === "DecorationOther" ? <label className="lapidary-field">{t("Describe the shape or form", "Jelaskan bentuk yang diinginkan")}<input value={item.desiredShape} onChange={(event) => updateItem(item.id, { desiredShape: event.target.value })} required maxLength={120} placeholder={t("Describe the outline or form…", "Jelaskan garis bentuk atau wujudnya…")} /></label> : null}
            <fieldset className="lapidary-form__dimensions"><legend>{item.serviceType === "CabochonPair" ? t("Size per cabochon (mm, optional)", "Ukuran per cabochon (mm, opsional)") : t("Target size (mm, optional)", "Ukuran target (mm, opsional)")}</legend>{([["lengthMm", t("Length", "Panjang")], ["widthMm", t("Width", "Lebar")], ["depthMm", t("Depth", "Tebal")]] as const).map(([key, label]) => <label key={key}>{label}<input type="number" max="5000" step="0.01" inputMode="decimal" min={key === "depthMm" && item.domeProfile && item.domeProfile !== "Studio" && item.domeHeightMm ? item.domeHeightMm + .1 : .1} value={item[key]} onChange={(event) => updateItem(item.id, { [key]: event.target.value })} /></label>)}</fieldset>
          </>}
          {domeSettings.enabled && item.shapeKey && item.shapeKey !== "custom" && item.serviceType !== "Other" ? (() => {
            const width = Number(item.widthMm) || Number(cabochonShapes[item.shapeKey as CabochonShape].dimensions.split(" × ")[1]);
            const limit = Math.max(domeSettings.minHeight, Math.min(domeSettings.maxHeight, width * domeSettings.maxWidthRatio));
            const height = Math.min(limit, Math.max(domeSettings.minHeight, item.domeHeightMm ?? domeSettings.defaultHeight));
            const change = (profile: string, value: number) => { updateItem(item.id, { domeProfile: profile, domeHeightMm: Math.round(Math.min(limit, Math.max(domeSettings.minHeight, value)) * 10) / 10 }); setShapePreviewKey(item.id); };
            return <fieldset className="lapidary-dome-controls"><legend>{isId ? domeSettings.labelId : domeSettings.labelEn}</legend><div className="lapidary-dome-controls__profiles">{[["Studio", t("Studio recommendation", "Rekomendasi studio")], ["Low", t("Low", "Rendah")], ["Medium", t("Medium", "Sedang")], ["High", t("High", "Tinggi")]].map(([profile, label]) => <button type="button" key={profile} title={label} aria-label={label} aria-pressed={(item.domeProfile ?? "Studio") === profile} onClick={() => change(profile, domeSettings.defaultHeight * (profile === "Low" ? .6 : profile === "High" ? 1.5 : 1))}>{profile === "Studio" ? t("Studio", "Studio") : label}</button>)}</div>{item.domeProfile && item.domeProfile !== "Studio" ? <><label><span>{t("Dome height above girdle (mm)", "Tinggi dome di atas girdle (mm)")}</span><input aria-label={t("Dome height slider", "Slider tinggi dome")} type="range" min={domeSettings.minHeight} max={limit} step="0.1" value={height} onChange={e => change(item.domeProfile!, Number(e.target.value))} /><input aria-label={t("Dome height in millimetres", "Tinggi dome dalam milimeter")} type="number" min={domeSettings.minHeight} max={limit} step="0.1" value={height} onChange={e => change(item.domeProfile!, Number(e.target.value))} /></label><p>{item.serviceType === "CabochonPair" ? t("Studio confirms dome feasibility for your material. Both cabochons share this setting.", "Studio mengonfirmasi kelayakan dome untuk material Anda. Kedua cabochon memakai pengaturan yang sama.") : t("Studio confirms dome feasibility for your material and total thickness.", "Studio mengonfirmasi kelayakan dome berdasarkan material dan ketebalan total.")}</p></> : <p>{t("The studio will recommend a suitable dome for your stone.", "Studio akan merekomendasikan dome yang sesuai untuk batu Anda.")}</p>}</fieldset>;
          })() : null}
          {source === "RendiVirgoStock" && selectedProduct(item.productId) ? <label className="lapidary-field lapidary-spec-item__quantity lapidary-spec-item__quantity--material">{t("Amount of selected material", "Jumlah material yang dipilih")} ({unitLabel(selectedProduct(item.productId)!.unit)})<input type="number" required min="0.001" max={selectedProduct(item.productId)!.stockQuantity} step="0.001" inputMode="decimal" value={item.materialQuantity} onChange={(event) => updateItem(item.id, { materialQuantity: event.target.value })} /><small>{t(`Available now: ${selectedProduct(item.productId)!.stockQuantity} ${unitLabel(selectedProduct(item.productId)!.unit)}. The studio will confirm stock again; this request does not reserve it.`, `Tersedia saat ini: ${selectedProduct(item.productId)!.stockQuantity} ${unitLabel(selectedProduct(item.productId)!.unit)}. Studio akan memastikan stok kembali; permintaan ini tidak memesan stok.`)}</small></label> : null}
          <label className="lapidary-field lapidary-spec-item__quantity">{item.serviceType === "CabochonSuite" ? t("Number of suites", "Jumlah suite") : item.serviceType === "CabochonPair" ? t("Number of pairs", "Jumlah pasang") : t("Number of finished pieces", "Jumlah hasil pengerjaan")}<input type="number" required min="1" max="500" step="1" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} />{item.serviceType === "CabochonPair" && Number(item.quantity) > 0 ? <small>{t(`${item.quantity} pairs = ${Number(item.quantity) * 2} cabochons`, `${item.quantity} pasang = ${Number(item.quantity) * 2} cabochon`)}</small> : null}</label>
        </article>)}</div>
        {items.length < 8 ? <>
          <button type="button" className="lapidary-add-item" aria-expanded={showAddSpecificationOptions} onClick={() => { setShowAddSpecificationOptions((current) => !current); setNewSpecificationServiceType(""); }}><span>{showAddSpecificationOptions ? "−" : "＋"}</span>{showAddSpecificationOptions ? t("Choose a work type", "Pilih jenis pengerjaan") : t("Add another shape specification", "Tambah spesifikasi bentuk lain")}</button>
          {showAddSpecificationOptions ? <fieldset className="lapidary-add-spec-choice">
            <legend>{t("Choose a work type to add", "Pilih jenis pengerjaan yang akan ditambahkan")}</legend>
            <div className="lapidary-add-spec-choice__options">{serviceChoices.map((choice) => <button type="button" key={choice.value} aria-pressed={newSpecificationServiceType === choice.value} className={newSpecificationServiceType === choice.value ? "is-selected" : ""} onClick={() => setNewSpecificationServiceType(choice.value)}>{isId ? choice.id : choice.en}</button>)}</div>
            <button type="button" className="lapidary-add-item lapidary-add-spec-choice__submit" disabled={!newSpecificationServiceType} onClick={() => {
              if (!newSpecificationServiceType) return;
              addShapeSpecification(newSpecificationServiceType);
              setNewSpecificationServiceType("");
              setShowAddSpecificationOptions(false);
            }}><span>＋</span>{t("Add specification", "Tambahkan spesifikasi")}</button>
          </fieldset> : null}
          <p className="lapidary-wizard__hint">{t("The new row follows the last selected stone. Enter the material amount separately for each specification.", "Baris baru mengikuti material terakhir yang dipilih. Masukkan jumlah material secara terpisah untuk setiap spesifikasi.")}</p>
        </> : <p className="lapidary-wizard__hint">{t("You can add up to 8 shape specifications to this request.", "Anda dapat menambahkan maksimal 8 spesifikasi bentuk dalam satu permintaan.")}</p>}
        <div className="lapidary-field lapidary-date-field">
          <label htmlFor="lapidary-target-date">{t("Preferred completion date (optional)", "Tanggal selesai yang diharapkan (opsional)")}</label>
          <LapidaryDatePicker id="lapidary-target-date" value={targetDate} minDate={today} language={language} onChange={setTargetDate} />
          <small id="lapidary-target-date-hint">{t("This is a preference, not a confirmed delivery date. We will confirm timing with your quote.", "Ini adalah preferensi, bukan tanggal penyelesaian yang dikonfirmasi. Jadwal akan disepakati bersama penawaran.")}</small>
        </div>
      </section> : null}

      {step === 3 ? <section className="lapidary-wizard__panel" aria-labelledby="lapidary-step-title">
        <p className="lapidary-eyebrow">{t("STEP 04 · FINISH & REFERENCES", "LANGKAH 04 · FINISHING & REFERENSI")}</p><h3 id="lapidary-step-title" tabIndex={-1}>{t("Share the finish you prefer", "Sampaikan hasil akhir yang Anda inginkan")}</h3><p className="lapidary-wizard__intro">{t("You can choose a finish now or ask the studio to recommend one for the material.", "Anda bisa memilih finishing atau meminta studio merekomendasikan hasil yang sesuai dengan material.")}</p>
        <fieldset className="lapidary-finish-picker"><legend>{t("Finish preference", "Preferensi finishing")}</legend><div>{([
          { value: "HighGloss", label: t("High gloss", "Kilap tinggi") },
          { value: "SatinMatte", label: t("Satin or matte", "Satin atau matte") },
          { value: "Natural", label: t("Keep natural", "Pertahankan alami") },
          { value: "NotSure", label: t("Recommend for me", "Rekomendasikan") },
          { value: "Other", label: t("Other", "Lainnya") },
        ] as const).map(({ value, label }) => <button type="button" aria-pressed={finish === value} className={finish === value ? "is-selected" : ""} key={value} onClick={() => setFinish(value)}>{label}</button>)}</div></fieldset>
        {finish === "Other" ? <label className="lapidary-field lapidary-finish-custom">{t("Describe your preferred finish", "Jelaskan finishing yang Anda inginkan")}<input value={customFinish} onChange={(event) => setCustomFinish(event.target.value)} required maxLength={500} placeholder={t("Describe the surface or treatment…", "Jelaskan permukaan atau perlakuan yang diinginkan…")} /></label> : null}
        <label className="lapidary-field">{t("Additional requirements or questions (optional)", "Kebutuhan atau pertanyaan tambahan (opsional)")}<textarea value={additionalDetails} onChange={(event) => setAdditionalDetails(event.target.value)} maxLength={8000} rows={4} placeholder={t("Intended use, constraints, setting notes, or anything else the studio should know…", "Tujuan penggunaan, batasan, catatan setting, atau informasi lain untuk studio…")} /></label>
        <label className="lapidary-field lapidary-reference-links">{t("Reference links (optional)", "Tautan referensi (opsional)")}<textarea value={referenceLinks} onChange={(event) => setReferenceLinks(event.target.value)} maxLength={5000} rows={3} placeholder="https://…" /><small>{t("Add up to 5 http or https links, one link per line.", "Tambahkan maksimal 5 tautan http atau https, satu tautan per baris.")}</small></label>
        <MediaPicker isId={isId} files={mediaFiles} previews={mediaPreviews} onChange={addMedia} onRemove={(index) => setMediaFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
      </section> : null}

      {step === 4 ? <section className="lapidary-wizard__panel" aria-labelledby="lapidary-step-title">
        <p className="lapidary-eyebrow">{t("STEP 05 · CONTACT & REVIEW", "LANGKAH 05 · KONTAK & RINGKASAN")}</p><h3 id="lapidary-step-title" tabIndex={-1}>{t("Where should we send your assessment?", "Ke mana kami mengirim hasil peninjauan?")}</h3><p className="lapidary-wizard__intro">{t("An account is optional. We’ll use these details to review your request and send updates by email.", "Akun bersifat opsional. Informasi ini digunakan untuk meninjau permintaan dan mengirim pembaruan melalui email.")}</p>
        {accountProfile ? <p className="lapidary-wizard__hint" role="status">{email.trim().toLowerCase() === accountProfile.email.trim().toLowerCase() ? t(`Signed in as ${accountProfile.email}. This request will appear in your account.`, `Anda masuk sebagai ${accountProfile.email}. Permintaan ini akan muncul di akun Anda.`) : t("Use your account email to link this request automatically. If you enter another email, the secure project link will be sent there instead.", "Gunakan email akun agar permintaan ini otomatis terhubung. Jika memakai email lain, tautan proyek yang aman akan dikirim ke email tersebut.")}</p> : <p className="lapidary-wizard__hint">{t("After sending, you’ll receive a secure account link by email. You can use it to create an account or sign in and follow this project; email updates will continue.", "Setelah mengirim, Anda akan menerima tautan akun yang aman melalui email. Gunakan untuk membuat akun atau masuk dan memantau proyek ini; pembaruan email tetap dikirimkan.")}</p>}
        <div className="lapidary-form__grid lapidary-contact-grid">
          <label>{t("Full name", "Nama lengkap")}<input autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={(event) => { contactEdited.current = true; setName(event.target.value); }} /></label>
          <label>{t("Email address", "Alamat email")}<input type="email" autoComplete="email" required maxLength={200} value={email} onChange={(event) => { contactEdited.current = true; setEmail(event.target.value); }} /></label>
          <div className="lapidary-contact-phone"><label htmlFor="lapidary-contact-phone-input">{t("WhatsApp / phone", "WhatsApp / telepon")}</label><div className="lapidary-phone-control"><CountryCallingCodeDropdown id="lapidary-phone-country" value={phoneCountry} onChange={(value) => { contactEdited.current = true; setPhoneCountry(value); }} locale={isId ? "id-ID" : "en"} ariaLabel={t("Phone country calling code", "Kode telepon negara")} /><input id="lapidary-contact-phone-input" type="tel" autoComplete="tel-national" required maxLength={40} inputMode="tel" placeholder="201 555 0123" value={phone} onChange={(event) => { contactEdited.current = true; updatePhone(event.target.value); }} /></div><small>{t("Choose a calling code, then enter the number without it. You can also paste a full international number.", "Pilih kode telepon, lalu masukkan nomor tanpa kode tersebut. Anda juga bisa menempelkan nomor internasional lengkap.")}</small></div>
          <div className="lapidary-contact-country"><span className="lapidary-form__field-label">{t("Country", "Negara")}</span><CountryDropdown id="lapidary-contact-country" value={country} onChange={(value) => { contactEdited.current = true; setCountry(value); }} locale={isId ? "id-ID" : "en"} ariaLabel={t("Country", "Negara")} searchPlaceholder={t("Search countries…", "Cari negara…")} emptyMessage={t("No country found.", "Negara tidak ditemukan.")} name="country" required /></div>
          <label className="lapidary-form__full">{t("Company (optional)", "Perusahaan (opsional)")}<input autoComplete="organization" maxLength={160} value={company} onChange={(event) => { contactEdited.current = true; setCompany(event.target.value); }} /></label>
        </div>
        <div className="lapidary-review"><div className="lapidary-review__heading"><div><p className="lapidary-eyebrow">{t("PROJECT SUMMARY", "RINGKASAN PROYEK")}</p><h4>{t("Review before sending", "Periksa sebelum mengirim")}</h4></div><span>{items.length} {t(items.length === 1 ? "shape specification" : "shape specifications", "spesifikasi bentuk")}</span></div>
          <dl><div className="lapidary-review__material"><dt>{t("Material", "Material")}</dt><dd>{source === "CustomerSupplied" ? t("Customer supplied", "Dari pelanggan") : source === "RendiVirgoStock" ? selectedProductIds.map((id) => selectedProduct(id)?.name).filter(Boolean).join(", ") : t("Studio guidance requested", "Meminta panduan studio")}</dd></div>
            {source === "CustomerSupplied" ? <div className="lapidary-review__stone"><dt>{t("Stone", "Batu")}</dt><dd>{materialDescription} · {materialWeight} {weightUnit}{materialOrigin ? ` · ${materialOrigin}` : ""}{materialCondition ? ` · ${materialCondition}` : ""}<small>{mediaFiles.length} {t("reference files", "berkas referensi")}{mediaFiles.length ? ` · ${mediaFiles.map((file) => file.name).join(", ")}` : ""}</small></dd></div> : null}
            {source === "Undecided" && materialDescription ? <div><dt>{t("Material brief", "Brief material")}</dt><dd>{materialDescription}</dd></div> : null}
            {items.map((item, index) => {
              const product = source === "RendiVirgoStock" ? selectedProduct(item.productId) : undefined;
              const count = Number(item.quantity);
              const feePerUnit = serviceUnitFee(item.serviceType);
              const feeUnit = item.serviceType === "CabochonPair" ? t("pair", "pasang") : t("piece", "buah");
              return <div className="lapidary-review__item" key={item.id}><dt>{t("Work", "Pengerjaan")} {index + 1}</dt><dd>
                <strong>{workName(item.serviceType)}</strong>
                {product ? <span>{product.name} · {t("Material requested", "Material yang diminta")}: {item.materialQuantity || "—"} {unitLabel(product.unit)} <small>({t(`${product.stockQuantity} available now`, `tersedia ${product.stockQuantity} saat ini`)})</small></span> : null}
                {item.workDescription ? <span>{item.workDescription}</span> : null}
                {item.serviceType === "CabochonSuite" ? <ul>{item.components.map((component) => <li key={component.key}><strong>{component.key === "Pendant" ? t("Pendant · 1 stone", "Pendant · 1 batu") : t("Matching pair · 2 stones", "Sepasang · 2 batu")}</strong><span>{shapeLabel(component.shapeKey)}{component.desiredShape ? ` · ${component.desiredShape}` : ""}</span><span>{dimensionSummary(component.lengthMm, component.widthMm, component.depthMm)}</span></li>)}<li>{t("Output", "Hasil")}: {count} {count === 1 ? t("suite", "suite") : t("suites", "suite")}</li></ul> : <><span>{item.domeProfile && item.domeProfile !== "Studio" ? `Dome: ${item.domeProfile} · ${item.domeHeightMm} mm` : t("Dome: studio recommendation", "Dome: rekomendasi studio")}</span><span>{shapeLabel(item.shapeKey)}{item.desiredShape ? ` · ${item.desiredShape}` : ""}</span><span>{dimensionSummary(item.lengthMm, item.widthMm, item.depthMm)}</span><span>{t("Output", "Hasil")}: {count} {item.serviceType === "CabochonPair" ? (count === 1 ? t("pair", "pasang") : t("pairs", "pasang")) : (count === 1 ? t("piece", "buah") : t("pieces", "buah"))}</span></>}
                {feePerUnit !== null ? <span className="lapidary-review__item-fee">{t("Estimated service fee", "Estimasi biaya jasa")}: {formatUsd(feePerUnit)} × {count} {feeUnit} = <strong>{formatUsd(feePerUnit * count)}</strong></span> : <span className="lapidary-review__item-fee">{item.serviceType === "Other" ? t("Service fee quoted after studio review", "Biaya jasa ditawarkan setelah ditinjau studio") : t("Service fee estimate unavailable", "Estimasi biaya jasa belum tersedia")}</span>}
              </dd></div>;
            })}
            {pricedServiceCount ? <div className="lapidary-review__fee-total"><dt>{hasUnpricedService ? t("Estimated cabochon service subtotal", "Subtotal estimasi jasa cabochon") : t("Estimated service fees", "Estimasi biaya jasa")}</dt><dd><strong>{formatUsd(estimatedServiceFeeTotal)} USD</strong><small>{t("Indicative service fees only. Materials, shipping, and any Other work are not included; the studio will confirm the final written quote.", "Estimasi biaya jasa. Material, pengiriman, dan pengerjaan Lainnya belum termasuk; studio akan mengonfirmasi penawaran tertulis akhir.")}</small></dd></div> : null}
            <div><dt>{t("Finish", "Finishing")}</dt><dd>{finish === "HighGloss" ? t("High gloss", "Kilap tinggi") : finish === "SatinMatte" ? t("Satin or matte", "Satin atau matte") : finish === "Natural" ? t("Keep natural", "Pertahankan alami") : finish === "Other" ? `${t("Other", "Lainnya")} · ${customFinish}` : t("Studio recommendation", "Rekomendasi studio")}</dd></div>
            {additionalDetails.trim() ? <div><dt>{t("Additional notes", "Catatan tambahan")}</dt><dd>{additionalDetails}</dd></div> : null}
            {referenceLinks.trim() ? <div><dt>{t("Reference links", "Tautan referensi")}</dt><dd>{referenceLinks.split(/\n+/).map((link) => link.trim()).filter(Boolean).join(" · ")}</dd></div> : null}
            {source !== "CustomerSupplied" && mediaFiles.length ? <div><dt>{t("Reference files", "Berkas referensi")}</dt><dd>{mediaFiles.length} {t("photo or video files", "berkas foto atau video")}<small>{mediaFiles.map((file) => file.name).join(", ")}</small></dd></div> : null}
            {targetDate ? <div><dt>{t("Preferred date", "Tanggal pilihan")}</dt><dd>{targetDate}</dd></div> : null}
            <div className="lapidary-review__contact"><dt>{t("Contact", "Kontak")}</dt><dd><strong>{name}</strong><span>{email}</span>{internationalPhoneNumber(phoneCountry, phone) ? <span>{countryFlagEmoji(phoneCountry)} {internationalPhoneNumber(phoneCountry, phone)} · {countryNameForCode(country, isId ? "id-ID" : "en") ?? country}</span> : null}{company ? <span>{company}</span> : null}</dd></div>
          </dl>
          <button type="button" className="lapidary-review__edit" onClick={() => { setStep(0); setError(""); }}>{t("Edit project details", "Ubah detail proyek")} ↗</button>
        </div>
        <label className="lapidary-form__honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
        <label className="lapidary-form__consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>{t("I understand this is a request for assessment and a quote. No work or payment is confirmed until I approve the written quote and the studio confirms the material arrangements.", "Saya memahami ini adalah permintaan penilaian dan penawaran. Pengerjaan dan pembayaran belum dikonfirmasi sampai saya menyetujui penawaran tertulis dan studio mengonfirmasi pengaturan material.")}</span></label>
      </section> : null}

      {error ? <p className="lapidary-form__error" role="alert">{error}</p> : null}
      <div className="lapidary-wizard__actions">
        <button className="lapidary-wizard__back" type="button" onClick={() => { setStep((current) => Math.max(0, current - 1)); setError(""); }} disabled={step === 0 || sending}><span aria-hidden="true">←</span>{t("Back", "Kembali")}</button>
        <span className="lapidary-wizard__step-label">{isId ? steps[step].id : steps[step].en}</span>
        {step < 4 ? <button className="lapidary-button lapidary-wizard__next" type="button" onClick={advance}>{t("Continue", "Lanjutkan")}<span aria-hidden="true">→</span></button> : <button className="lapidary-button lapidary-wizard__next" type="submit" disabled={sending}>{sending ? t("Sending…", "Mengirim…") : t("Send quote request", "Kirim permintaan penawaran")}<span aria-hidden="true">→</span></button>}
      </div>
      <p className="lapidary-form__privacy">{t("Your contact details and uploaded references are shared only with the RENDI VIRGO studio team for this request.", "Informasi kontak dan referensi yang diunggah hanya dibagikan kepada tim studio RENDI VIRGO untuk permintaan ini.")}</p>
    </form>
  </div>;
}

function MediaPicker({ isId, files, previews, onChange, onRemove }: { isId: boolean; files: File[]; previews: string[]; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; onRemove: (index: number) => void }) {
  const t = (en: string, id: string) => isId ? id : en;
  return <div className="lapidary-media-picker lapidary-form__full">
    <div className="lapidary-media-picker__heading"><div><h4>{t("Photos or video", "Foto atau video")}</h4><p>{t("Up to 5 private reference files · JPEG, PNG, WebP, AVIF, or MP4 · 6 MB each, up to 30 MB total", "Maksimal 5 berkas referensi privat · JPEG, PNG, WebP, AVIF, atau MP4 · 6 MB per berkas, total maksimal 30 MB")}</p></div><label className="lapidary-media-picker__button">{t("Add files", "Tambah berkas")}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4" multiple onChange={onChange} /></label></div>
    {files.length ? <div className="lapidary-media-previews">{files.map((file, index) => <article key={`${file.name}-${file.lastModified}-${index}`}><div>{file.type.startsWith("video/") ? <video src={previews[index]} muted /> : <img src={previews[index]} alt={file.name} />}</div><p title={file.name}>{file.name}</p><small>{(file.size / (1024 * 1024)).toFixed(1)} MB</small><button type="button" onClick={() => onRemove(index)} aria-label={t(`Remove ${file.name}`, `Hapus ${file.name}`)}>×</button></article>)}</div> : <p className="lapidary-media-picker__empty">{t("Add clear photos or a short video to show the material, shape, or finish you have in mind.", "Tambahkan foto yang jelas atau video singkat untuk menunjukkan material, bentuk, atau finishing yang Anda inginkan.")}</p>}
  </div>;
}
