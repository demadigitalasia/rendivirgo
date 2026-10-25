"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import "./customer-lapidary.css";

type ProgressUpdate = { id: string; title: string; body: string; createdAt: string; media: Array<{ id: string; originalName: string; mimeType: string; size: number }> };
type LapidaryInvoice = { id: string; revision: number; revisionReason: string | null; currency: string; serviceAmount: number | string; returnShippingAmount: number | string; totalAmount: number | string; returnRecipientName: string | null; returnPhone: string | null; returnAddressLine1: string | null; returnAddressLine2: string | null; returnCity: string | null; returnState: string | null; returnPostalCode: string | null; returnCountry: string | null; returnCountryCode: string | null; status: string; paymentProofUploadedAt: string | null; paidAt: string | null };
type LapidaryProject = {
  id: string;
  requestNumber: string;
  materialSource: string;
  materialDescription: string;
  materialOrigin: string | null;
  materialCondition: string | null;
  materialWeightGram: number | string | null;
  serviceType: string;
  desiredShape: string | null;
  lengthMm: number | string | null;
  widthMm: number | string | null;
  depthMm: number | string | null;
  quantity: number;
  status: string;
  workCancelledAt: string | null;
  cancellationReason: string | null;
  quoteCurrency: string;
  serviceEstimateMin: number | string | null;
  serviceEstimateMax: number | string | null;
  estimateAcceptedAt: string | null;
  materialShippingInstructions: string | null;
  inboundCarrier: string | null;
  inboundTrackingNumber: string | null;
  inboundTrackingUrl: string | null;
  materialReceivedAt: string | null;
  returnCarrier: string | null;
  returnTrackingNumber: string | null;
  returnTrackingUrl: string | null;
  returnShippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  items: Array<{ id: string; serviceType: string; workDescription: string | null; shapeKey: string | null; desiredShape: string | null; lengthMm: number | string | null; widthMm: number | string | null; depthMm: number | string | null; quantity: number }>;
  progressUpdates: ProgressUpdate[];
  invoice: LapidaryInvoice | null;
};
type PaymentMethods = { bankTransfer?: { enabled: boolean; bankName?: string; accountName?: string; accountNumber?: string; swiftCode?: string; currency?: string } };

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(payload?.message) ? payload.message.join(" · ") : payload?.message || "The request could not be completed.");
  return payload;
}

function formatMoney(currency: string, value: number | string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

export function CustomerLapidaryDashboard() {
  const router = useRouter();
  const search = useSearchParams();
  const claimToken = search.get("claim");
  const claimHandled = useRef(false);
  const [projects, setProjects] = useState<LapidaryProject[]>([]);
  const [payments, setPayments] = useState<PaymentMethods>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tracking, setTracking] = useState<Record<string, { carrier: string; trackingNumber: string; trackingUrl: string }>>({});
  const [proofs, setProofs] = useState<Record<string, File | null>>({});

  const load = useCallback(async () => {
    const me = await fetch("/api/customer-account/me", { credentials: "same-origin", cache: "no-store" });
    if (me.status === 401 || me.status === 403) {
      const next = `/account/lapidary${claimToken ? `?claim=${encodeURIComponent(claimToken)}` : ""}`;
      router.replace(`/account/login?next=${encodeURIComponent(next)}`);
      return;
    }
    await readJson(me);
    if (claimToken && !claimHandled.current) {
      await readJson(await fetch("/api/customer-account/lapidary/claim", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: claimToken }),
      }));
      claimHandled.current = true;
      router.replace("/account/lapidary");
      setSuccess("Your project is now linked to this account.");
    }
    const [projectResponse, paymentResponse] = await Promise.all([
      fetch("/api/customer-account/lapidary", { credentials: "same-origin", cache: "no-store" }),
      fetch("/api/payments/methods", { credentials: "same-origin", cache: "no-store" }),
    ]);
    const projectList = await readJson(projectResponse);
    const methodPayload = paymentResponse.ok ? await paymentResponse.json().catch(() => ({})) : {};
    setProjects(Array.isArray(projectList) ? projectList : []);
    setPayments(methodPayload);
    setLastUpdated(new Date().toLocaleTimeString());
  }, [claimToken, router]);

  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Projects could not be loaded."))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (loading || busyId || claimToken) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Projects could not be refreshed."));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [loading, busyId, claimToken, load]);

  async function acceptEstimate(project: LapidaryProject) {
    setBusyId(project.requestNumber); setError(""); setSuccess("");
    try {
      await readJson(await fetch(`/api/customer-account/lapidary/${encodeURIComponent(project.requestNumber)}/accept-estimate`, {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ accepted: true }),
      }));
      await load(); setSuccess(`Estimate accepted for ${project.requestNumber}. You can now enter your inbound tracking details.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Estimate could not be accepted."); }
    finally { setBusyId(""); }
  }

  async function submitTracking(project: LapidaryProject) {
    const form = tracking[project.requestNumber];
    if (!form?.carrier.trim() || !form.trackingNumber.trim()) { setError("Enter the carrier and tracking number."); return; }
    setBusyId(project.requestNumber); setError(""); setSuccess("");
    try {
      await readJson(await fetch(`/api/customer-account/lapidary/${encodeURIComponent(project.requestNumber)}/inbound-shipment`, {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, trackingUrl: form.trackingUrl.trim() || null }),
      }));
      await load(); setSuccess("Shipment tracking saved. The studio will confirm when the stone arrives.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Tracking details could not be saved."); }
    finally { setBusyId(""); }
  }

  async function uploadProof(project: LapidaryProject) {
    const file = proofs[project.requestNumber];
    if (!file) { setError("Choose a transfer receipt image first."); return; }
    const body = new FormData(); body.append("file", file); body.append("revision", String(project.invoice?.revision ?? 1));
    setBusyId(project.requestNumber); setError(""); setSuccess("");
    try {
      await readJson(await fetch(`/api/customer-account/lapidary/${encodeURIComponent(project.requestNumber)}/invoice/payment-proof`, { method: "POST", body, credentials: "same-origin" }));
      await load(); setProofs((current) => ({ ...current, [project.requestNumber]: null })); setSuccess("Payment receipt uploaded. The studio will confirm the transfer before shipping your stone back.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Payment receipt could not be uploaded."); }
    finally { setBusyId(""); }
  }

  function changeTracking(project: LapidaryProject, key: "carrier" | "trackingNumber" | "trackingUrl", value: string) {
    setTracking((current) => ({ ...current, [project.requestNumber]: { ...(current[project.requestNumber] ?? { carrier: "", trackingNumber: "", trackingUrl: "" }), [key]: value } }));
  }

  function changeProof(project: LapidaryProject, event: ChangeEvent<HTMLInputElement>) {
    setProofs((current) => ({ ...current, [project.requestNumber]: event.target.files?.[0] ?? null }));
  }

  if (loading) return <section className="customer-account customer-lapidary"><p>Loading your lapidary projects…</p></section>;

  return <section className="customer-account customer-lapidary">
    <header className="customer-lapidary__header"><div><p className="customer-account__eyebrow">CUSTOMER DASHBOARD · LAPIDARY</p><h1>Your stone projects</h1><p>Follow your material, studio updates, invoice, and return shipment.</p></div><Link href="/account">Back to account</Link></header>
    <div className="customer-lapidary__refresh"><button type="button" className="button" disabled={Boolean(busyId)} onClick={() => void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Refresh failed."))}>Refresh projects</button>{lastUpdated ? <small>Updated {lastUpdated}. Refreshes automatically while this page is visible.</small> : null}</div>
    {error ? <p className="customer-account__error" role="alert">{error}</p> : null}
    {success ? <p className="customer-account__message" role="status">{success}</p> : null}
    {projects.length ? <div className="customer-lapidary__projects">{projects.map((project) => <article className="customer-lapidary__project" key={project.id}>
      <div className="customer-lapidary__project-heading"><div><span className="customer-lapidary__eyebrow">PROJECT REFERENCE</span><h2>{project.requestNumber}</h2></div><strong className="customer-lapidary__status">{project.status.replace(/([a-z])([A-Z])/g, "$1 $2")}</strong></div>
      {project.workCancelledAt ? <p className="customer-lapidary__shipment"><strong>Studio work cancelled:</strong> {project.cancellationReason}. {project.status === "ReturnPending" ? "The studio is arranging the return of your material. Any return shipping fee will be listed separately." : "Follow the return shipment below."}</p> : null}
      <div className="customer-lapidary__summary"><div><span>Material</span><strong>{project.materialDescription}</strong>{project.materialWeightGram ? <small>{project.materialWeightGram} g estimated · {project.materialCondition || "Condition to be reviewed at arrival"}</small> : null}</div><div><span>Work requested</span><strong>{project.items.map((item) => `${item.serviceType.replace(/([a-z])([A-Z])/g, "$1 $2")} · ${item.desiredShape || item.shapeKey || project.desiredShape || "Shape to discuss"} · ${item.quantity} pc`).join(" / ")}</strong></div></div>

      {project.status === "Approved" && project.materialShippingInstructions ? <section className="customer-lapidary__action-card"><h3>Studio approval and material instructions</h3><p>Service estimate: <strong>{formatMoney(project.quoteCurrency, project.serviceEstimateMin ?? 0)}–{formatMoney(project.quoteCurrency, project.serviceEstimateMax ?? 0)}</strong>. The final service fee will stay within the accepted maximum. Return shipping is calculated after the work is complete.</p><p className="customer-lapidary__shipping-instructions">{project.materialShippingInstructions}</p><label className="customer-lapidary__estimate"><input type="checkbox" checked={Boolean(project.estimateAcceptedAt)} onChange={() => { if (!project.estimateAcceptedAt) void acceptEstimate(project); }} disabled={Boolean(project.estimateAcceptedAt) || busyId === project.requestNumber} /><span>I accept this estimated service range and maximum before work begins.</span></label>{project.estimateAcceptedAt ? <div className="customer-lapidary__tracking"><h4>When you send the stone, add its tracking details</h4><div className="customer-lapidary__tracking-fields"><label>Carrier<input value={tracking[project.requestNumber]?.carrier ?? ""} onChange={(event) => changeTracking(project, "carrier", event.target.value)} /></label><label>Tracking number<input value={tracking[project.requestNumber]?.trackingNumber ?? ""} onChange={(event) => changeTracking(project, "trackingNumber", event.target.value)} /></label><label>Tracking link (optional)<input type="url" value={tracking[project.requestNumber]?.trackingUrl ?? ""} onChange={(event) => changeTracking(project, "trackingUrl", event.target.value)} /></label></div><button type="button" className="button button--primary" onClick={() => void submitTracking(project)} disabled={busyId === project.requestNumber}>{busyId === project.requestNumber ? "Saving…" : "Save shipment details"}</button></div> : null}</section> : null}

      {project.status === "EstimateSent" && !project.estimateAcceptedAt ? <section className="customer-lapidary__action-card"><h3>Updated estimate requires your approval</h3><p>Service estimate: <strong>{formatMoney(project.quoteCurrency, project.serviceEstimateMin ?? 0)}–{formatMoney(project.quoteCurrency, project.serviceEstimateMax ?? 0)}</strong></p><label className="customer-lapidary__estimate"><input type="checkbox" onChange={(event) => { if (event.target.checked) void acceptEstimate(project); }} disabled={busyId === project.requestNumber} /><span>I accept this updated estimated service range and maximum.</span></label></section> : null}

      {project.inboundTrackingNumber ? <p className="customer-lapidary__shipment"><strong>Material sent:</strong> {project.inboundCarrier} · {project.inboundTrackingNumber}{project.inboundTrackingUrl ? <> · <a href={project.inboundTrackingUrl} target="_blank" rel="noreferrer">Track parcel</a></> : null}</p> : null}
      {project.materialReceivedAt ? <p className="customer-lapidary__shipment"><strong>Material received:</strong> {new Date(project.materialReceivedAt).toLocaleString()}</p> : null}

      {project.invoice ? <section className="customer-lapidary__invoice"><div><p className="customer-lapidary__eyebrow">INVOICE V{project.invoice.revision} · {project.invoice.status.replace(/([a-z])([A-Z])/g, "$1 $2")}</p><h3>{formatMoney(project.invoice.currency, project.invoice.totalAmount)}</h3></div><dl><div><dt>Lapidary service</dt><dd>{formatMoney(project.invoice.currency, project.invoice.serviceAmount)}</dd></div><div><dt>Return shipping</dt><dd>{formatMoney(project.invoice.currency, project.invoice.returnShippingAmount)}</dd></div><div className="customer-lapidary__invoice-total"><dt>Total due</dt><dd>{formatMoney(project.invoice.currency, project.invoice.totalAmount)}</dd></div></dl><div className="customer-lapidary__return-address"><strong>Return address used for this invoice</strong><address>{[project.invoice.returnRecipientName, project.invoice.returnPhone, project.invoice.returnAddressLine1, project.invoice.returnAddressLine2, project.invoice.returnCity, project.invoice.returnState, project.invoice.returnPostalCode, project.invoice.returnCountry || project.invoice.returnCountryCode].filter(Boolean).join("\n")}</address><small>Contact the studio before paying if this address needs to change, since return shipping was priced for this destination.</small></div>{project.invoice.status === "AwaitingPayment" ? <div className="customer-lapidary__payment"><h4>Pay by bank transfer</h4>{project.invoice.revisionReason ? <p>Invoice revision: {project.invoice.revisionReason}. Use this current version when paying.</p> : null}{payments.bankTransfer?.enabled ? <address>{payments.bankTransfer.bankName}<br />Account name: {payments.bankTransfer.accountName}<br />Account number: {payments.bankTransfer.accountNumber}<br />SWIFT: {payments.bankTransfer.swiftCode}<br />Currency: {payments.bankTransfer.currency}</address> : <p>Bank transfer details are unavailable. Please contact the studio before paying.</p>}<label>Upload transfer receipt<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => changeProof(project, event)} /></label>{project.invoice.paymentProofUploadedAt ? <small>Receipt uploaded {new Date(project.invoice.paymentProofUploadedAt).toLocaleString()}. Waiting for studio confirmation.</small> : null}<button type="button" className="button button--primary" onClick={() => void uploadProof(project)} disabled={busyId === project.requestNumber || !payments.bankTransfer?.enabled}>{busyId === project.requestNumber ? "Uploading…" : "Upload payment receipt"}</button></div> : project.invoice.status === "Paid" ? <p className="customer-lapidary__shipment">Payment confirmed {project.invoice.paidAt ? `on ${new Date(project.invoice.paidAt).toLocaleString()}` : ""}. The studio will prepare your return parcel.</p> : <p className="customer-lapidary__shipment">This invoice was voided. Contact the studio if you need an updated invoice.</p>}</section> : <p className="customer-lapidary__address-reminder">Before the final invoice is prepared, confirm your return delivery address in <Link href="/account#profile-details">your account profile</Link>.</p>}

      {project.returnTrackingNumber ? <p className="customer-lapidary__shipment"><strong>Return parcel:</strong> {project.returnCarrier} · {project.returnTrackingNumber}{project.returnTrackingUrl ? <> · <a href={project.returnTrackingUrl} target="_blank" rel="noreferrer">Track parcel</a></> : null}</p> : null}
      {project.deliveredAt ? <p className="customer-lapidary__shipment"><strong>Delivered:</strong> {new Date(project.deliveredAt).toLocaleString()}</p> : null}

      <section className="customer-lapidary__timeline"><h3>Studio progress</h3>{project.progressUpdates.length ? <ol>{[...project.progressUpdates].reverse().map((update) => <li key={update.id}><time>{new Date(update.createdAt).toLocaleString()}</time><h4>{update.title}</h4><p>{update.body}</p>{update.media.length ? <div className="customer-lapidary__photos">{update.media.map((media) => <a href={`/api/customer-account/lapidary/${encodeURIComponent(project.requestNumber)}/updates/${update.id}/media/${media.id}`} target="_blank" rel="noreferrer" key={media.id}><img src={`/api/customer-account/lapidary/${encodeURIComponent(project.requestNumber)}/updates/${update.id}/media/${media.id}`} alt={media.originalName} loading="lazy" /></a>)}</div> : null}</li>)}</ol> : <p>The studio will post project steps and photos here as work progresses.</p>}</section>
    </article>)}</div> : <div className="customer-lapidary__empty"><h2>No projects linked yet</h2><p>If the studio has approved your stone request, use the secure link in their email after signing in. If you need help, reply to the approval email with your project reference.</p><Link href="/lapidary/custom-order">Start a lapidary request</Link></div>}
  </section>;
}
