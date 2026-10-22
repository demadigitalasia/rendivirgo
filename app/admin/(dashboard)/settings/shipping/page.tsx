"use client";

import { useMemo, useState } from "react";
import { apiFetch, apiUrl, errorMessage, formatNumber, formatUSD, useApi, type ApiState } from "@/components/admin/api";
import { DataTable, type Column } from "@/components/admin/data-table";
import { toast } from "@/components/admin/toast";
import { CountryDropdown } from "@/components/country-dropdown";
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  Field,
  KeyValue,
  Loading,
  Modal,
  PageHeader,
  Select,
  Switch,
  TextInput,
} from "@/components/admin/ui";
import { countryCodeForName, countryNameForCode, WORLDWIDE_REGION_VALUE } from "@/lib/countries";

type ShippingRate = {
  id: string;
  name: string;
  carrier: string | null;
  region: string;
  minWeightGram: number;
  maxWeightGram: number | null;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  price: number;
  handlingFee: number;
  insuranceFee: number;
  fragileFee: number;
  oversizedFee: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ShippingProfile = {
  id: string;
  name: string;
  packageWeightGram: number;
  packageLengthMm: number | null;
  packageWidthMm: number | null;
  packageHeightMm: number | null;
  shippingClass: string;
  calculationMethod: string;
  packageModel: string;
  handlingFee: number;
  insuranceFee: number;
  fragileFee: number;
  oversizedFee: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type ShippingQuote = {
  options: Array<{
    id: string;
    name: string;
    carrier: string | null;
    price: number;
    deliveryMinDays: number | null;
    deliveryMaxDays: number | null;
    breakdown: { base: number; handling: number; fragile: number; oversized: number; total: number };
  }>;
  source: "CarrierAPI" | "AdminOverride" | "FreeShipping";
  overrideApplied: boolean;
};

type RateForm = {
  name: string;
  carrier: string;
  region: string;
  minWeightGram: string;
  maxWeightGram: string;
  deliveryMinDays: string;
  deliveryMaxDays: string;
  price: string;
  handlingFee: string;
  insuranceFee: string;
  fragileFee: string;
  oversizedFee: string;
  sortOrder: string;
  isActive: boolean;
};

type BulkRateForm = {
  price: string;
  deliveryMinDays: string;
  deliveryMaxDays: string;
  handlingFee: string;
  insuranceFee: string;
  fragileFee: string;
  oversizedFee: string;
};

type ProfileForm = {
  name: string;
  packageWeightGram: string;
  packageLengthMm: string;
  packageWidthMm: string;
  packageHeightMm: string;
  shippingClass: string;
  calculationMethod: string;
  packageModel: string;
  handlingFee: string;
  insuranceFee: string;
  fragileFee: string;
  oversizedFee: string;
  isDefault: boolean;
};

type QuoteForm = {
  weightGram: string;
  subtotal: string;
  countryCode: string;
  shippingClass: string;
};

type ShippingImportPreview = {
  sheetName: string;
  carrier: { key: string; label: string; values: string[] } | null;
  rowCount: number;
  validCount: number;
  invalidCount: number;
  totalIssues: number;
  issues: Array<{ row: number; messages: string[] }>;
  createdCount: number;
  updatedCount: number;
  canImport: boolean;
};

const emptyRateForm: RateForm = {
  name: "",
  carrier: "",
  region: WORLDWIDE_REGION_VALUE,
  minWeightGram: "0",
  maxWeightGram: "",
  deliveryMinDays: "3",
  deliveryMaxDays: "7",
  price: "0",
  handlingFee: "0",
  insuranceFee: "0",
  fragileFee: "0",
  oversizedFee: "0",
  sortOrder: "0",
  isActive: true,
};

const emptyBulkRateForm: BulkRateForm = {
  price: "",
  deliveryMinDays: "",
  deliveryMaxDays: "",
  handlingFee: "",
  insuranceFee: "",
  fragileFee: "",
  oversizedFee: "",
};

const rateSortOptions = [
  { value: "default", label: "Default order" },
  { value: "country-asc", label: "Country A–Z" },
  { value: "country-desc", label: "Country Z–A" },
  { value: "courier-asc", label: "Courier A–Z" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "weight-asc", label: "Weight: light to heavy" },
  { value: "weight-desc", label: "Weight: heavy to light" },
  { value: "name-asc", label: "Rate name A–Z" },
  { value: "status", label: "Status" },
];

const emptyProfileForm: ProfileForm = {
  name: "",
  packageWeightGram: "0",
  packageLengthMm: "",
  packageWidthMm: "",
  packageHeightMm: "",
  shippingClass: "Standard",
  calculationMethod: "CarrierAPI",
  packageModel: "SinglePackageTotalWeight",
  handlingFee: "0",
  insuranceFee: "0",
  fragileFee: "0",
  oversizedFee: "0",
  isDefault: false,
};

const shippingClassOptions = [
  { value: "Standard", label: "Standard" },
  { value: "Fragile", label: "Fragile" },
  { value: "Oversized", label: "Oversized" },
  { value: "Custom", label: "Custom" },
];

const quoteClassOptions = [
  { value: "Standard", label: "Standard" },
  { value: "Fragile", label: "Fragile" },
  { value: "Oversized", label: "Oversized" },
];

const calculationOptions = [
  { value: "CarrierAPI", label: "Carrier API" },
  { value: "AdminOverride", label: "Admin override" },
];

const asOptionalDimension = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : Number.NaN;
};

const profileFeeTotal = (profile: ShippingProfile) =>
  profile.handlingFee + profile.insuranceFee + profile.fragileFee + profile.oversizedFee;

const deliveryWindowLabel = (minDays: number, maxDays: number) =>
  minDays === maxDays
    ? `${minDays} business day${minDays === 1 ? "" : "s"}`
    : `${minDays}–${maxDays} business days`;

const destinationName = (region: string) => {
  const code = countryCodeForName(region);
  return code ? countryNameForCode(code) ?? region : region;
};

export default function AdminShippingPage() {
  const ratesState: ApiState<ShippingRate[]> = useApi<ShippingRate[]>("/api/admin/shipping/rates");
  const profilesState: ApiState<ShippingProfile[]> = useApi<ShippingProfile[]>("/api/admin/shipping/profiles");

  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);
  const [rateForm, setRateForm] = useState<RateForm>(emptyRateForm);
  const [rateError, setRateError] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);
  const [togglingRateId, setTogglingRateId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState("merge");
  const [importPreview, setImportPreview] = useState<ShippingImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [importingRates, setImportingRates] = useState(false);
  const [exportingCarrier, setExportingCarrier] = useState<string | null>(null);
  const [rateSearch, setRateSearch] = useState("");
  const [rateCarrierFilter, setRateCarrierFilter] = useState("");
  const [rateDestinationFilter, setRateDestinationFilter] = useState("");
  const [rateStatusFilter, setRateStatusFilter] = useState("");
  const [rateSort, setRateSort] = useState("default");
  const [selectedRateIds, setSelectedRateIds] = useState<string[]>([]);
  const [bulkRateModalOpen, setBulkRateModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkRateForm, setBulkRateForm] = useState<BulkRateForm>(emptyBulkRateForm);
  const [bulkRateError, setBulkRateError] = useState<string | null>(null);
  const [bulkRatesBusy, setBulkRatesBusy] = useState(false);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ShippingProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [quoteForm, setQuoteForm] = useState<QuoteForm>({
    weightGram: "500",
    subtotal: "",
    countryCode: "ID",
    shippingClass: "Standard",
  });
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const setRateField = <K extends keyof RateForm>(key: K, value: RateForm[K]) =>
    setRateForm((current) => ({ ...current, [key]: value }));

  const setProfileField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setProfileForm((current) => ({ ...current, [key]: value }));

  const setQuoteField = <K extends keyof QuoteForm>(key: K, value: QuoteForm[K]) =>
    setQuoteForm((current) => ({ ...current, [key]: value }));

  const rates = ratesState.data ?? [];
  const rateCarriers = useMemo(
    () => Array.from(new Set(rates.map((rate) => rate.carrier?.trim() || "").filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rates],
  );
  const rateDestinations = useMemo(
    () => Array.from(new Set(rates.map((rate) => rate.region.trim()).filter(Boolean)))
      .sort((a, b) => destinationName(a).localeCompare(destinationName(b))),
    [rates],
  );
  const visibleRates = useMemo(() => {
    const query = rateSearch.trim().toLocaleLowerCase();
    const filtered = rates.filter((rate) => {
      const matchesSearch = !query || [rate.name, rate.carrier ?? "", rate.region, destinationName(rate.region)]
        .some((value) => value.toLocaleLowerCase().includes(query));
      const matchesCarrier = !rateCarrierFilter || (rate.carrier?.trim() || "") === rateCarrierFilter;
      const matchesDestination = !rateDestinationFilter || rate.region.trim() === rateDestinationFilter;
      const matchesStatus = !rateStatusFilter || (rate.isActive ? "active" : "inactive") === rateStatusFilter;
      return matchesSearch && matchesCarrier && matchesDestination && matchesStatus;
    });
    if (rateSort === "default") return filtered;

    return filtered.sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      switch (rateSort) {
        case "country-asc": return destinationName(a.region).localeCompare(destinationName(b.region)) || byName;
        case "country-desc": return destinationName(b.region).localeCompare(destinationName(a.region)) || byName;
        case "courier-asc": return (a.carrier ?? "").localeCompare(b.carrier ?? "") || byName;
        case "price-asc": return a.price - b.price || byName;
        case "price-desc": return b.price - a.price || byName;
        case "weight-asc": return a.minWeightGram - b.minWeightGram || byName;
        case "weight-desc": return b.minWeightGram - a.minWeightGram || byName;
        case "name-asc": return byName;
        case "status": return Number(b.isActive) - Number(a.isActive) || byName;
        default: return 0;
      }
    });
  }, [rates, rateSearch, rateCarrierFilter, rateDestinationFilter, rateStatusFilter, rateSort]);

  const openCreateRate = () => {
    setEditingRate(null);
    setRateForm(emptyRateForm);
    setRateError(null);
    setRateModalOpen(true);
  };

  const openEditRate = (rate: ShippingRate) => {
    setEditingRate(rate);
    setRateForm({
      name: rate.name,
      carrier: rate.carrier ?? "",
      region: rate.region.trim().toLowerCase() === "worldwide"
        ? WORLDWIDE_REGION_VALUE
        : countryCodeForName(rate.region) ?? rate.region,
      minWeightGram: String(rate.minWeightGram),
      maxWeightGram: rate.maxWeightGram === null ? "" : String(rate.maxWeightGram),
      deliveryMinDays: String(rate.deliveryMinDays),
      deliveryMaxDays: String(rate.deliveryMaxDays),
      price: String(rate.price),
      handlingFee: String(rate.handlingFee),
      insuranceFee: String(rate.insuranceFee),
      fragileFee: String(rate.fragileFee),
      oversizedFee: String(rate.oversizedFee),
      sortOrder: String(rate.sortOrder),
      isActive: rate.isActive,
    });
    setRateError(null);
    setRateModalOpen(true);
  };

  const saveRate = async () => {
    const name = rateForm.name.trim();
    if (name.length < 2) {
      setRateError("Name must be at least 2 characters.");
      return;
    }

    const minWeightGram = Math.trunc(Number(rateForm.minWeightGram));
    if (!Number.isFinite(minWeightGram) || minWeightGram < 0) {
      setRateError("Minimum weight must be 0 or more.");
      return;
    }

    const maxWeightGram = rateForm.maxWeightGram.trim() === "" ? null : Math.trunc(Number(rateForm.maxWeightGram));
    if (maxWeightGram !== null && (!Number.isFinite(maxWeightGram) || maxWeightGram < minWeightGram)) {
      setRateError("Maximum weight must be greater than or equal to the minimum.");
      return;
    }

    const deliveryMinDays = Math.trunc(Number(rateForm.deliveryMinDays));
    const deliveryMaxDays = Math.trunc(Number(rateForm.deliveryMaxDays));
    if (!Number.isFinite(deliveryMinDays) || deliveryMinDays < 1 || deliveryMinDays > 365) {
      setRateError("Minimum delivery time must be between 1 and 365 business days.");
      return;
    }
    if (!Number.isFinite(deliveryMaxDays) || deliveryMaxDays < deliveryMinDays || deliveryMaxDays > 365) {
      setRateError("Maximum delivery time must be between the minimum and 365 business days.");
      return;
    }

    const price = Number(rateForm.price);
    if (!Number.isFinite(price) || price < 0) {
      setRateError("Price must be 0 or more.");
      return;
    }

    const fees: Array<[string, number]> = [
      ["Handling fee", Number(rateForm.handlingFee)],
      ["Insurance fee", Number(rateForm.insuranceFee)],
      ["Fragile fee", Number(rateForm.fragileFee)],
      ["Oversized fee", Number(rateForm.oversizedFee)],
    ];
    for (const [label, value] of fees) {
      if (!Number.isFinite(value) || value < 0) {
        setRateError(`${label} must be 0 or more.`);
        return;
      }
    }

    const payload = {
      name,
      carrier: rateForm.carrier.trim() || null,
      region: rateForm.region.trim() || WORLDWIDE_REGION_VALUE,
      minWeightGram,
      maxWeightGram,
      deliveryMinDays,
      deliveryMaxDays,
      price,
      handlingFee: Number(rateForm.handlingFee),
      insuranceFee: Number(rateForm.insuranceFee),
      fragileFee: Number(rateForm.fragileFee),
      oversizedFee: Number(rateForm.oversizedFee),
      isActive: rateForm.isActive,
      sortOrder: Math.trunc(Number(rateForm.sortOrder) || 0),
    };

    setSavingRate(true);
    setRateError(null);
    try {
      if (editingRate) {
        await apiFetch(`/api/admin/shipping/rates/${editingRate.id}`, { method: "PATCH", json: payload });
        toast.success(`Rate "${payload.name}" updated`);
      } else {
        await apiFetch("/api/admin/shipping/rates", { json: payload });
        toast.success(`Rate "${payload.name}" created`);
      }
      setRateModalOpen(false);
      ratesState.refresh();
    } catch (error) {
      setRateError(errorMessage(error));
    } finally {
      setSavingRate(false);
    }
  };

  const toggleRate = async (rate: ShippingRate) => {
    setTogglingRateId(rate.id);
    try {
      await apiFetch(`/api/admin/shipping/rates/${rate.id}/toggle`, { method: "PATCH" });
      toast.success(`Rate "${rate.name}" ${rate.isActive ? "deactivated" : "activated"}`);
      ratesState.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTogglingRateId(null);
    }
  };

  const removeRate = async (rate: ShippingRate) => {
    try {
      await apiFetch(`/api/admin/shipping/rates/${rate.id}`, { method: "DELETE" });
      toast.success(`Rate "${rate.name}" deleted`);
      ratesState.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const toggleRateSelection = (id: string) => {
    setSelectedRateIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  };

  const toggleVisibleRateSelection = (checked: boolean) => {
    const visibleIds = visibleRates.map((rate) => rate.id);
    setSelectedRateIds((current) => checked
      ? Array.from(new Set([...current, ...visibleIds]))
      : current.filter((id) => !visibleIds.includes(id)));
  };

  const runBulkRateUpdate = async (changes: Record<string, number | boolean>, successLabel: string) => {
    if (!selectedRateIds.length) return false;
    setBulkRatesBusy(true);
    try {
      const result = await apiFetch<{ updatedCount: number }>("/api/admin/shipping/rates/bulk", {
        method: "PATCH",
        json: { ids: selectedRateIds, ...changes },
      });
      toast.success(`${successLabel}: ${formatNumber(result.updatedCount)} rate(s)`);
      setSelectedRateIds([]);
      ratesState.refresh();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    } finally {
      setBulkRatesBusy(false);
    }
  };

  const openBulkRateEdit = () => {
    setBulkRateForm(emptyBulkRateForm);
    setBulkRateError(null);
    setBulkRateModalOpen(true);
  };

  const setBulkRateField = <K extends keyof BulkRateForm>(key: K, value: BulkRateForm[K]) =>
    setBulkRateForm((current) => ({ ...current, [key]: value }));

  const saveBulkRateEdit = async () => {
    const changes: Record<string, number> = {};
    const numericFields: Array<[keyof BulkRateForm, string, boolean]> = [
      ["price", "Base rate", false],
      ["deliveryMinDays", "Minimum delivery time", true],
      ["deliveryMaxDays", "Maximum delivery time", true],
      ["handlingFee", "Handling fee", false],
      ["insuranceFee", "Insurance fee", false],
      ["fragileFee", "Fragile fee", false],
      ["oversizedFee", "Oversized fee", false],
    ];
    for (const [key, label, integer] of numericFields) {
      const rawValue = bulkRateForm[key].trim();
      if (!rawValue) continue;
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < 0 || (integer && (!Number.isInteger(value) || value < 1 || value > 365))) {
        setBulkRateError(integer
          ? `${label} must be a whole number from 1 to 365 days.`
          : `${label} must be 0 or more.`);
        return;
      }
      changes[key] = value;
    }
    if (!Object.keys(changes).length) {
      setBulkRateError("Enter at least one value to apply to the selected rates.");
      return;
    }

    setBulkRateError(null);
    if (await runBulkRateUpdate(changes, "Updated")) setBulkRateModalOpen(false);
  };

  const deleteSelectedRates = async () => {
    if (!selectedRateIds.length) return;
    setBulkRatesBusy(true);
    try {
      const result = await apiFetch<{ deletedCount: number }>("/api/admin/shipping/rates/bulk", {
        method: "DELETE",
        json: { ids: selectedRateIds },
      });
      toast.success(`Deleted ${formatNumber(result.deletedCount)} shipping rate(s)`);
      setSelectedRateIds([]);
      setBulkDeleteModalOpen(false);
      ratesState.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBulkRatesBusy(false);
    }
  };

  const openImportModal = () => {
    setImportFile(null);
    setImportMode("merge");
    setImportPreview(null);
    setImportError(null);
    setImportModalOpen(true);
  };

  const closeImportModal = () => {
    if (previewingImport || importingRates) return;
    setImportModalOpen(false);
  };

  const exportRates = async (carrier: "all" | "dhl" | "fedex" | "post-office") => {
    setExportingCarrier(carrier);
    try {
      const response = await fetch(apiUrl(`/api/admin/shipping/rates/export?carrier=${carrier}`), { credentials: "same-origin" });
      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
          ? await response.json().catch(() => null)
          : { message: await response.text().catch(() => "") };
        const message = Array.isArray(payload?.message) ? payload.message.join(", ") : payload?.message;
        if (response.status === 401) window.location.assign("/admin/login?expired=1");
        throw new Error(message || `Export failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `shipping-rates-${carrier}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      const label = carrier === "all" ? "all carriers" : carrier === "post-office" ? "Post Office (Pos Indonesia)" : carrier.toUpperCase();
      toast.success(`Shipping rates exported: ${label}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExportingCarrier(null);
    }
  };

  const previewImport = async () => {
    if (!importFile) {
      setImportError("Choose an .xlsx workbook first.");
      return;
    }
    setPreviewingImport(true);
    setImportError(null);
    setImportPreview(null);
    try {
      const form = new FormData();
      form.append("file", importFile);
      form.append("mode", importMode);
      const preview = await apiFetch<ShippingImportPreview>("/api/admin/shipping/rates/import/preview", {
        method: "POST",
        body: form,
      });
      setImportPreview(preview);
    } catch (error) {
      setImportError(errorMessage(error));
    } finally {
      setPreviewingImport(false);
    }
  };

  const applyImport = async () => {
    if (!importFile || !importPreview?.canImport) return;
    if (importMode === "replace") {
      const carrierLabel = importPreview.carrier?.label;
      if (!carrierLabel) {
        setImportError("The workbook must contain exactly one carrier group before it can replace rates.");
        return;
      }
      const confirmed = window.confirm(
        `Replace ${carrierLabel} rates? This will remove ${carrierLabel} rates, including inactive ones, then import ${importPreview.rowCount} rows. Other carriers will be kept.`,
      );
      if (!confirmed) return;
    }
    setImportingRates(true);
    setImportError(null);
    try {
      const form = new FormData();
      form.append("file", importFile);
      form.append("mode", importMode);
      const result = await apiFetch<{
        importedCount: number;
        skippedCount: number;
        createdCount: number;
        updatedCount: number;
        deletedCount: number;
        mode: string;
        carrier: string;
      }>("/api/admin/shipping/rates/import", { method: "POST", body: form });
      toast.success(
        result.mode === "replace"
          ? `Replaced ${result.deletedCount} ${result.carrier} rate(s) with ${result.importedCount} imported rate(s)`
          : `Imported ${result.importedCount} rate(s): ${result.createdCount} created, ${result.updatedCount} updated${result.skippedCount ? `, ${result.skippedCount} skipped for review` : ""}`,
      );
      setImportModalOpen(false);
      ratesState.refresh();
    } catch (error) {
      setImportError(errorMessage(error));
    } finally {
      setImportingRates(false);
    }
  };

  const openCreateProfile = () => {
    setEditingProfile(null);
    setProfileForm(emptyProfileForm);
    setProfileError(null);
    setProfileModalOpen(true);
  };

  const openEditProfile = (profile: ShippingProfile) => {
    setEditingProfile(profile);
    setProfileForm({
      name: profile.name,
      packageWeightGram: String(profile.packageWeightGram),
      packageLengthMm: profile.packageLengthMm === null ? "" : String(profile.packageLengthMm),
      packageWidthMm: profile.packageWidthMm === null ? "" : String(profile.packageWidthMm),
      packageHeightMm: profile.packageHeightMm === null ? "" : String(profile.packageHeightMm),
      shippingClass: profile.shippingClass,
      calculationMethod: profile.calculationMethod,
      packageModel: profile.packageModel,
      handlingFee: String(profile.handlingFee),
      insuranceFee: String(profile.insuranceFee),
      fragileFee: String(profile.fragileFee),
      oversizedFee: String(profile.oversizedFee),
      isDefault: profile.isDefault,
    });
    setProfileError(null);
    setProfileModalOpen(true);
  };

  const saveProfile = async () => {
    const name = profileForm.name.trim();
    if (name.length < 2) {
      setProfileError("Name must be at least 2 characters.");
      return;
    }

    const packageWeightGram = Math.trunc(Number(profileForm.packageWeightGram));
    if (!Number.isFinite(packageWeightGram) || packageWeightGram < 0) {
      setProfileError("Package weight must be 0 or more.");
      return;
    }

    const packageLengthMm = asOptionalDimension(profileForm.packageLengthMm);
    const packageWidthMm = asOptionalDimension(profileForm.packageWidthMm);
    const packageHeightMm = asOptionalDimension(profileForm.packageHeightMm);
    if (Number.isNaN(packageLengthMm) || Number.isNaN(packageWidthMm) || Number.isNaN(packageHeightMm)) {
      setProfileError("Dimensions must be 0 or more.");
      return;
    }

    const fees: Array<[string, number]> = [
      ["Handling fee", Number(profileForm.handlingFee)],
      ["Insurance fee", Number(profileForm.insuranceFee)],
      ["Fragile fee", Number(profileForm.fragileFee)],
      ["Oversized fee", Number(profileForm.oversizedFee)],
    ];
    for (const [label, value] of fees) {
      if (!Number.isFinite(value) || value < 0) {
        setProfileError(`${label} must be 0 or more.`);
        return;
      }
    }

    const payload = {
      name,
      packageWeightGram,
      packageLengthMm,
      packageWidthMm,
      packageHeightMm,
      shippingClass: profileForm.shippingClass,
      calculationMethod: profileForm.calculationMethod,
      packageModel: profileForm.packageModel.trim() || "SinglePackageTotalWeight",
      handlingFee: Number(profileForm.handlingFee),
      insuranceFee: Number(profileForm.insuranceFee),
      fragileFee: Number(profileForm.fragileFee),
      oversizedFee: Number(profileForm.oversizedFee),
      isDefault: profileForm.isDefault,
    };

    setSavingProfile(true);
    setProfileError(null);
    try {
      if (editingProfile) {
        await apiFetch(`/api/admin/shipping/profiles/${editingProfile.id}`, { method: "PATCH", json: payload });
        toast.success(`Profile "${payload.name}" updated`);
      } else {
        await apiFetch("/api/admin/shipping/profiles", { json: payload });
        toast.success(`Profile "${payload.name}" created`);
      }
      setProfileModalOpen(false);
      profilesState.refresh();
    } catch (error) {
      setProfileError(errorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const removeProfile = async (profile: ShippingProfile) => {
    try {
      await apiFetch(`/api/admin/shipping/profiles/${profile.id}`, { method: "DELETE" });
      toast.success(`Profile "${profile.name}" deleted`);
      profilesState.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const runQuote = async () => {
    const weightGram = Math.trunc(Number(quoteForm.weightGram));
    if (!Number.isFinite(weightGram) || weightGram < 1) {
      setQuoteError("Weight must be at least 1 gram.");
      return;
    }

    const subtotal = quoteForm.subtotal.trim() === "" ? undefined : Number(quoteForm.subtotal);
    if (subtotal !== undefined && (!Number.isFinite(subtotal) || subtotal < 0)) {
      setQuoteError("Subtotal must be 0 or more.");
      return;
    }

    setQuoting(true);
    setQuoteError(null);
    try {
      const result = await apiFetch<ShippingQuote>("/api/shipping/quote", {
        json: {
          weightGram,
          subtotal,
          countryCode: quoteForm.countryCode.trim() || undefined,
          shippingClass: quoteForm.shippingClass,
        },
      });
      setQuote(result);
    } catch (error) {
      setQuote(null);
      setQuoteError(errorMessage(error));
    } finally {
      setQuoting(false);
    }
  };

  const rateColumns: Array<Column<ShippingRate>> = [
    {
      key: "name",
      header: "Rate",
      width: "18%",
      render: (rate) => (
        <div className="rv-shipping-rate-cell">
          <strong>{rate.name}</strong>
          <span className="rv-hint">
            {rate.carrier ? `via ${rate.carrier}` : "Carrier not specified"} · {deliveryWindowLabel(rate.deliveryMinDays, rate.deliveryMaxDays)}
          </span>
        </div>
      ),
    },
    { key: "region", header: "Destination", width: "10%", render: (rate) => destinationName(rate.region) },
    {
      key: "weight",
      header: "Weight range",
      width: "13%",
      render: (rate) =>
        rate.maxWeightGram === null
          ? `${formatNumber(rate.minWeightGram)} g and up`
          : `${formatNumber(rate.minWeightGram)}–${formatNumber(rate.maxWeightGram)} g`,
    },
    { key: "price", header: "Base rate", align: "right", width: "9%", render: (rate) => formatUSD(rate.price) },
    {
      key: "fees",
      header: "Extra fees",
      align: "right",
      width: "20%",
      render: (rate) => (
        <dl className="rv-shipping-fee-list">
          <div><dt>Handling</dt><dd>{formatUSD(rate.handlingFee)}</dd></div>
          <div><dt>Insurance</dt><dd>{formatUSD(rate.insuranceFee)}</dd></div>
          <div><dt>Fragile</dt><dd>{formatUSD(rate.fragileFee)}</dd></div>
          <div><dt>Oversized</dt><dd>{formatUSD(rate.oversizedFee)}</dd></div>
        </dl>
      ),
    },
    {
      key: "active",
      header: "Status",
      width: "9%",
      render: (rate) => <Badge tone={rate.isActive ? "green" : "gray"}>{rate.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      width: "21%",
      render: (rate) => (
        <div className="rv-inline rv-shipping-actions">
          <Button size="sm" onClick={() => openEditRate(rate)}>
            Edit
          </Button>
          <Button size="sm" loading={togglingRateId === rate.id} onClick={() => toggleRate(rate)}>
            {rate.isActive ? "Deactivate" : "Activate"}
          </Button>
          <ConfirmButton
            size="sm"
            title={`Delete "${rate.name}"?`}
            description="This shipping rate will be removed permanently."
            confirmLabel="Delete"
            onConfirm={() => removeRate(rate)}
          >
            Delete
          </ConfirmButton>
        </div>
      ),
    },
  ];

  const profileColumns: Array<Column<ShippingProfile>> = [
    {
      key: "name",
      header: "Profile",
      render: (profile) => (
        <div className="rv-product-cell">
          <span className="rv-inline">
            <strong>{profile.name}</strong>
            {profile.isDefault ? <Badge tone="bronze">Default</Badge> : null}
          </span>
          <span className="rv-hint rv-mono">{profile.packageModel}</span>
        </div>
      ),
    },
    {
      key: "weight",
      header: "Package weight",
      render: (profile) => `${formatNumber(profile.packageWeightGram)} g`,
    },
    {
      key: "dimensions",
      header: "Dimensions (mm)",
      render: (profile) =>
        profile.packageLengthMm === null || profile.packageWidthMm === null || profile.packageHeightMm === null
          ? "—"
          : `${formatNumber(profile.packageLengthMm)} × ${formatNumber(profile.packageWidthMm)} × ${formatNumber(profile.packageHeightMm)}`,
    },
    {
      key: "class",
      header: "Shipping class",
      render: (profile) => <Badge tone="blue">{profile.shippingClass}</Badge>,
    },
    { key: "method", header: "Calculation", render: (profile) => profile.calculationMethod },
    {
      key: "fees",
      header: "Fees",
      align: "right",
      render: (profile) => (
        <div className="rv-shipping-fees">
          <strong>{formatUSD(profileFeeTotal(profile))}</strong>
          <div className="rv-hint">
            Handling {formatUSD(profile.handlingFee)} · Insurance {formatUSD(profile.insuranceFee)} · Fragile{" "}
            {formatUSD(profile.fragileFee)} · Oversized {formatUSD(profile.oversizedFee)}
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (profile) => (
        <div className="rv-inline rv-shipping-actions">
          <Button size="sm" onClick={() => openEditProfile(profile)}>
            Edit
          </Button>
          <ConfirmButton
            size="sm"
            title={`Delete "${profile.name}"?`}
            description="This shipping profile will be removed permanently."
            confirmLabel="Delete"
            onConfirm={() => removeProfile(profile)}
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
        title="Shipping"
        subtitle="Manage delivery rates, package rules, and checkout quote previews."
        actions={
          <div className="rv-inline">
            <Button onClick={ratesState.refresh} disabled={ratesState.loading}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="rv-content rv-shipping-content">
        {ratesState.error ? (
          <Card title="Could not load shipping rates">
            <p className="rv-error-text">{ratesState.error}</p>
          </Card>
        ) : null}

        <Card
          className="rv-shipping-card rv-shipping-card--rates"
          title="Shipping rates"
          description="Filter and sort rates by destination, courier, price, weight, and status. Select rates for bulk updates."
          flush
          actions={
            <div className="rv-inline">
              <Button size="sm" onClick={() => exportRates("dhl")} loading={exportingCarrier === "dhl"} disabled={Boolean(exportingCarrier)}>
                Export DHL
              </Button>
              <Button size="sm" onClick={() => exportRates("fedex")} loading={exportingCarrier === "fedex"} disabled={Boolean(exportingCarrier)}>
                Export FedEx
              </Button>
              <Button size="sm" onClick={() => exportRates("post-office")} loading={exportingCarrier === "post-office"} disabled={Boolean(exportingCarrier)}>
                Export Post Office
              </Button>
              <Button size="sm" onClick={() => exportRates("all")} loading={exportingCarrier === "all"} disabled={Boolean(exportingCarrier)}>
                Export all
              </Button>
              <Button size="sm" onClick={openImportModal}>
                Import XLSX
              </Button>
              <Button size="sm" variant="primary" onClick={openCreateRate}>
                New rate
              </Button>
            </div>
          }
        >
          <div className="rv-shipping-toolbar">
            <Field label="Search rates">
              <TextInput
                value={rateSearch}
                onChange={(value) => { setRateSearch(value); setSelectedRateIds([]); }}
                placeholder="Rate, country, or courier…"
              />
            </Field>
            <Field label="Courier">
              <Select
                value={rateCarrierFilter}
                onChange={(value) => { setRateCarrierFilter(value); setSelectedRateIds([]); }}
                options={rateCarriers.map((carrier) => ({ value: carrier, label: carrier }))}
                placeholder="All couriers"
              />
            </Field>
            <Field label="Destination country">
              <Select
                value={rateDestinationFilter}
                onChange={(value) => { setRateDestinationFilter(value); setSelectedRateIds([]); }}
                options={rateDestinations.map((destination) => ({ value: destination, label: destinationName(destination) }))}
                placeholder="All countries"
              />
            </Field>
            <Field label="Status">
              <Select
                value={rateStatusFilter}
                onChange={(value) => { setRateStatusFilter(value); setSelectedRateIds([]); }}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
                placeholder="All statuses"
              />
            </Field>
            <Field label="Sort by">
              <Select value={rateSort} onChange={setRateSort} options={rateSortOptions} />
            </Field>
            <div className="rv-shipping-toolbar__footer">
              <span role="status" aria-live="polite">
                Showing {formatNumber(visibleRates.length)} of {formatNumber(rates.length)} rates
              </span>
              <Button
                size="sm"
                disabled={!rateSearch && !rateCarrierFilter && !rateDestinationFilter && !rateStatusFilter && rateSort === "default"}
                onClick={() => {
                  setRateSearch("");
                  setRateCarrierFilter("");
                  setRateDestinationFilter("");
                  setRateStatusFilter("");
                  setRateSort("default");
                  setSelectedRateIds([]);
                }}
              >
                Reset filters
              </Button>
            </div>
          </div>

          {selectedRateIds.length ? (
            <div className="rv-toolbar rv-toolbar--bulk rv-shipping-bulk" aria-live="polite">
              <Badge tone="blue">{formatNumber(selectedRateIds.length)} selected</Badge>
              <Button size="sm" disabled={bulkRatesBusy} onClick={openBulkRateEdit}>Bulk edit</Button>
              <Button
                size="sm"
                disabled={bulkRatesBusy || selectedRateIds.every((id) => rates.find((rate) => rate.id === id)?.isActive)}
                onClick={() => void runBulkRateUpdate({ isActive: true }, "Activated")}
              >
                Activate
              </Button>
              <Button
                size="sm"
                disabled={bulkRatesBusy || selectedRateIds.every((id) => !rates.find((rate) => rate.id === id)?.isActive)}
                onClick={() => void runBulkRateUpdate({ isActive: false }, "Deactivated")}
              >
                Deactivate
              </Button>
              <Button size="sm" variant="danger" disabled={bulkRatesBusy} onClick={() => setBulkDeleteModalOpen(true)}>
                Delete selected
              </Button>
              <Button size="sm" variant="ghost" disabled={bulkRatesBusy} onClick={() => setSelectedRateIds([])}>
                Clear selection
              </Button>
            </div>
          ) : null}

          <DataTable
            ariaLabel="Shipping rates"
            columns={rateColumns}
            items={visibleRates}
            loading={ratesState.loading && !ratesState.data}
            rowKey={(rate) => rate.id}
            getRowLabel={(rate) => `${rate.name}, ${rate.region}`}
            selectable
            selectedIds={selectedRateIds}
            onToggleSelect={toggleRateSelection}
            onToggleSelectAll={toggleVisibleRateSelection}
            emptyTitle="No shipping rates yet"
            emptyDescription="Create a rate so quotes have something to return."
            emptyAction={
              <Button variant="primary" onClick={openCreateRate}>
                New rate
              </Button>
            }
          />
        </Card>

        {profilesState.error ? (
          <Card title="Could not load shipping profiles">
            <p className="rv-error-text">{profilesState.error}</p>
          </Card>
        ) : null}

        <Card
          className="rv-shipping-card rv-shipping-card--profiles"
          title="Shipping profiles"
          description="Default package weight, dimensions, class, and handling fees."
          flush
          actions={
            <Button size="sm" variant="primary" onClick={openCreateProfile}>
              New profile
            </Button>
          }
        >
          <DataTable
            ariaLabel="Shipping profiles"
            columns={profileColumns}
            items={profilesState.data ?? []}
            loading={profilesState.loading && !profilesState.data}
            rowKey={(profile) => profile.id}
            emptyTitle="No shipping profiles yet"
            emptyDescription="Profiles describe how orders are packaged before a rate is quoted."
            emptyAction={
              <Button variant="primary" onClick={openCreateProfile}>
                New profile
              </Button>
            }
          />
        </Card>

        <Card
          className="rv-shipping-card rv-shipping-card--quote"
          title="Quote calculator"
          description="Check which rates match a destination, package, and order value."
        >
          <div className="rv-stack">
            {quoteError ? <p className="rv-error-text">{quoteError}</p> : null}
            <div className="rv-form-grid">
              <Field label="Weight (gram)">
                <TextInput
                  type="number"
                  min={1}
                  step="1"
                  value={quoteForm.weightGram}
                  onChange={(value) => setQuoteField("weightGram", value)}
                />
              </Field>
              <Field label="Subtotal" hint="Optional, for free shipping thresholds">
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={quoteForm.subtotal}
                  onChange={(value) => setQuoteField("subtotal", value)}
                />
              </Field>
              <Field label="Destination country">
                <CountryDropdown
                  id="shipping-quote-country"
                  variant="admin"
                  value={quoteForm.countryCode}
                  onChange={(value) => setQuoteField("countryCode", value)}
                  ariaLabel="Destination country"
                />
              </Field>
              <Field label="Shipping class">
                <Select
                  value={quoteForm.shippingClass}
                  onChange={(value) => setQuoteField("shippingClass", value)}
                  options={quoteClassOptions}
                />
              </Field>
            </div>
            <div className="rv-inline">
              <Button variant="primary" loading={quoting} onClick={runQuote}>
                Get quote
              </Button>
              {quote ? (
                <Button
                  onClick={() => {
                    setQuote(null);
                    setQuoteError(null);
                  }}
                >
                  Clear result
                </Button>
              ) : null}
            </div>

            {quoting && !quote ? <Loading label="Calculating shipping…" /> : null}

            {quote ? (
              <div className="rv-stack">
                <div className="rv-inline">
                  <Badge
                    tone={quote.source === "FreeShipping" ? "green" : quote.source === "AdminOverride" ? "amber" : "blue"}
                  >
                    {quote.source === "CarrierAPI"
                      ? "Carrier rates"
                      : quote.source === "AdminOverride"
                        ? "Admin override"
                        : "Free shipping"}
                  </Badge>
                  {quote.overrideApplied ? (
                    <span className="rv-hint">A flat-rate override is enabled in the store settings.</span>
                  ) : null}
                </div>

                {quote.options.length ? (
                  <div className="rv-list">
                    {quote.options.map((option) => (
                      <div className="rv-list__row" key={option.id}>
                        <div>
                          <strong>{option.name}</strong>
                          <div className="rv-hint">
                            {option.carrier ?? "—"}
                            {option.deliveryMinDays !== null && option.deliveryMaxDays !== null
                              ? ` · ${deliveryWindowLabel(option.deliveryMinDays, option.deliveryMaxDays)} after dispatch`
                              : ""}
                            {" · base "}{formatUSD(option.breakdown.base)} · handling{" "}
                            {formatUSD(option.breakdown.handling)} · fragile {formatUSD(option.breakdown.fragile)} · oversized{" "}
                            {formatUSD(option.breakdown.oversized)}
                          </div>
                        </div>
                        <span className="rv-list__meta">{formatUSD(option.price)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rv-hint">No rates matched this destination, weight and shipping class.</p>
                )}

                {quote.options.length === 1 ? (
                  <KeyValue
                    entries={[
                      { label: "Base", value: formatUSD(quote.options[0].breakdown.base) },
                      { label: "Handling", value: formatUSD(quote.options[0].breakdown.handling) },
                      { label: "Fragile", value: formatUSD(quote.options[0].breakdown.fragile) },
                      { label: "Oversized", value: formatUSD(quote.options[0].breakdown.oversized) },
                      { label: "Total", value: formatUSD(quote.options[0].breakdown.total) },
                    ]}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Modal
        open={bulkRateModalOpen}
        title={`Bulk edit ${formatNumber(selectedRateIds.length)} shipping rate(s)`}
        onClose={() => { if (!bulkRatesBusy) setBulkRateModalOpen(false); }}
        wide
        footer={
          <>
            <Button onClick={() => setBulkRateModalOpen(false)} disabled={bulkRatesBusy}>Cancel</Button>
            <Button variant="primary" loading={bulkRatesBusy} onClick={saveBulkRateEdit}>Apply changes</Button>
          </>
        }
      >
        <div className="rv-stack">
          <p className="rv-hint">Enter only the fields you want to change. Blank fields stay as they are for each selected rate.</p>
          {bulkRateError ? <p className="rv-error-text" role="alert">{bulkRateError}</p> : null}
          <div className="rv-form-grid rv-shipping-bulk-edit-grid">
            <Field label="Base rate (USD)">
              <TextInput type="number" min={0} step="0.01" value={bulkRateForm.price} onChange={(value) => setBulkRateField("price", value)} placeholder="No change" />
            </Field>
            <Field label="Minimum delivery (business days)">
              <TextInput type="number" min={1} max={365} step="1" value={bulkRateForm.deliveryMinDays} onChange={(value) => setBulkRateField("deliveryMinDays", value)} placeholder="No change" />
            </Field>
            <Field label="Maximum delivery (business days)">
              <TextInput type="number" min={1} max={365} step="1" value={bulkRateForm.deliveryMaxDays} onChange={(value) => setBulkRateField("deliveryMaxDays", value)} placeholder="No change" />
            </Field>
            <Field label="Handling fee (USD)">
              <TextInput type="number" min={0} step="0.01" value={bulkRateForm.handlingFee} onChange={(value) => setBulkRateField("handlingFee", value)} placeholder="No change" />
            </Field>
            <Field label="Insurance fee (USD)">
              <TextInput type="number" min={0} step="0.01" value={bulkRateForm.insuranceFee} onChange={(value) => setBulkRateField("insuranceFee", value)} placeholder="No change" />
            </Field>
            <Field label="Fragile fee (USD)">
              <TextInput type="number" min={0} step="0.01" value={bulkRateForm.fragileFee} onChange={(value) => setBulkRateField("fragileFee", value)} placeholder="No change" />
            </Field>
            <Field label="Oversized fee (USD)">
              <TextInput type="number" min={0} step="0.01" value={bulkRateForm.oversizedFee} onChange={(value) => setBulkRateField("oversizedFee", value)} placeholder="No change" />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkDeleteModalOpen}
        title={`Delete ${formatNumber(selectedRateIds.length)} shipping rate(s)?`}
        onClose={() => { if (!bulkRatesBusy) setBulkDeleteModalOpen(false); }}
        footer={
          <>
            <Button onClick={() => setBulkDeleteModalOpen(false)} disabled={bulkRatesBusy}>Cancel</Button>
            <Button variant="danger" loading={bulkRatesBusy} onClick={deleteSelectedRates}>Delete rates</Button>
          </>
        }
      >
        <p>This permanently removes the selected shipping rates. This action cannot be undone.</p>
      </Modal>

      <Modal
        open={importModalOpen}
        title="Import shipping rates"
        onClose={closeImportModal}
        wide
        footer={
          <>
            <Button onClick={closeImportModal} disabled={previewingImport || importingRates}>Cancel</Button>
            <Button onClick={previewImport} loading={previewingImport} disabled={!importFile || importingRates}>
              Preview import
            </Button>
            <Button
              variant="primary"
              onClick={applyImport}
              loading={importingRates}
              disabled={!importPreview?.canImport || previewingImport || !importFile}
            >
              {importMode === "replace"
                ? "Replace this carrier"
                : importPreview?.invalidCount
                  ? `Import ${formatNumber(importPreview.validCount)} reviewed rows`
                  : "Import rates"}
            </Button>
          </>
        }
      >
        <div className="rv-stack">
          {importError ? <p className="rv-error-text">{importError}</p> : null}
          <p className="rv-hint">
            Upload one .xlsx workbook per carrier with a <strong>Data Impor</strong> sheet. The first row must contain
            name, carrier, region, minWeightGram, maxWeightGram, deliveryMinDays, deliveryMaxDays, price, and importStatus.
            Set importStatus to <strong>OK</strong> only after reviewing that row.
          </p>
          <div className="rv-form-grid">
            <Field label="XLSX workbook">
              <input
                className="rv-input rv-input--file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] ?? null);
                  setImportPreview(null);
                  setImportError(null);
                }}
              />
            </Field>
            <Field label="Import behavior">
              <Select
                value={importMode}
                onChange={(value) => {
                  setImportMode(value);
                  setImportPreview(null);
                  setImportError(null);
                }}
                options={[
                  { value: "merge", label: "Merge: add new rates and update matches" },
                  { value: "replace", label: "Replace: remove all existing rates first" },
                ]}
              />
            </Field>
          </div>
          {importMode === "replace" ? (
            <p className="rv-error-text">
              Replace mode removes only rates for the carrier group detected in this workbook, including inactive rates. Other carrier rates are kept.
            </p>
          ) : (
            <p className="rv-hint">
              Merge mode matches rows by exported ID or by name, carrier, region, and weight range. Existing matches are updated; other rows are added.
            </p>
          )}

          {importPreview ? (
            <section className="rv-stack" aria-live="polite">
              <KeyValue
                entries={[
                  { label: "Worksheet", value: importPreview.sheetName },
                  { label: "Carrier group", value: importPreview.carrier?.label ?? "Missing or mixed" },
                  { label: "Rows", value: formatNumber(importPreview.rowCount) },
                  { label: "Valid rows", value: formatNumber(importPreview.validCount) },
                  { label: "Rows needing attention", value: formatNumber(importPreview.invalidCount) },
                  { label: "Will create", value: formatNumber(importPreview.createdCount) },
                  { label: "Will update", value: formatNumber(importPreview.updatedCount) },
                ]}
              />
              {importPreview.canImport ? (
                importPreview.invalidCount > 0 ? (
                  <div>
                    <Badge tone="green">{formatNumber(importPreview.validCount)} reviewed rows are ready to import.</Badge>
                    <p className="rv-hint">
                      Merge will skip {formatNumber(importPreview.invalidCount)} flagged row(s). They will not change existing rates. Fix those rows and import again to add them later.
                    </p>
                    <ul className="rv-list">
                      {importPreview.issues.map((issue) => (
                        <li className="rv-list__row" key={issue.row}>
                          <strong>Row {issue.row}</strong>
                          <span>{issue.messages.join(" · ")}</span>
                        </li>
                      ))}
                    </ul>
                    {importPreview.invalidCount > importPreview.issues.length ? (
                      <p className="rv-hint">Showing the first {importPreview.issues.length} affected rows.</p>
                    ) : null}
                  </div>
                ) : (
                  <Badge tone="green">Preview passed. You can apply these changes.</Badge>
                )
              ) : (
                <div>
                  <p className="rv-error-text">
                    {importMode === "replace" && importPreview.invalidCount > 0
                      ? "Replace requires every row to be valid. Switch to Merge to import the reviewed rows without removing current rates."
                      : "No rows are ready to import. Fix the flagged rows and run the preview again. Source workbooks can flag ambiguous zones or values that need review in the importStatus column."}
                  </p>
                  <ul className="rv-list">
                    {importPreview.issues.map((issue) => (
                      <li className="rv-list__row" key={issue.row}>
                        <strong>Row {issue.row}</strong>
                        <span>{issue.messages.join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                  {importPreview.invalidCount > importPreview.issues.length ? (
                    <p className="rv-hint">Showing the first {importPreview.issues.length} affected rows.</p>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={rateModalOpen}
        title={editingRate ? `Edit "${editingRate.name}"` : "New shipping rate"}
        onClose={() => setRateModalOpen(false)}
        wide
        footer={
          <>
            <Button onClick={() => setRateModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={savingRate} onClick={saveRate}>
              {editingRate ? "Save changes" : "Create rate"}
            </Button>
          </>
        }
      >
        <div className="rv-stack rv-shipping-rate-form">
          {rateError ? <p className="rv-error-text">{rateError}</p> : null}
          <section className="rv-shipping-form-section">
            <div className="rv-shipping-form-section__heading">
              <h3>Rate details</h3>
              <p>Name the service and set where it is available.</p>
            </div>
            <div className="rv-form-grid rv-shipping-form-grid--two">
              <Field label="Rate name">
                <TextInput value={rateForm.name} onChange={(value) => setRateField("name", value)} placeholder="Standard domestic" required />
              </Field>
              <Field label="Carrier" hint="Optional">
                <TextInput value={rateForm.carrier} onChange={(value) => setRateField("carrier", value)} placeholder="JNE, DHL…" />
              </Field>
              <Field label="Destination">
                <CountryDropdown
                  id="shipping-rate-destination"
                  variant="admin"
                  value={rateForm.region}
                  onChange={(value) => setRateField("region", value)}
                  includeWorldwide
                  ariaLabel="Shipping rate destination"
                  required
                />
              </Field>
              <Field label="Base rate (USD)">
                <TextInput type="number" min={0} step="0.01" value={rateForm.price} onChange={(value) => setRateField("price", value)} required />
              </Field>
            </div>
          </section>

          <section className="rv-shipping-form-section">
            <div className="rv-shipping-form-section__heading">
              <h3>Weight and delivery time</h3>
              <p>Set the parcel weight range and estimated transit time after dispatch.</p>
            </div>
            <div className="rv-form-grid rv-shipping-form-grid--two">
              <Field label="Minimum weight (g)">
                <TextInput
                  type="number"
                  min={0}
                  step="1"
                  value={rateForm.minWeightGram}
                  onChange={(value) => setRateField("minWeightGram", value)}
                  required
                />
              </Field>
              <Field label="Maximum weight (g)" hint="Leave blank for no limit">
                <TextInput
                  type="number"
                  min={0}
                  step="1"
                  value={rateForm.maxWeightGram}
                  onChange={(value) => setRateField("maxWeightGram", value)}
                />
              </Field>
              <Field label="Minimum transit (business days)" hint="From dispatch; maximum 365 days">
                <TextInput
                  type="number"
                  min={1}
                  max={365}
                  step="1"
                  value={rateForm.deliveryMinDays}
                  onChange={(value) => setRateField("deliveryMinDays", value)}
                  required
                />
              </Field>
              <Field label="Maximum transit (business days)">
                <TextInput
                  type="number"
                  min={1}
                  max={365}
                  step="1"
                  value={rateForm.deliveryMaxDays}
                  onChange={(value) => setRateField("deliveryMaxDays", value)}
                  required
                />
              </Field>
            </div>
          </section>

          <details className="rv-shipping-advanced" open={Boolean(editingRate)}>
            <summary>Optional extra charges</summary>
            <div className="rv-shipping-advanced__body">
              <p>Fragile and oversized charges apply only to matching products.</p>
              <div className="rv-form-grid rv-shipping-form-grid--two">
                <Field label="Handling charge (USD)">
                  <TextInput type="number" min={0} step="0.01" value={rateForm.handlingFee} onChange={(value) => setRateField("handlingFee", value)} />
                </Field>
                <Field label="Insurance charge (USD)">
                  <TextInput type="number" min={0} step="0.01" value={rateForm.insuranceFee} onChange={(value) => setRateField("insuranceFee", value)} />
                </Field>
                <Field label="Fragile charge (USD)">
                  <TextInput type="number" min={0} step="0.01" value={rateForm.fragileFee} onChange={(value) => setRateField("fragileFee", value)} />
                </Field>
                <Field label="Oversized charge (USD)">
                  <TextInput type="number" min={0} step="0.01" value={rateForm.oversizedFee} onChange={(value) => setRateField("oversizedFee", value)} />
                </Field>
              </div>
            </div>
          </details>

          <section className="rv-shipping-form-section">
            <div className="rv-shipping-form-section__heading">
              <h3>Availability and order</h3>
              <p>Choose whether customers can use this rate and where it appears.</p>
            </div>
            <div className="rv-form-grid rv-shipping-form-grid--two">
              <Field label="Sort priority" hint="Lower numbers appear first">
                <TextInput type="number" step="1" value={rateForm.sortOrder} onChange={(value) => setRateField("sortOrder", value)} />
              </Field>
              <Field label="Rate status">
                <Switch
                  checked={rateForm.isActive}
                  onChange={(checked) => setRateField("isActive", checked)}
                  label="Available at checkout"
                />
              </Field>
            </div>
          </section>
        </div>
      </Modal>

      <Modal
        open={profileModalOpen}
        title={editingProfile ? `Edit "${editingProfile.name}"` : "New shipping profile"}
        onClose={() => setProfileModalOpen(false)}
        wide
        footer={
          <>
            <Button onClick={() => setProfileModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={savingProfile} onClick={saveProfile}>
              {editingProfile ? "Save changes" : "Create profile"}
            </Button>
          </>
        }
      >
        <div className="rv-stack">
          {profileError ? <p className="rv-error-text">{profileError}</p> : null}
          <div className="rv-form-grid">
            <Field label="Name">
              <TextInput
                value={profileForm.name}
                onChange={(value) => setProfileField("name", value)}
                placeholder="Single ring box"
              />
            </Field>
            <Field label="Package weight (gram)">
              <TextInput
                type="number"
                min={0}
                step="1"
                value={profileForm.packageWeightGram}
                onChange={(value) => setProfileField("packageWeightGram", value)}
              />
            </Field>
            <Field label="Length (mm)">
              <TextInput
                type="number"
                min={0}
                step="1"
                value={profileForm.packageLengthMm}
                onChange={(value) => setProfileField("packageLengthMm", value)}
              />
            </Field>
            <Field label="Width (mm)">
              <TextInput
                type="number"
                min={0}
                step="1"
                value={profileForm.packageWidthMm}
                onChange={(value) => setProfileField("packageWidthMm", value)}
              />
            </Field>
            <Field label="Height (mm)">
              <TextInput
                type="number"
                min={0}
                step="1"
                value={profileForm.packageHeightMm}
                onChange={(value) => setProfileField("packageHeightMm", value)}
              />
            </Field>
            <Field label="Shipping class">
              <Select
                value={profileForm.shippingClass}
                onChange={(value) => setProfileField("shippingClass", value)}
                options={shippingClassOptions}
              />
            </Field>
            <Field label="Calculation method">
              <Select
                value={profileForm.calculationMethod}
                onChange={(value) => setProfileField("calculationMethod", value)}
                options={calculationOptions}
              />
            </Field>
            <Field label="Package model" hint="Packing strategy identifier">
              <TextInput
                value={profileForm.packageModel}
                onChange={(value) => setProfileField("packageModel", value)}
              />
            </Field>
            <Field label="Handling fee">
              <TextInput
                type="number"
                min={0}
                step="0.01"
                value={profileForm.handlingFee}
                onChange={(value) => setProfileField("handlingFee", value)}
              />
            </Field>
            <Field label="Insurance fee">
              <TextInput
                type="number"
                min={0}
                step="0.01"
                value={profileForm.insuranceFee}
                onChange={(value) => setProfileField("insuranceFee", value)}
              />
            </Field>
            <Field label="Fragile fee">
              <TextInput
                type="number"
                min={0}
                step="0.01"
                value={profileForm.fragileFee}
                onChange={(value) => setProfileField("fragileFee", value)}
              />
            </Field>
            <Field label="Oversized fee">
              <TextInput
                type="number"
                min={0}
                step="0.01"
                value={profileForm.oversizedFee}
                onChange={(value) => setProfileField("oversizedFee", value)}
              />
            </Field>
            <Field label="Default">
              <Switch
                checked={profileForm.isDefault}
                onChange={(checked) => setProfileField("isDefault", checked)}
                label="Use as default profile"
              />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
