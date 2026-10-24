"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/providers";

type Application = {
  wholesaleAccess: boolean;
  wholesaleStatus: "None" | "Pending" | "Approved" | "Rejected";
  wholesaleReviewReason?: string | null;
  wholesaleBusinessName?: string | null;
  wholesaleBuyerType?: string | null;
  wholesaleBusinessCountry?: string | null;
  wholesaleBusinessWebsite?: string | null;
  wholesaleBusinessNeeds?: string | null;
};

export function WholesaleApplication({ onApproved, onStatusChange }: { onApproved: () => void; onStatusChange: (status: Application["wholesaleStatus"]) => void }) {
  const { language } = useLanguage();
  const id = language === "id";
  const approved = useRef(onApproved);
  approved.current = onApproved;
  const statusChanged = useRef(onStatusChange);
  statusChanged.current = onStatusChange;
  const [application, setApplication] = useState<Application | null>(null);
  const [form, setForm] = useState({ businessName: "", buyerType: "Retailer", country: "", website: "", needs: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let initialized = false;
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const response = await fetch("/api/customer-account/me", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!response.ok) throw new Error(id ? "Status belum dapat dimuat. Coba lagi." : "We could not load your application. Please try again.");
        const data = await response.json() as Application;
        if (controller.signal.aborted) return;
        setApplication(data);
        statusChanged.current(data.wholesaleStatus);
        window.dispatchEvent(new Event("customer-access-changed"));
        setError("");
        if (!initialized) {
          setForm({ businessName: data.wholesaleBusinessName || "", buyerType: data.wholesaleBuyerType || "Retailer", country: data.wholesaleBusinessCountry || "", website: data.wholesaleBusinessWebsite || "", needs: data.wholesaleBusinessNeeds || "" });
          initialized = true;
        }
        if (data.wholesaleAccess) approved.current();
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Please try again.");
      } finally { checking = false; }
    };
    void check();
    const timer = window.setInterval(() => void check(), 30_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [id, retry]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/customer-account/wholesale-request", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, website: form.website.trim() || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(" · ") : result.message || "Please try again.");
      setApplication((previous) => ({ ...previous!, ...result }));
      statusChanged.current(result.wholesaleStatus);
      window.dispatchEvent(new Event("customer-access-changed"));
      if (result.wholesaleAccess) approved.current();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  };

  if (!application) return <div className="wholesale-application" role="status">{error || (id ? "Memuat pengajuan…" : "Loading application…")}{error ? <button type="button" className="button button--light" onClick={() => setRetry((value) => value + 1)}>{id ? "Coba lagi" : "Try again"}</button> : null}</div>;

  const pending = application.wholesaleStatus === "Pending";
  const rejected = application.wholesaleStatus === "Rejected";
  return <div className="wholesale-application">
    {pending ? <div className="wholesale-application__notice" role="status"><strong>{id ? "Permohonan sedang ditinjau" : "Your request is under review"}</strong><p>{id ? "Kami telah menerima informasi usaha Anda. Keputusan akan dikirim melalui email. Status halaman ini diperbarui otomatis." : "We have received your business details. We will email you with a decision. This page checks for updates automatically."}</p></div> : <>
      {rejected ? <div className="wholesale-application__notice" role="status"><strong>{id ? "Permohonan belum disetujui" : "Your application was not approved"}</strong><p>{application.wholesaleReviewReason}</p><p>{id ? "Perbarui informasi di bawah untuk mengajukan kembali." : "Update your information below to apply again."}</p></div> : null}
      <form onSubmit={submit} className="wholesale-application__form">
        <h2>{id ? "Ceritakan usaha Anda" : "Tell us about your business"}</h2>
        <div className="wholesale-application__fields">
          <label>{id ? "Nama usaha / studio" : "Business / studio name"}<input required minLength={2} maxLength={200} value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} autoComplete="organization" /></label>
          <label>{id ? "Jenis pembeli" : "Buyer type"}<select value={form.buyerType} onChange={(event) => setForm({ ...form, buyerType: event.target.value })}>{["Retailer", "Jewelry maker", "Stone dealer", "Designer", "Other"].map((type, index) => <option key={type} value={type}>{id ? ["Peritel", "Pembuat perhiasan", "Pedagang batu", "Desainer", "Lainnya"][index] : type}</option>)}</select></label>
          <label>{id ? "Negara usaha" : "Business country"}<input required minLength={2} maxLength={120} value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} autoComplete="country-name" /></label>
          <label>{id ? "Website / tautan bisnis (opsional)" : "Website / business link (optional)"}<input type="url" placeholder="https://" maxLength={500} value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
        </div>
        <label>{id ? "Produk yang dicari dan perkiraan kebutuhan pembelian" : "Products of interest and expected purchasing needs"}<textarea required minLength={10} maxLength={2000} rows={3} value={form.needs} onChange={(event) => setForm({ ...form, needs: event.target.value })} /></label>
        <button type="submit" disabled={busy} className="button button--light">{busy ? (id ? "Mengirim…" : "Submitting…") : rejected ? (id ? "Ajukan kembali" : "Submit a new application") : (id ? "Ajukan akses Wholesale" : "Request Wholesale access")}</button>
      </form>
    </>}
    {error ? <p role="alert" className="wholesale-access__request-error">{error}</p> : null}
  </div>;
}
