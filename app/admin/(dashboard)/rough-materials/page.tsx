"use client";

import { useState } from "react";
import { apiFetch, errorMessage, useApi } from "@/components/admin/api";
import { MediaPicker } from "@/components/admin/media";
import { toast } from "@/components/admin/toast";
import { Badge, Button, Card, Field, Loading, Modal, PageHeader, Switch, TextArea, TextInput } from "@/components/admin/ui";
import type { RoughMaterial } from "@/lib/rough-materials";
import "./rough-materials.css";

type AdminMaterial = RoughMaterial & { isPublished: boolean; sortOrder: number };
const empty = { sku: "", name: "", stoneType: "", origin: "Indonesia", description: "", sizeNotes: "", pricePerKg: "", availableKg: "", sortOrder: "0", images: [] as string[], isAvailable: true, isPublished: false };

export default function AdminRoughMaterialsPage() {
  const state = useApi<AdminMaterial[]>("/api/admin/rough-materials");
  const contacts = useApi<Record<string, unknown>>("/api/settings/public");
  const validWhatsApp = (value: unknown) => typeof value === "string" && /^\+?[\d ()-]+$/.test(value.trim()) && /^[1-9]\d{7,14}$/.test(value.replace(/\D/g, ""));
  const whatsappReady = validWhatsApp(contacts.data?.["store.whatsapp"]) || validWhatsApp(contacts.data?.["store.whatsappSecondary"]);
  const emailReady = typeof contacts.data?.["store.email"] === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacts.data["store.email"] as string);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const close = () => { if (!saving) setOpen(false); };
  const edit = (material?: AdminMaterial) => {
    setEditing(material?.id ?? null); setError("");
    setForm(material ? { sku: material.sku, name: material.name, stoneType: material.stoneType, origin: material.origin, description: material.description, sizeNotes: material.sizeNotes, pricePerKg: String(material.pricePerKg), availableKg: material.availableKg === null ? "" : String(material.availableKg), sortOrder: String(material.sortOrder), images: material.images, isAvailable: material.isAvailable, isPublished: material.isPublished } : { ...empty, images: [] });
    setOpen(true);
  };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (saving) return;
    const price = Number(form.pricePerKg);
    const stock = form.availableKg.trim() ? Number(form.availableKg) : null;
    if (!Number.isFinite(price) || price <= 0 || (stock !== null && (!Number.isFinite(stock) || stock < 0))) { setError("Enter a positive price and a valid available weight."); return; }
    if (form.isPublished && (!form.images.length || !form.description.trim())) { setError("Add photos and material information before publishing."); return; }
    setSaving(true); setError("");
    try {
      await apiFetch(editing ? `/api/admin/rough-materials/${editing}` : "/api/admin/rough-materials", { method: editing ? "PATCH" : "POST", json: { ...form, sku: form.sku.trim(), name: form.name.trim(), stoneType: form.stoneType.trim(), origin: form.origin.trim(), pricePerKg: price, availableKg: stock, sortOrder: Number(form.sortOrder) } });
      toast.success(editing ? "Rough material updated" : "Rough material created"); setOpen(false); state.refresh();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setSaving(false); }
  };
  const published = (state.data ?? []).filter((material) => material.isPublished && material.isAvailable);
  const maximumCombinedKg = published.map((material) => material.availableKg ?? Infinity).sort((a, b) => b - a).slice(0, 2).reduce((sum, value) => sum + value, 0);
  const filtered = (state.data ?? []).filter((material) => `${material.name} ${material.sku} ${material.stoneType}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <PageHeader title="Rough Materials" subtitle="Public bulk-material catalog. Inquiries are handled through WhatsApp or email." actions={<Button variant="primary" onClick={() => edit()}>Add material type</Button>} />
    <div className="rv-content">
      <div className="rv-notice">Minimum combined order: <strong>2,000 kg (2 metric tons)</strong>. Maximum <strong>2 material types</strong>. Every entry below represents one material type, with pricing in USD per kg. No checkout or stock reservation is created.</div>
      {published.length > 0 && maximumCombinedKg < 2000 ? <div className="rv-notice" role="status">Current published stock cannot meet the 2,000 kg minimum with at most two materials. Increase actual stock, publish another available type, or provide customers with a manual contact alternative.</div> : null}
      {contacts.data && (!whatsappReady || !emailReady) ? <div className="rv-notice" role="status">{!whatsappReady ? "WhatsApp needs a valid international number (e.g. +62812…). " : ""}{!emailReady ? "A valid inquiry email is missing. " : ""}<Button href="/admin/settings">Configure inquiry contacts</Button></div> : null}
      <Card title="Material collection" description="Upload actual photos, set a price per kg, and publish when ready. Unpublish to remove a material from the public catalog.">
        <div className="rv-stack"><Field label="Search materials"><TextInput value={search} onChange={setSearch} placeholder="Name, SKU, or stone type" /></Field>
          {state.error ? <p className="rv-error-text" role="alert">{state.error}<Button onClick={state.refresh}>Try again</Button></p> : null}
          {state.loading && !state.data ? <Loading /> : filtered.length ? <div className="rv-rough-grid">{filtered.map((material) => <article className="rv-rough-card" key={material.id}>
            <div className="rv-rough-card__photo">{material.images[0] ? <img src={material.images[0]} alt={material.name} /> : <span>No photo</span>}</div>
            <div className="rv-rough-card__body"><div><Badge tone={material.isPublished ? "green" : "gray"}>{material.isPublished ? "Published" : "Draft"}</Badge><Badge tone={material.isAvailable ? "green" : "red"}>{material.isAvailable ? "Available" : "Unavailable"}</Badge></div><h2>{material.name}</h2><p>{material.sku} · {material.origin}</p><strong>USD {material.pricePerKg.toFixed(2)} / kg</strong><p>{material.availableKg === null ? "Availability confirmed manually" : `${material.availableKg.toLocaleString("en-US")} kg available`}</p><Button onClick={() => edit(material)}>Edit material</Button></div>
          </article>)}</div> : <p className="rv-hint">{search ? "No matching materials." : "No rough materials yet. Add your first material type with photos and pricing."}</p>}
        </div>
      </Card>
    </div>
    <Modal open={open} title={editing ? "Edit rough material" : "New rough material"} onClose={close} wide>
      <form className="rv-stack" onSubmit={save}>
        <div className="rv-rough-fields"><Field label="Material name"><TextInput required value={form.name} onChange={(name) => setForm({ ...form, name })} placeholder="e.g. Moss Agate Rough" /></Field><Field label="SKU / material code"><TextInput required value={form.sku} onChange={(sku) => setForm({ ...form, sku })} placeholder="RM-MOSS-001" /></Field><Field label="Stone type"><TextInput required value={form.stoneType} onChange={(stoneType) => setForm({ ...form, stoneType })} /></Field><Field label="Origin"><TextInput required value={form.origin} onChange={(origin) => setForm({ ...form, origin })} /></Field><Field label="Price per kg (USD)"><TextInput required type="number" min={0.01} max={1000000} step="0.01" value={form.pricePerKg} onChange={(pricePerKg) => setForm({ ...form, pricePerKg })} /></Field><Field label="Available weight (kg)" hint="Optional. Leave blank for manual confirmation; 0 means no available stock."><TextInput type="number" min={0} max={1000000} step="0.001" value={form.availableKg} onChange={(availableKg) => setForm({ ...form, availableKg })} /></Field></div>
        <Field label="Material information"><TextArea value={form.description} onChange={(description) => setForm({ ...form, description })} placeholder="Describe the material, quality, natural characteristics, and supply details." /></Field>
        <Field label="Size / grading notes"><TextArea value={form.sizeNotes} onChange={(sizeNotes) => setForm({ ...form, sizeNotes })} placeholder="Typical piece sizes, grading, or packing information." /></Field>
        <MediaPicker value={form.images} onChange={(images) => setForm({ ...form, images })} folder="rough-materials" label="Material photos" />
        <Field label="Display order"><TextInput type="number" min={0} max={100000} step="1" value={form.sortOrder} onChange={(sortOrder) => setForm({ ...form, sortOrder })} /></Field>
        <Switch checked={form.isAvailable} onChange={(isAvailable) => setForm({ ...form, isAvailable })} label="Available for inquiries" />
        <Switch checked={form.isPublished} onChange={(isPublished) => setForm({ ...form, isPublished })} label="Published in the public catalog" />
        {error ? <p className="rv-error-text" role="alert">{error}</p> : null}
        <div className="rv-rough-actions"><Button onClick={close} disabled={saving}>Cancel</Button><Button type="submit" variant="primary" loading={saving}>Save material</Button></div>
      </form>
    </Modal>
  </>;
}
