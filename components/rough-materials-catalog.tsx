"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/localized-link";
import { useLanguage } from "@/components/providers";
import { formatUSD } from "@/lib/catalog";
import { roughEstimate, ROUGH_MAX_TYPES, ROUGH_MINIMUM_KG, type RoughMaterial } from "@/lib/rough-materials";
import "./rough-materials.css";

type Quote = { reference: string; quotedAt: string; totalKg: number; total: number; lines: { materialId: string; quantityKg: number; pricePerKg: number; subtotal: number }[]; requestText: string; whatsappUrl: string | null; emailUrl: string | null; expiresAt: string };
const weight = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 3 });

function MaterialCard({ material, selected, locked, onSelect, id }: { material: RoughMaterial; selected: boolean; locked: boolean; onSelect: () => void; id: boolean }) {
  const [photo, setPhoto] = useState(0);
  const available = material.isAvailable && (material.availableKg === null || material.availableKg > 0);
  return <article className={`rough-card${selected ? " is-selected" : ""}`}>
    <div className="rough-card__photo">{material.images.length ? <img src={material.images[photo] || material.images[0]} alt={`${material.name} — ${photo + 1}`} loading="lazy" /> : <span>{id ? "Foto segera tersedia" : "Photo coming soon"}</span>}<span className="rough-card__tag">{selected ? (id ? "DIPILIH" : "SELECTED") : available ? (id ? "TERSEDIA" : "AVAILABLE") : (id ? "TIDAK TERSEDIA" : "UNAVAILABLE")}</span></div>
    {material.images.length > 1 ? <div className="rough-card__thumbnails">{material.images.map((image, index) => <button type="button" key={`${image}-${index}`} onClick={() => setPhoto(index)} aria-label={`${id ? "Lihat foto" : "View photo"} ${index + 1}: ${material.name}`} aria-pressed={photo === index}><img src={image} alt="" loading="lazy" /></button>)}</div> : null}
    <div className="rough-card__body"><p className="eyebrow">{material.stoneType} · {material.sku}</p><h2>{material.name}</h2><p className="rough-card__origin">{material.origin}</p><p className="rough-card__description">{material.description}</p>{material.sizeNotes ? <p className="rough-card__size">{material.sizeNotes}</p> : null}<p className="rough-card__availability">{material.availableKg !== null ? `${weight(material.availableKg)} kg ${id ? "tersedia" : "available"}` : (id ? "Ketersediaan dikonfirmasi oleh tim kami" : "Availability confirmed by our team")}</p><div className="rough-card__bottom"><p><strong>{formatUSD(material.pricePerKg)}</strong><span> / kg</span></p><button type="button" disabled={!selected && (!available || locked)} aria-pressed={selected} onClick={onSelect}>{selected ? (id ? "Hapus pilihan" : "Remove") : !available ? (id ? "Tidak tersedia" : "Unavailable") : locked ? (id ? "Maks. 2 bahan" : "2-material limit") : (id ? "Pilih bahan" : "Select material")}</button></div></div>
  </article>;
}

export function RoughMaterialsCatalog() {
  const { language } = useLanguage();
  const id = language === "id";
  const [items, setItems] = useState<RoughMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [country, setCountry] = useState("");
  const [port, setPort] = useState("");
  const [quote, setQuote] = useState<{ key: string; value: Quote } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem("rv-rough-inquiry-v1") || "null");
      if (draft?.version === 1 && draft.chosen && typeof draft.chosen === "object" && !Array.isArray(draft.chosen)) {
        const selections = Object.entries(draft.chosen).filter(([key, value]) => key.length <= 100 && typeof value === "string" && value.length <= 20).slice(0, ROUGH_MAX_TYPES);
        setChosen(Object.fromEntries(selections) as Record<string, string>);
        setCountry(typeof draft.country === "string" ? draft.country.slice(0, 120) : "");
        setPort(typeof draft.port === "string" ? draft.port.slice(0, 160) : "");
      }
    } catch { /* Draft storage may be blocked or outdated. */ }
    setDraftReady(true);
  }, []);
  useEffect(() => {
    if (!draftReady || loading || error) return;
    try { localStorage.setItem("rv-rough-inquiry-v1", JSON.stringify({ version: 1, chosen, country, port })); }
    catch { /* The inquiry remains usable without browser storage. */ }
  }, [draftReady, loading, error, chosen, country, port]);
  const lines = useMemo(() => Object.entries(chosen).flatMap(([key, quantity]) => {
    const material = items.find((entry) => entry.id === key);
    return material ? [{ material, quantity }] : [];
  }), [chosen, items]);
  const estimate = roughEstimate(lines);
  const requestKey = JSON.stringify({ items: lines.map(({ material, quantity }) => ({ materialId: material.id, quantityKg: Number(quantity) })), country: country.trim(), port: port.trim() });
  const quoteKey = `${requestKey}:${refresh}`;
  const currentQuote = quote?.key === quoteKey && new Date(quote.value.expiresAt).getTime() > now ? quote.value : null;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch("/api/rough-materials", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(id ? "Katalog belum dapat dimuat." : "We could not load the material catalog.");
      const data = await response.json() as { items: RoughMaterial[] };
      setItems(data.items);
      setChosen((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => data.items.some((material) => material.id === key))));
    }).catch((caught) => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Please try again."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, retry]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    const onFocus = () => { setNow(Date.now()); setRefresh((value) => value + 1); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, []);

  // Renew once per accepted quote, without a repeated retry loop on failure.
  useEffect(() => {
    if (!quote || quote.key !== quoteKey) return;
    const timer = window.setTimeout(() => {
      setNow(Date.now());
      setRefresh((value) => value + 1);
    }, Math.max(0, new Date(quote.value.expiresAt).getTime() - Date.now()));
    return () => window.clearTimeout(timer);
  }, [quote, quoteKey]);

  useEffect(() => {
    if (!estimate.valid || !draftReady) { setQuote(null); setQuoteError(""); setQuoteBusy(false); return; }
    const controller = new AbortController();
    setQuoteError(""); setCopied(false); setQuoteBusy(true);
    const timer = window.setTimeout(() => {
      fetch("/api/rough-materials/quote", { method: "POST", headers: { "content-type": "application/json" }, body: requestKey, signal: controller.signal }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" · ") : data.message || "We could not check current pricing.");
        if (!controller.signal.aborted) { setNow(Date.now()); setQuote({ key: quoteKey, value: data }); }
      }).catch((caught) => { if (!controller.signal.aborted) setQuoteError(caught instanceof Error ? caught.message : "Please try again."); }).finally(() => { if (!controller.signal.aborted) setQuoteBusy(false); });
    }, 700);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [requestKey, quoteKey, estimate.valid, draftReady]);

  const toggle = (material: RoughMaterial) => setChosen((previous) => {
    if (Object.hasOwn(previous, material.id)) { const next = { ...previous }; delete next[material.id]; return next; }
    if (Object.keys(previous).length >= ROUGH_MAX_TYPES || !material.isAvailable || material.availableKg === 0) return previous;
    return { ...previous, [material.id]: String(Math.min(Object.keys(previous).length ? 1000 : ROUGH_MINIMUM_KG, material.availableKg ?? ROUGH_MINIMUM_KG)) };
  });
  const filtered = items.filter((material) => `${material.name} ${material.stoneType} ${material.origin} ${material.sku}`.toLowerCase().includes(search.trim().toLowerCase()));
  const progress = Math.min(100, Math.max(0, estimate.totalKg / ROUGH_MINIMUM_KG * 100));
  const handoff = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!currentQuote || Date.now() >= new Date(currentQuote.expiresAt).getTime()) { event.preventDefault(); setRefresh((value) => value + 1); }
  };

  return <section className="rough-materials page-container">
    <Link href="/wholesale" className="rough-back">← {id ? "Semua jalur wholesale" : "All wholesale paths"}</Link>
    <header className="rough-hero"><div><p className="eyebrow">{id ? "BAHAN ALAM · PASOKAN DALAM JUMLAH BESAR" : "NATURAL MATERIALS · BULK SUPPLY"}</p><h1>Rough Materials<span>{id ? "Awal dari karya Anda." : "Where your craft begins."}</span></h1><p>{id ? "Jelajahi bahan, hitung kebutuhan, dan mulai percakapan dengan tim kami. Tanpa akun atau login." : "Explore the material, estimate your needs, and start a conversation with our team. No account or login required."}</p></div><div className="rough-hero__rules"><strong>2 <span>{id ? "ton minimum" : "metric tons minimum"}</span></strong><p>{id ? "Total gabungan minimal 2.000 kg" : "A combined minimum of 2,000 kg"}</p><div /><strong>2 <span>{id ? "jenis bahan maksimal" : "material types maximum"}</span></strong><p>{id ? "Satu atau dua bahan dalam satu permintaan" : "One or two materials in each inquiry"}</p></div></header>
    <div className="rough-workspace"><div className="rough-catalog"><div className="rough-catalog__heading"><div><p className="eyebrow">{id ? "KOLEKSI BAHAN" : "THE MATERIAL COLLECTION"}</p><h2>{id ? "Pilih bahan Anda" : "Choose your materials"}</h2></div><label className="rough-search"><span className="sr-only">{id ? "Cari bahan" : "Search materials"}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={id ? "Cari batu, asal, atau kode…" : "Search stone, origin, or SKU…"} /></label></div>
      {loading ? <p className="rough-empty" role="status">{id ? "Memuat katalog…" : "Loading materials…"}</p> : error ? <div className="rough-empty" role="alert"><p>{error}</p><button className="button" type="button" onClick={() => setRetry((value) => value + 1)}>{id ? "Coba lagi" : "Try again"}</button></div> : !items.length ? <div className="rough-empty"><h3>{id ? "Koleksi bahan sedang disiapkan" : "Our material collection is being prepared"}</h3><p>{id ? "Hubungi tim kami untuk membahas pasokan bahan mentah." : "Talk to our team about current rough material supply."}</p><Link className="button" href="/contact">{id ? "Hubungi kami" : "Contact our team"}</Link></div> : !filtered.length ? <p className="rough-empty">{id ? "Tidak ada bahan yang sesuai pencarian." : "No materials match your search."}</p> : <div className="rough-grid">{filtered.map((material) => <MaterialCard key={material.id} material={material} id={id} selected={Object.hasOwn(chosen, material.id)} locked={lines.length >= ROUGH_MAX_TYPES} onSelect={() => toggle(material)} />)}</div>}
    </div><aside className="rough-summary" aria-labelledby="rough-summary-title"><p className="eyebrow">{id ? "KALKULATOR KEBUTUHAN" : "YOUR MATERIAL ESTIMATE"}</p><h2 id="rough-summary-title">{id ? "Susun permintaan Anda" : "Build your inquiry"}</h2><div className="rough-summary__selection-count">{id ? "Bahan dipilih" : "Materials selected"}<strong>{lines.length} / 2</strong></div>
      {!lines.length ? <p className="rough-summary__hint">{id ? "Pilih satu atau dua bahan untuk mulai menghitung." : "Select one or two materials to start your estimate."}</p> : <div className="rough-summary__lines">{lines.map(({ material, quantity }) => {
        const serverLine = currentQuote?.lines.find((line) => line.materialId === material.id);
        const qty = Number.isFinite(Number(quantity)) ? Number(quantity) : 0;
        return <div className="rough-summary__line" key={material.id}><div><strong>{material.name}</strong><button type="button" onClick={() => toggle(material)} aria-label={`${id ? "Hapus" : "Remove"} ${material.name}`}>×</button></div><small>{material.sku} · {formatUSD(serverLine?.pricePerKg ?? material.pricePerKg)}/kg</small><label>{id ? "Berat (kg)" : "Weight (kg)"}<input type="number" min="0.001" max={material.availableKg ?? 1000000} step="0.001" value={quantity} onChange={(event) => setChosen({ ...chosen, [material.id]: event.target.value })} /></label><span>{formatUSD(serverLine?.subtotal ?? Math.round(material.pricePerKg * qty * 100) / 100)}</span><button type="button" className="rough-summary__copy" onClick={() => {
          const otherKg = lines.filter((line) => line.material.id !== material.id).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
          const needed = Math.round((ROUGH_MINIMUM_KG - otherKg) * 1000) / 1000;
          if (needed > 0 && (material.availableKg === null || needed <= material.availableKg)) setChosen({ ...chosen, [material.id]: String(needed) });
        }} disabled={lines.some((line) => line.material.id !== material.id && (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) < 0)) || estimate.totalKg - qty >= ROUGH_MINIMUM_KG || (material.availableKg !== null && ROUGH_MINIMUM_KG - (estimate.totalKg - qty) > material.availableKg)}>{id ? "Sesuaikan total ke 2 ton" : "Set combined total to 2 tons"}</button>{material.availableKg !== null && qty > material.availableKg ? <p className="rough-summary__error">{id ? "Melebihi ketersediaan bahan." : "Exceeds available material weight."}</p> : null}</div>;
      })}</div>}
      <div className="rough-summary__progress"><div><span>{id ? "Total berat" : "Total weight"}</span><strong>{weight(estimate.totalKg)} kg</strong></div><progress value={progress} max="100" aria-label={id ? "Progres menuju minimum 2 ton" : "Progress toward 2-ton minimum"} /><p aria-live="polite">{!estimate.validWeights ? (id ? "Periksa berat dan ketersediaan bahan." : "Check weights and material availability.") : estimate.missingKg > 0 ? (id ? `Tambah ${weight(estimate.missingKg)} kg untuk memenuhi minimum.` : `Add ${weight(estimate.missingKg)} kg to reach the minimum.`) : (id ? "Minimum 2 ton terpenuhi." : "2-ton minimum reached.")}</p></div>
      <div className="rough-summary__total"><span>{id ? "Estimasi nilai material" : "Estimated material total"}</span><strong>{formatUSD(currentQuote?.total ?? estimate.total)}</strong></div>
      <p className="rough-summary__hint">{id ? "Ongkir, pajak, berat aktual, dan harga akhir dikonfirmasi oleh tim kami. Permintaan ini belum mereservasi stok." : "Shipping, taxes, actual weight, and the final price are confirmed by our team. An inquiry does not reserve stock."}</p>
      <div className="rough-summary__destination"><label>{id ? "Negara tujuan (opsional)" : "Destination country (optional)"}<input value={country} maxLength={120} onChange={(event) => setCountry(event.target.value)} autoComplete="country-name" /></label><label>{id ? "Pelabuhan tujuan (opsional)" : "Destination port (optional)"}<input value={port} maxLength={160} onChange={(event) => setPort(event.target.value)} /></label></div>
      {quoteError ? <div className="rough-summary__error" role="alert"><p>{quoteError}</p><button type="button" onClick={() => { setRetry((value) => value + 1); setRefresh((value) => value + 1); }}>{id ? "Periksa ulang" : "Check again"}</button></div> : null}
      {estimate.valid && !currentQuote && !quoteError ? <p role="status" className="rough-summary__hint">{quoteBusy ? (id ? "Memeriksa harga terbaru…" : "Checking current prices…") : (id ? "Estimasi kedaluwarsa. Perbarui harga untuk melanjutkan." : "Estimate expired. Refresh prices to continue.")} <button type="button" onClick={() => setRefresh((value) => value + 1)}>{id ? "Perbarui" : "Refresh"}</button></p> : null}
      <div className="rough-summary__actions">{currentQuote?.whatsappUrl ? <a href={currentQuote.whatsappUrl} target="_blank" rel="noopener noreferrer" className="button" onClick={handoff}>{id ? "Minta via WhatsApp" : "Request via WhatsApp"} ↗</a> : <button className="button" type="button" disabled>{id ? "Minta via WhatsApp" : "Request via WhatsApp"}</button>}{currentQuote?.emailUrl ? <a href={currentQuote.emailUrl} className="button button--outline" onClick={handoff}>{id ? "Minta via email" : "Request via Email"} ↗</a> : <button className="button button--outline" type="button" disabled>{id ? "Minta via email" : "Request via Email"}</button>}</div>
      {currentQuote ? <><p className="rough-summary__hint" role="status">{id ? "Harga diperiksa" : "Prices checked"}: {new Date(currentQuote.quotedAt).toLocaleTimeString(id ? "id-ID" : "en-GB", { hour: "2-digit", minute: "2-digit" })}. {currentQuote.lines.some((line) => line.pricePerKg !== items.find((material) => material.id === line.materialId)?.pricePerKg) ? (id ? "Harga telah berubah sejak katalog dimuat. Ringkasan menggunakan harga terbaru." : "Prices changed since the catalog loaded. Your summary uses current prices.") : ""}</p><p className="rough-summary__hint">{currentQuote.reference}</p><button type="button" className="rough-summary__copy" onClick={async () => { try { await navigator.clipboard.writeText(currentQuote.requestText); setCopied(true); } catch { setCopied(false); } }}>{copied ? (id ? "Ringkasan disalin" : "Summary copied") : (id ? "Salin ringkasan permintaan" : "Copy inquiry summary")}</button><details className="rough-summary__message"><summary>{id ? "Lihat isi pesan" : "Preview inquiry message"}</summary><pre>{currentQuote.requestText}</pre></details>{!currentQuote.whatsappUrl || !currentQuote.emailUrl ? <p className="rough-summary__hint">{id ? "Salah satu kontak belum tersedia. Gunakan kanal yang aktif atau " : "A contact channel is not configured. Use an available channel or "}<Link href="/contact">{id ? "hubungi tim kami" : "contact our team"}</Link>.</p> : null}</> : <p className="rough-summary__hint">{id ? "Permintaan aktif setelah total minimal 2.000 kg terpenuhi." : "Contact options unlock at a minimum combined weight of 2,000 kg."}</p>}
    </aside></div>
  </section>;
}
