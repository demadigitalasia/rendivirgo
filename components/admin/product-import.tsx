"use client";

import { useState } from "react";
import { apiFetch, apiUrl, errorMessage } from "./api";
import { Button, Field, Modal, Select } from "./ui";
import { toast } from "./toast";

type Preview = { valid: boolean; records: Record<string, string>[]; rows: { row: number; sku: string; name: string; action: string; errors: string[] }[] };
type Result = { created: number; updated: number; errors: string[] };

function photoSku(filename: string, skus: string[]) {
  const stem = filename.replace(/\.[^.]+$/, "");
  return skus.includes(stem) ? stem : [...skus].sort((a, b) => b.length - a.length).find(sku => stem.startsWith(`${sku}-`) && /^\d+$/.test(stem.slice(sku.length + 1)));
}

export function ProductImport({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [mode, setMode] = useState("create");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [uploaded, setUploaded] = useState<Map<File, string>>(new Map());
  const [committed, setCommitted] = useState(false);
  const skus = preview?.rows.map(row => row.sku).filter(Boolean) ?? [];
  const tooManyPhotos = skus.some(sku => photos.filter(photo => photoSku(photo.name, skus) === sku).length > 20);
  const duplicatePhotos = new Set(photos.map(photo => photo.name)).size !== photos.length;
  const unmatched = preview ? photos.filter(photo => !photoSku(photo.name, skus)) : [];
  const reset = () => { setPreview(null); setResult(null); setCommitted(false); };

  async function check() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData(); form.append("file", file); form.append("mode", mode);
      setPreview(await apiFetch<Preview>("/api/admin/products/import/preview", { method: "POST", body: form }));
      setResult(null); setCommitted(false);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function commit() {
    if (!preview?.valid || unmatched.length || tooManyPhotos || duplicatePhotos || committed) return;
    setBusy(true);
    try {
      const mapping: Record<string, string[]> = Object.create(null);
      const cache = new Map(uploaded);
      for (const [index, photo] of [...photos].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).entries()) {
        setProgress(`Uploading photo ${index + 1}/${photos.length}`);
        let url = cache.get(photo);
        if (!url) {
          const form = new FormData(); form.append("file", photo);
          const asset = await apiFetch<{ url: string }>("/api/admin/uploads?folder=products", { method: "POST", body: form });
          url = asset.url; cache.set(photo, url); setUploaded(new Map(cache));
        }
        const sku = photoSku(photo.name, skus)!;
        (mapping[sku] ??= []).push(url);
      }
      setProgress("Importing products…");
      const response = await apiFetch<Result>("/api/admin/products/import/commit", { json: { records: preview.records, mode, photos: mapping } });
      setResult(response); setCommitted(true); onImported();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); setProgress(""); }
  }

  return <Modal open={open} title="Bulk product import" onClose={() => { if (!busy) onClose(); }} footer={<>
    <Button disabled={busy} onClick={onClose}>Close</Button>
    <Button disabled={!file || busy} onClick={check}>Preview file</Button>
    <Button variant="primary" loading={busy} disabled={!preview?.valid || !!unmatched.length || tooManyPhotos || duplicatePhotos || committed} onClick={commit}>Import products</Button>
  </>}><div className="rv-stack">
    <p><a href={apiUrl("/api/admin/products/import/template")}>Download Excel template</a> · Up to 500 products per file.</p>
    <p className="rv-hint">New products are saved as Draft. SKU identifies each product. For updates, blank cells keep existing values. Categories must already exist.</p>
    <Field label="Import mode"><Select value={mode} disabled={busy} onChange={value => { setMode(value); reset(); }} options={[{ value: "create", label: "Add new products" }, { value: "update", label: "Update existing products" }, { value: "merge", label: "Add new and update existing" }]} /></Field>
    <Field label="Excel or CSV file"><input type="file" accept=".xlsx,.csv" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); reset(); }} /></Field>
    <Field label="Product photos (optional)"><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" disabled={busy} onChange={event => {
      const files = Array.from(event.target.files ?? []);
      if (files.some(file => file.size > 8 * 1024 * 1024)) { toast.error("Each photo must be 8 MB or smaller"); return; }
      setPhotos(files); setResult(null); setCommitted(false);
    }} /></Field>
    <p className="rv-hint">Select many photos at once. Use SKU.jpg or SKU-1.jpg, SKU-2.jpg. Matched photos replace the existing gallery; without photos the gallery is preserved. Each product supports up to 20 photos.</p>
    {tooManyPhotos && <p className="rv-error-text">Select no more than 20 photos per product.</p>}
    {duplicatePhotos && <p className="rv-error-text">Duplicate photo filenames. Select each photo once.</p>}
    {preview && <>
      <p>{preview.rows.filter(row => row.action === "create").length} new · {preview.rows.filter(row => row.action === "update").length} updates · {photos.length - unmatched.length} matched photos</p>
      {unmatched.length > 0 && <p className="rv-error-text">Unmatched photos: {unmatched.map(photo => photo.name).join(", ")}. Rename or remove these photos before importing.</p>}
      <div style={{ maxHeight: 360, overflow: "auto" }}><table className="rv-table"><thead><tr><th>Row</th><th>SKU / Product</th><th>Action / Validation</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.row}><td>{row.row}</td><td>{row.sku}<br />{row.name}</td><td>{row.action}{row.errors.map((error, index) => <p className="rv-error-text" key={index}>{error}</p>)}</td></tr>)}</tbody></table></div>
    </>}
    {progress && <p role="status">{progress}</p>}
    {result && <div role="status"><p>{result.created} created · {result.updated} updated · {result.errors.length} failed</p>{result.errors.map((error, index) => <p className="rv-error-text" key={index}>{error}</p>)}{result.errors.length > 0 && <p>Some rows were saved. Use update mode or remove successful rows before trying again.</p>}</div>}
  </div></Modal>;
}
