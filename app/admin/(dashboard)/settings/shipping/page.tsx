"use client";

import { useState } from "react";
import { apiFetch, errorMessage, formatNumber, formatUSD, useApi, type ApiState } from "@/components/admin/api";
import { DataTable, type Column } from "@/components/admin/data-table";
import { toast } from "@/components/admin/toast";
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

type ShippingRate = {
  id: string;
  name: string;
  carrier: string | null;
  region: string;
  minWeightGram: number;
  maxWeightGram: number | null;
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
  price: string;
  handlingFee: string;
  insuranceFee: string;
  fragileFee: string;
  oversizedFee: string;
  sortOrder: string;
  isActive: boolean;
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

const emptyRateForm: RateForm = {
  name: "",
  carrier: "",
  region: "Worldwide",
  minWeightGram: "0",
  maxWeightGram: "",
  price: "0",
  handlingFee: "0",
  insuranceFee: "0",
  fragileFee: "0",
  oversizedFee: "0",
  sortOrder: "0",
  isActive: true,
};

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

const rateFeeTotal = (rate: ShippingRate) =>
  rate.handlingFee + rate.insuranceFee + rate.fragileFee + rate.oversizedFee;

const profileFeeTotal = (profile: ShippingProfile) =>
  profile.handlingFee + profile.insuranceFee + profile.fragileFee + profile.oversizedFee;

export default function AdminShippingPage() {
  const ratesState: ApiState<ShippingRate[]> = useApi<ShippingRate[]>("/api/admin/shipping/rates");
  const profilesState: ApiState<ShippingProfile[]> = useApi<ShippingProfile[]>("/api/admin/shipping/profiles");

  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);
  const [rateForm, setRateForm] = useState<RateForm>(emptyRateForm);
  const [rateError, setRateError] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);
  const [togglingRateId, setTogglingRateId] = useState<string | null>(null);

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
      region: rate.region,
      minWeightGram: String(rate.minWeightGram),
      maxWeightGram: rate.maxWeightGram === null ? "" : String(rate.maxWeightGram),
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
      region: rateForm.region.trim() || "Worldwide",
      minWeightGram,
      maxWeightGram,
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
      render: (rate) => (
        <div className="rv-product-cell">
          <strong>{rate.name}</strong>
          <span className="rv-hint">{rate.carrier ?? "—"}</span>
        </div>
      ),
    },
    { key: "region", header: "Region", render: (rate) => rate.region },
    {
      key: "weight",
      header: "Weight",
      render: (rate) =>
        `${formatNumber(rate.minWeightGram)} g – ${rate.maxWeightGram === null ? "no limit" : `${formatNumber(rate.maxWeightGram)} g`}`,
    },
    { key: "price", header: "Price", align: "right", render: (rate) => formatUSD(rate.price) },
    {
      key: "fees",
      header: "Fees",
      align: "right",
      render: (rate) => (
        <div>
          <div>{formatUSD(rateFeeTotal(rate))}</div>
          <div className="rv-hint">
            H {formatUSD(rate.handlingFee)} · I {formatUSD(rate.insuranceFee)} · F {formatUSD(rate.fragileFee)} · O{" "}
            {formatUSD(rate.oversizedFee)}
          </div>
        </div>
      ),
    },
    {
      key: "active",
      header: "Active",
      render: (rate) => <Badge tone={rate.isActive ? "green" : "gray"}>{rate.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (rate) => (
        <div className="rv-inline" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
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
        <div>
          <div>{formatUSD(profileFeeTotal(profile))}</div>
          <div className="rv-hint">
            H {formatUSD(profile.handlingFee)} · I {formatUSD(profile.insuranceFee)} · F {formatUSD(profile.fragileFee)} · O{" "}
            {formatUSD(profile.oversizedFee)}
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (profile) => (
        <div className="rv-inline" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
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
        subtitle="Rates, packaging profiles and quote calculator"
        actions={
          <div className="rv-inline">
            <Button onClick={ratesState.refresh} disabled={ratesState.loading}>
              Refresh
            </Button>
            <Button variant="primary" onClick={openCreateRate}>
              New rate
            </Button>
          </div>
        }
      />

      <div className="rv-content">
        {ratesState.error ? (
          <Card title="Could not load shipping rates">
            <p className="rv-error-text">{ratesState.error}</p>
          </Card>
        ) : null}

        <Card
          title="Shipping rates"
          description="Weight-based rates per region and carrier"
          flush
          actions={
            <Button size="sm" variant="primary" onClick={openCreateRate}>
              New rate
            </Button>
          }
        >
          <DataTable
            columns={rateColumns}
            items={ratesState.data ?? []}
            loading={ratesState.loading && !ratesState.data}
            rowKey={(rate) => rate.id}
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
          title="Shipping profiles"
          description="Packaging defaults, dimensions and handling fees"
          flush
          actions={
            <Button size="sm" variant="primary" onClick={openCreateProfile}>
              New profile
            </Button>
          }
        >
          <DataTable
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

        <Card title="Quote calculator" description="Preview the rate options a customer would see">
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
              <Field label="Country code" hint="ISO code, e.g. ID or US">
                <TextInput value={quoteForm.countryCode} onChange={(value) => setQuoteField("countryCode", value)} />
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
                            {option.carrier ?? "—"} · base {formatUSD(option.breakdown.base)} · handling{" "}
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
        <div className="rv-stack">
          {rateError ? <p className="rv-error-text">{rateError}</p> : null}
          <div className="rv-form-grid">
            <Field label="Name">
              <TextInput value={rateForm.name} onChange={(value) => setRateField("name", value)} placeholder="Standard domestic" />
            </Field>
            <Field label="Carrier">
              <TextInput value={rateForm.carrier} onChange={(value) => setRateField("carrier", value)} placeholder="JNE, DHL…" />
            </Field>
            <Field label="Region" hint="Country code or Worldwide">
              <TextInput value={rateForm.region} onChange={(value) => setRateField("region", value)} />
            </Field>
            <Field label="Price">
              <TextInput type="number" min={0} step="0.01" value={rateForm.price} onChange={(value) => setRateField("price", value)} />
            </Field>
            <Field label="Min weight (gram)">
              <TextInput
                type="number"
                min={0}
                step="1"
                value={rateForm.minWeightGram}
                onChange={(value) => setRateField("minWeightGram", value)}
              />
            </Field>
            <Field label="Max weight (gram)" hint="Leave blank for no limit">
              <TextInput
                type="number"
                min={0}
                step="1"
                value={rateForm.maxWeightGram}
                onChange={(value) => setRateField("maxWeightGram", value)}
              />
            </Field>
            <Field label="Handling fee">
              <TextInput
                type="number"
                min={0}
                step="0.01"
                value={rateForm.handlingFee}
                onChange={(value) => setRateField("handlingFee", value)}
              />
            </Field>
            <Field label="Insurance fee">
              <TextInput
                type="number"
                min={0}
                step="0.01"
                value={rateForm.insuranceFee}
                onChange={(value) => setRateField("insuranceFee", value)}
              />
            </Field>
            <Field label="Fragile fee" hint="Charged for the Fragile shipping class">
              <TextInput
                type="number"
                min={0}
                step="0.01"
                value={rateForm.fragileFee}
                onChange={(value) => setRateField("fragileFee", value)}
              />
            </Field>
            <Field label="Oversized fee" hint="Charged for the Oversized shipping class">
              <TextInput
                type="number"
                min={0}
                step="0.01"
                value={rateForm.oversizedFee}
                onChange={(value) => setRateField("oversizedFee", value)}
              />
            </Field>
            <Field label="Sort order">
              <TextInput
                type="number"
                step="1"
                value={rateForm.sortOrder}
                onChange={(value) => setRateField("sortOrder", value)}
              />
            </Field>
            <Field label="Active">
              <Switch
                checked={rateForm.isActive}
                onChange={(checked) => setRateField("isActive", checked)}
                label="Available for quotes"
              />
            </Field>
          </div>
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
