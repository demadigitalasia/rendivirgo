"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, errorMessage, useApi, useList } from "@/components/admin/api";
import { TablePagination } from "@/components/admin/data-table";
import { Badge, Button, Card, Field, Loading, Modal, PageHeader, Select, Switch, TextArea, TextInput } from "@/components/admin/ui";
import { toast } from "@/components/admin/toast";
import { UploadIcon } from "@/components/icons";

const statuses = ["New", "Reviewing", "QuoteSent", "Approved", "MaterialInTransit", "MaterialReceived", "EstimateSent", "InProgress", "AwaitingPayment", "ReturnPending", "ReturnShipped", "Delivered", "Completed", "Declined", "Cancelled"];
type LapidaryRequest = {
  id: string; requestNumber: string; name: string; email: string; phone: string; country: string | null; company: string | null;
  workCancelledAt: string | null; cancellationReason: string | null;
  customer?: { name: string; email: string; phone: string | null; addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; postalCode: string | null; country: string | null; countryCode: string | null } | null;
  materialSource: string; materialDescription: string; materialOrigin: string | null; materialCondition: string | null; materialWeightGram: number | string | null;
  serviceType: string; desiredShape: string | null; finishPreference: string | null; additionalDetails: string | null;
  lengthMm: number | string | null; widthMm: number | string | null; depthMm: number | string | null; quantity: number;
  targetDate: string | null; details: string; referenceImageUrls: string[]; status: string; quoteAmount: number | string | null;
  quoteCurrency: string; estimatedDays: number | null; adminNotes: string | null; termsAcceptedAt: string; createdAt: string;
  serviceEstimateMin: number | string | null; serviceEstimateMax: number | string | null; estimateAcceptedAt: string | null;
  materialShippingInstructions: string | null; inboundCarrier: string | null; inboundTrackingNumber: string | null; inboundTrackingUrl: string | null; materialReceivedAt: string | null;
  returnCarrier: string | null; returnTrackingNumber: string | null; returnTrackingUrl: string | null;
  progressUpdates?: Array<{ id: string; title: string; body: string; isCustomerVisible: boolean; createdAt: string; media: Array<{ id: string; originalName: string; mimeType: string; size: number }> }>;
  emailOutbox?: Array<{ id: string; status: string; attempts: number; lastError: string | null; sentAt: string | null; createdAt: string }>;
  invoice?: { id: string; revision: number; revisionReason: string | null; currency: string; serviceAmount: number | string; returnShippingAmount: number | string; totalAmount: number | string; returnRecipientName: string | null; returnPhone: string | null; returnAddressLine1: string | null; returnAddressLine2: string | null; returnCity: string | null; returnState: string | null; returnPostalCode: string | null; returnCountry: string | null; returnCountryCode: string | null; status: string; paymentProofUploadedAt: string | null; paidAt: string | null } | null;
  items?: Array<{ id: string; serviceType: string; workDescription: string | null; shapeKey: string | null; desiredShape: string | null; lengthMm: number | string | null; widthMm: number | string | null; depthMm: number | string | null; quantity: number; materialQuantity: number | string | null; materialUnitSnapshot: string | null; components: Array<{ key: string; shapeKey?: string; desiredShape?: string; lengthMm?: number | string | null; widthMm?: number | string | null; depthMm?: number | string | null }> | null; productId: string | null; productNameSnapshot: string | null; productSkuSnapshot: string | null; productSlugSnapshot: string | null; productStoneTypeSnapshot: string | null; productOriginSnapshot: string | null; productPriceSnapshot: number | string | null; productCurrencySnapshot: string | null; product?: { id: string; slug: string; name: string; sku: string } | null }>;
  media?: Array<{ id: string; originalName: string; mimeType: string; size: number; createdAt: string }>;
};
type LapidaryRequestItem = NonNullable<LapidaryRequest["items"]>[number];
type LapidaryRequestComponent = NonNullable<LapidaryRequestItem["components"]>[number];

function displayStatus(status: string) { return status.replace(/([a-z])([A-Z])/g, "$1 $2"); }
function availableStatuses(request: LapidaryRequest) {
  if (request.materialSource !== "CustomerSupplied") return statuses;
  const next: Record<string, string[]> = {
    New: ["Reviewing", "Declined", "Cancelled"],
    Reviewing: ["Approved", "Declined", "Cancelled"],
    QuoteSent: ["Approved", "Declined", "Cancelled"],
    Approved: ["Declined", "Cancelled"],
    MaterialInTransit: ["MaterialReceived", "Cancelled"],
    MaterialReceived: ["EstimateSent", "InProgress", "Cancelled"],
    EstimateSent: ["InProgress", "Cancelled"],
    InProgress: ["Completed", "EstimateSent", "Cancelled"],
    Completed: ["AwaitingPayment", "Cancelled"],
    AwaitingPayment: ["ReturnShipped", "Cancelled"],
    ReturnPending: ["AwaitingPayment"],
    ReturnShipped: ["Delivered"],
    Delivered: [],
    Declined: [],
    Cancelled: [],
  };
  return [...new Set([request.status, ...(next[request.status] ?? [])])];
}
function displayValue(value: string | null | undefined) { return value ? value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/-/g, " ") : "—"; }
function dimension(value: number | string | null) { return value === null ? "—" : `${value} mm`; }
function snapshotPrice(value: number | string | null, currency: string | null) { return value === null ? "" : new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(Number(value)); }
function requestedUnitCount(item: { serviceType: string; quantity: number }) {
  if (item.serviceType === "CabochonSuite") return `${item.quantity} ${item.quantity === 1 ? "suite" : "suites"}`;
  if (item.serviceType === "CabochonPair") return `${item.quantity} ${item.quantity === 1 ? "pair" : "pairs"}`;
  return `${item.quantity} ${item.quantity === 1 ? "finished piece" : "finished pieces"}`;
}
function requestedShape(item: Pick<LapidaryRequestItem, "shapeKey" | "desiredShape">) {
  if (item.desiredShape) return item.desiredShape;
  if (!item.shapeKey) return "Shape to be discussed";
  return displayValue(item.shapeKey).replace(/^\w/, (letter) => letter.toUpperCase());
}
function requestItemSummary(items: Array<Pick<LapidaryRequestItem, "serviceType" | "shapeKey" | "desiredShape" | "quantity">>) {
  return items.map((item) => `${displayValue(item.serviceType)} · ${requestedShape(item)} · ${requestedUnitCount(item)}`).join(" / ");
}
function componentBrief(component: LapidaryRequestComponent) {
  const shape = component.desiredShape || displayValue(component.shapeKey);
  return `${component.key === "Pendant" ? "Pendant · 1 stone" : "Matching pair · 2 stones"}: ${shape} · L ${dimension(component.lengthMm ?? null)} · W ${dimension(component.widthMm ?? null)} · D ${dimension(component.depthMm ?? null)}`;
}

export default function AdminLapidaryRequestsPage() {
  const state = useList<LapidaryRequest>("/api/admin/lapidary/requests", { pageSize: 15 });
  const readiness = useApi<{ email: { enabled: boolean; senderConfigured: boolean }; origin: string | null; originError: string | null; pendingEmails: number; failedEmails: number }>("/api/admin/lapidary/requests/readiness");
  const [reviseInvoice, setReviseInvoice] = useState(false);
  const [invoiceRevisionReason, setInvoiceRevisionReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [confirmMaterialReceived, setConfirmMaterialReceived] = useState(false);
  const [progressVisible, setProgressVisible] = useState(true);
  const [inviting, setInviting] = useState(false);
  const statusFilter = String(state.params.status ?? "");
  const searchParams = useSearchParams();
  const openId = searchParams.get("open");
  const [selected, setSelected] = useState<LapidaryRequest | null>(null);
  const [handledOpenId, setHandledOpenId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ status: "Reviewing", quoteAmount: "", quoteCurrency: "USD", estimatedDays: "", adminNotes: "", serviceEstimateMin: "", serviceEstimateMax: "", materialShippingInstructions: "", invoiceServiceAmount: "", invoiceReturnShippingAmount: "", invoiceCurrency: "USD", returnCarrier: "", returnTrackingNumber: "", returnTrackingUrl: "" });
  const [progressTitle, setProgressTitle] = useState("");
  const [progressBody, setProgressBody] = useState("");
  const [progressPhotos, setProgressPhotos] = useState<File[]>([]);
  const [publishingProgress, setPublishingProgress] = useState(false);

  const setRequestForm = useCallback((detail: LapidaryRequest) => {
    setSelected(detail);
    setForm({ status: detail.status, quoteAmount: detail.quoteAmount === null ? "" : String(detail.quoteAmount), quoteCurrency: detail.quoteCurrency || "USD", estimatedDays: detail.estimatedDays === null ? "" : String(detail.estimatedDays), adminNotes: detail.adminNotes ?? "", serviceEstimateMin: detail.serviceEstimateMin === null ? "" : String(detail.serviceEstimateMin), serviceEstimateMax: detail.serviceEstimateMax === null ? "" : String(detail.serviceEstimateMax), materialShippingInstructions: detail.materialShippingInstructions ?? "", invoiceServiceAmount: detail.workCancelledAt ? "0" : detail.invoice ? String(detail.invoice.serviceAmount) : "", invoiceReturnShippingAmount: detail.invoice ? String(detail.invoice.returnShippingAmount) : "", invoiceCurrency: detail.quoteCurrency || "USD", returnCarrier: detail.returnCarrier ?? "", returnTrackingNumber: detail.returnTrackingNumber ?? "", returnTrackingUrl: detail.returnTrackingUrl ?? "" });
    setProgressTitle(""); setProgressBody(""); setProgressPhotos([]); setProgressVisible(true); setReviseInvoice(false); setInvoiceRevisionReason(""); setCancellationReason(""); setConfirmMaterialReceived(false);
  }, []);

  async function openRequest(item: LapidaryRequest) {
    setLoadingDetail(true); setSelected(item); setError("");
    try {
      const detail = await apiFetch<LapidaryRequest>(`/api/admin/lapidary/requests/${item.id}`);
      setRequestForm(detail);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLoadingDetail(false); }
  }

  useEffect(() => {
    if (!openId || handledOpenId === openId) return;
    setHandledOpenId(openId); setLoadingDetail(true);
    apiFetch<LapidaryRequest>(`/api/admin/lapidary/requests/${openId}`)
      .then(setRequestForm)
      .catch((caught) => toast.error(errorMessage(caught)))
      .finally(() => setLoadingDetail(false));
  }, [openId, handledOpenId, setRequestForm]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || saving) return;
    if (form.status === "QuoteSent" && !form.quoteAmount.trim()) { setError("Add the quote amount before sending a quote."); return; }
    if (selected.materialSource === "CustomerSupplied" && form.status === "Approved" && (!form.serviceEstimateMin.trim() || !form.serviceEstimateMax.trim() || !form.materialShippingInstructions.trim())) { setError("Add an estimate range and the studio shipping address/instructions before approving customer supplied material."); return; }
    if (selected.materialSource === "CustomerSupplied" && form.status === "AwaitingPayment" && (selected.status !== "AwaitingPayment" || reviseInvoice) && (!form.invoiceServiceAmount.trim() || !form.invoiceReturnShippingAmount.trim())) { setError("Add the final service and return shipping fees to issue the invoice."); return; }
    if (reviseInvoice && invoiceRevisionReason.trim().length < 5) { setError("Add a revision reason of at least 5 characters."); return; }
    if (form.status === "Cancelled" && (selected.materialReceivedAt || selected.status === "MaterialInTransit") && cancellationReason.trim().length < 5) { setError("Explain the cancellation and arrange the material return."); return; }
    setSaving(true); setError("");
    try {
      await apiFetch(`/api/admin/lapidary/requests/${selected.id}`, { method: "PATCH", json: {
        status: form.status,
        reviseInvoice,
        invoiceRevisionReason: reviseInvoice ? invoiceRevisionReason.trim() : undefined,
        cancellationReason: cancellationReason.trim() || undefined,
        confirmMaterialReceived,
        quoteAmount: form.quoteAmount.trim() ? Number(form.quoteAmount) : null,
        quoteCurrency: form.quoteCurrency.trim().toUpperCase() || "USD",
        estimatedDays: form.estimatedDays.trim() ? Number(form.estimatedDays) : null,
        adminNotes: form.adminNotes,
        serviceEstimateMin: form.serviceEstimateMin.trim() ? Number(form.serviceEstimateMin) : null,
        serviceEstimateMax: form.serviceEstimateMax.trim() ? Number(form.serviceEstimateMax) : null,
        materialShippingInstructions: form.materialShippingInstructions,
        invoiceServiceAmount: form.invoiceServiceAmount.trim() ? Number(form.invoiceServiceAmount) : undefined,
        invoiceReturnShippingAmount: form.invoiceReturnShippingAmount.trim() ? Number(form.invoiceReturnShippingAmount) : undefined,
        invoiceCurrency: form.invoiceCurrency.trim().toUpperCase() || "USD",
        returnCarrier: form.returnCarrier,
        returnTrackingNumber: form.returnTrackingNumber,
        returnTrackingUrl: form.returnTrackingUrl.trim() || null,
      } });
      toast.success("Lapidary request updated"); setSelected(null); state.refresh();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setSaving(false); }
  }

  async function publishProgress() {
    if (!selected || publishingProgress) return;
    setPublishingProgress(true); setError("");
    try {
      const body = new FormData();
      body.append("title", progressTitle);
      body.append("body", progressBody);
      body.append("isCustomerVisible", String(progressVisible));
      progressPhotos.forEach((file) => body.append("media", file));
      const response = await fetch(`/api/admin/lapidary/requests/${selected.id}/updates`, { method: "POST", body, credentials: "same-origin" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(payload?.message) ? payload.message.join(" · ") : payload?.message || "Progress update could not be saved");
      const detail = await apiFetch<LapidaryRequest>(`/api/admin/lapidary/requests/${selected.id}`);
      setRequestForm(detail); toast.success("Customer progress updated");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setPublishingProgress(false); }
  }

  async function markInvoicePaid() {
    if (!selected) return;
    try {
      await apiFetch(`/api/admin/lapidary/requests/${selected.id}/invoice/paid`, { method: "PATCH", json: { revision: selected.invoice?.revision, proofUploadedAt: selected.invoice?.paymentProofUploadedAt } });
      const detail = await apiFetch<LapidaryRequest>(`/api/admin/lapidary/requests/${selected.id}`);
      setRequestForm(detail); toast.success("Bank transfer confirmed");
    } catch (caught) { setError(errorMessage(caught)); }
  }

  async function retryCustomerEmails() {
    if (!selected) return;
    try {
      await apiFetch(`/api/admin/lapidary/requests/${selected.id}/email/retry`, { method: "POST", json: {} });
      const detail = await apiFetch<LapidaryRequest>(`/api/admin/lapidary/requests/${selected.id}`);
      setRequestForm(detail); toast.success("Failed customer emails queued for retry");
    } catch (caught) { setError(errorMessage(caught)); }
  }

  async function reissueInvitation() {
    if (!selected || inviting) return;
    setInviting(true); setError("");
    try {
      await apiFetch(`/api/admin/lapidary/requests/${selected.id}/invitation`, { method: "POST", json: {} });
      toast.success("A new account invitation was queued");
      const detail = await apiFetch<LapidaryRequest>(`/api/admin/lapidary/requests/${selected.id}`);
      setRequestForm(detail);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setInviting(false); }
  }

  return <>
    <PageHeader title="Lapidary requests" subtitle="Review service inquiries, prepare quotes, and follow each project through the studio." actions={<Button href="/admin/lapidary/content">Manage studio content</Button>} />
    <div className="rv-content rv-lapidary-admin">
      {readiness.error ? <p className="rv-error-text" role="alert">Email readiness could not be checked. <Button onClick={readiness.refresh}>Retry readiness check</Button></p> : null}
      {readiness.data ? <Card title="Project notification readiness"><div className="rv-stack"><p className="rv-hint">Project links: {readiness.data.origin || readiness.data.originError}. Pending messages: {readiness.data.pendingEmails}. Failed messages: {readiness.data.failedEmails}.</p>{!readiness.data.email.enabled || !readiness.data.email.senderConfigured ? <p className="rv-error-text" role="status">Email delivery needs configuration. Requests can be reviewed and notifications remain queued. Configure the email provider and sender before approving a project or sending an invitation.</p> : <p className="rv-hint">Email provider and sender are configured. Provider acceptance does not confirm inbox delivery.</p>}<Button onClick={readiness.refresh}>Refresh readiness</Button></div></Card> : null}
      <div className="rv-lapidary-admin__summary"><div><span>Requests</span><strong>{state.data?.total ?? "—"}</strong></div><p>For customer supplied stones, the customer accepts the estimate and the studio confirms receipt before work starts.</p></div>
      <Card title="Request inbox" description="New customer inquiries are recorded here and sent to the store notification email.">
        <div className="rv-stack">
          <div className="rv-lapidary-admin__filters"><Field label="Search requests"><TextInput value={state.searchInput} onChange={state.setSearchInput} placeholder="Name, email, phone, or reference" /></Field><Field label="Filter by status"><Select value={statusFilter} onChange={(status) => state.update({ status: status || undefined, page: 1 })} options={[{ value: "", label: "All requests" }, ...statuses.map((value) => ({ value, label: displayStatus(value) }))]} /></Field></div>
          {state.error ? <p className="rv-error-text" role="alert">{state.error} <Button onClick={state.refresh}>Try again</Button></p> : null}
          {state.loading && !state.data ? <Loading /> : state.data?.items.length ? <div className="rv-lapidary-request-list">{state.data.items.map((item) => <article className="rv-lapidary-request-card" key={item.id}>
            <div className="rv-lapidary-request-card__main"><div className="rv-inline"><Badge tone={item.status === "New" ? "bronze" : item.status === "Completed" ? "green" : item.status === "Declined" || item.status === "Cancelled" ? "red" : "blue"}>{displayStatus(item.status)}</Badge><span className="rv-hint">{new Date(item.createdAt).toLocaleString()}</span></div><h2>{item.requestNumber}</h2><p><strong>{item.name}</strong> · {item.email}</p><p>{item.items?.length ? requestItemSummary(item.items) : `${displayValue(item.serviceType)} · ${item.quantity} ${item.serviceType === "CabochonPair" ? (item.quantity === 1 ? "pair" : "pairs") : (item.quantity === 1 ? "piece" : "pieces")}`} · {displayValue(item.materialSource)}</p></div>
            <Button variant="primary" onClick={() => void openRequest(item)}>Review request</Button>
          </article>)}</div> : <p className="rv-hint">{statusFilter || state.params.search ? "No requests match these filters." : "No Lapidary requests yet."}</p>}
          {state.data ? <TablePagination page={state.data.page} pageCount={state.data.pageCount} total={state.data.total} pageSize={state.data.pageSize} onPage={state.setPage} /> : null}
        </div>
      </Card>
    </div>
    <Modal open={Boolean(selected)} title={selected ? `Review ${selected.requestNumber}` : "Review request"} onClose={() => !saving && setSelected(null)} wide panelClassName="rv-lapidary-review-modal">
      {loadingDetail ? <Loading /> : selected ? <div className="rv-lapidary-detail">
        <div className="rv-lapidary-detail__facts">
          <section><h3>Customer</h3><p>{selected.name}{selected.company ? ` · ${selected.company}` : ""}</p><p><a href={`mailto:${selected.email}`}>{selected.email}</a></p><p><a href={`tel:${selected.phone}`}>{selected.phone}</a>{selected.country ? ` · ${selected.country}` : ""}</p></section>
          <section><h3>Material</h3><p>Source: {displayValue(selected.materialSource)}</p><p>{selected.materialDescription}</p>{selected.materialOrigin ? <p>Origin: {selected.materialOrigin}</p> : null}{selected.materialCondition ? <p>Condition: {selected.materialCondition}</p> : null}{selected.materialWeightGram !== null ? <p>Approximate weight: {selected.materialWeightGram} g</p> : null}</section>
          <section><h3>Work items</h3>{selected.items?.length ? selected.items.map((item, index) => <article className="rv-lapidary-admin__work-item" key={item.id}><h4>{String(index + 1).padStart(2, "0")} · {displayValue(item.serviceType)}</h4>{item.productNameSnapshot || item.product ? <p>Selected stone: {item.productNameSnapshot ?? item.product?.name}{item.productSkuSnapshot || item.product?.sku ? ` · ${item.productSkuSnapshot ?? item.product?.sku}` : ""}{item.productStoneTypeSnapshot ? ` · ${item.productStoneTypeSnapshot}` : ""}{item.productOriginSnapshot ? ` · ${item.productOriginSnapshot}` : ""}{item.productPriceSnapshot !== null ? ` · Listed material price ${snapshotPrice(item.productPriceSnapshot, item.productCurrencySnapshot)} / ${displayValue(item.materialUnitSnapshot)}` : ""}{item.materialQuantity !== null ? ` · Requested material ${item.materialQuantity} ${displayValue(item.materialUnitSnapshot)}` : ""}</p> : null}{item.workDescription ? <p className="rv-lapidary-detail__pre">Work notes: {item.workDescription}</p> : null}{item.components?.length ? item.components.map((component) => <p key={component.key}>{componentBrief(component)}</p>) : <p>Shape: {item.desiredShape || displayValue(item.shapeKey)} · L {dimension(item.lengthMm)} · W {dimension(item.widthMm)} · D {dimension(item.depthMm)}</p>}<p>Requested output: {requestedUnitCount(item)}</p></article>) : <><p>Service: {displayValue(selected.serviceType)}{selected.desiredShape ? ` · ${selected.desiredShape}` : ""}</p><p>Dimensions: L {dimension(selected.lengthMm)} · W {dimension(selected.widthMm)} · D {dimension(selected.depthMm)}</p><p>Quantity: {selected.quantity}</p></>}{selected.targetDate ? <p>Preferred date: {new Date(selected.targetDate).toLocaleDateString()}</p> : null}</section>
          <section><h3>Finish and requirements</h3><p>Finish preference: {displayValue(selected.finishPreference)}</p>{selected.additionalDetails ? <p className="rv-lapidary-detail__pre">{selected.additionalDetails}</p> : null}{selected.referenceImageUrls.length ? <><h3>Reference links</h3>{selected.referenceImageUrls.map((url) => <p key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></p>)}</> : null}{selected.media?.length ? <><h3>Private uploaded references</h3><div className="rv-lapidary-admin__media">{selected.media.map((media) => { const url = `/api/admin/lapidary/requests/${selected.id}/media/${media.id}`; return <article key={media.id}>{media.mimeType.startsWith("video/") ? <video src={url} controls preload="metadata" /> : <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={media.originalName} loading="lazy" /></a>}<p>{media.originalName}</p><small>{(media.size / (1024 * 1024)).toFixed(1)} MB</small></article>; })}</div></> : null}<p className="rv-hint">Terms accepted: {new Date(selected.termsAcceptedAt).toLocaleString()}</p></section>
        </div>
        {selected.emailOutbox?.length ? <section className="rv-card rv-stack"><div><h3>Customer email delivery</h3><p className="rv-hint">Messages are retried automatically. Sent means accepted by the email provider; inbox delivery is not confirmed. Failed messages with a retained payload can be retried.</p></div>{selected.emailOutbox.map((email) => <article className="rv-lapidary-work-update" key={email.id}><small>{email.status} · {email.attempts} attempts · queued {new Date(email.createdAt).toLocaleString()}</small>{email.sentAt ? <p>Sent {new Date(email.sentAt).toLocaleString()}</p> : null}{email.lastError ? <p className="rv-error-text">{email.lastError}</p> : null}</article>)}{selected.emailOutbox.some((email) => email.status === "Failed") ? <Button onClick={() => void retryCustomerEmails()}>Retry failed emails</Button> : null}</section> : null}
        {selected.materialSource === "CustomerSupplied" ? <section className="rv-card rv-stack">
          <div><h3>Material and return shipment</h3><p className="rv-hint">Customer pays the shipment to the studio. Set the studio receiving address in the approval instructions.</p></div>
          <p>Inbound: {selected.inboundCarrier ? `${selected.inboundCarrier} · ${selected.inboundTrackingNumber || "tracking pending"}` : "Customer has not sent tracking details"}{selected.inboundTrackingUrl ? <> · <a href={selected.inboundTrackingUrl} target="_blank" rel="noreferrer">Track inbound parcel</a></> : null}</p>
          <p>Material received: {selected.materialReceivedAt ? new Date(selected.materialReceivedAt).toLocaleString() : "Not confirmed"} · Estimate accepted: {selected.estimateAcceptedAt ? new Date(selected.estimateAcceptedAt).toLocaleString() : "Awaiting customer"}</p>
          {selected.customer ? <p>Return destination in customer profile: {[selected.customer.name, selected.customer.phone, selected.customer.addressLine1, selected.customer.addressLine2, selected.customer.city, selected.customer.state, selected.customer.postalCode, selected.customer.country || selected.customer.countryCode].filter(Boolean).join(", ") || "No complete address"}</p> : <p className="rv-hint">Customer has not linked a verified account yet.</p>}
          {selected.invoice ? <div><p>Final invoice: {selected.invoice.currency} {Number(selected.invoice.totalAmount).toFixed(2)} · {selected.invoice.status}</p><p>Address used for return shipping: {[selected.invoice.returnRecipientName, selected.invoice.returnPhone, selected.invoice.returnAddressLine1, selected.invoice.returnAddressLine2, selected.invoice.returnCity, selected.invoice.returnState, selected.invoice.returnPostalCode, selected.invoice.returnCountry || selected.invoice.returnCountryCode].filter(Boolean).join(", ")}</p>{selected.invoice.paymentProofUploadedAt ? <p><a href={`/api/admin/lapidary/requests/${selected.id}/invoice/payment-proof`} target="_blank" rel="noreferrer">Review bank transfer receipt</a> · uploaded {new Date(selected.invoice.paymentProofUploadedAt).toLocaleString()}</p> : <p className="rv-hint">No bank transfer receipt uploaded yet.</p>}{selected.invoice.status === "AwaitingPayment" && selected.invoice.paymentProofUploadedAt ? <Button onClick={() => void markInvoicePaid()}>Confirm bank transfer</Button> : null}</div> : null}
          {selected.returnTrackingNumber ? <p>Return: {selected.returnCarrier || "Carrier"} · {selected.returnTrackingNumber}{selected.returnTrackingUrl ? <> · <a href={selected.returnTrackingUrl} target="_blank" rel="noreferrer">Track return parcel</a></> : null}</p> : null}
        </section> : null}
        <section className="rv-card rv-stack">
          <div><h3>Customer account</h3>{selected.customer ? <p>Linked to {selected.customer.name} · {selected.customer.email}.</p> : <p className="rv-hint">The customer can claim this project with the secure link sent to their request email. Send a replacement link if needed.</p>}</div>
          {!selected.customer ? <Button loading={inviting} disabled={!readiness.data?.email.enabled || !readiness.data?.email.senderConfigured} onClick={() => void reissueInvitation()}>Send secure account link</Button> : null}
        </section>
        <form className="rv-stack" onSubmit={save}>
          <div className="rv-lapidary-admin__edit-grid">
            <Field label="Request status"><Select value={form.status} onChange={(status) => setForm({ ...form, status })} options={availableStatuses(selected).map((value) => ({ value, label: displayStatus(value) }))} /></Field>
            {selected.materialSource !== "CustomerSupplied" ? <Field label="Quote amount" hint="Leave blank until the quote is ready."><TextInput type="number" min={0} step="0.01" value={form.quoteAmount} onChange={(quoteAmount) => setForm({ ...form, quoteAmount })} /></Field> : null}
            <Field label="Currency"><TextInput maxLength={3} value={form.quoteCurrency} onChange={(quoteCurrency) => setForm({ ...form, quoteCurrency })} /></Field>
            <Field label="Estimated studio days"><TextInput type="number" min={1} max={3650} step="1" value={form.estimatedDays} onChange={(estimatedDays) => setForm({ ...form, estimatedDays })} /></Field>
          </div>
          {selected.materialSource === "CustomerSupplied" ? <>
            {form.status === "Cancelled" && (selected.materialReceivedAt || selected.status === "MaterialInTransit") ? <Field label="Cancellation reason" hint="The project will move to Return Pending so material can be returned before closing."><TextArea required maxLength={1000} value={cancellationReason} onChange={setCancellationReason} /></Field> : null}
            {selected.workCancelledAt ? <p className="rv-hint">Studio work cancelled: {selected.cancellationReason}. Arrange a return-only invoice with zero service fee.</p> : null}
            {selected.status === "ReturnPending" && !selected.materialReceivedAt ? <Switch checked={confirmMaterialReceived} onChange={setConfirmMaterialReceived} label="Confirm the cancelled material has arrived at the studio" /> : null}
            <section className="rv-card rv-stack">
              <div><h3>One Stone service estimate</h3><p className="rv-hint">The customer must accept the maximum before work starts. The final service fee cannot exceed this accepted maximum. Return shipping is invoiced separately after completion.</p></div>
              <div className="rv-lapidary-admin__edit-grid"><Field label="Estimated service minimum"><TextInput type="number" min={0} step="0.01" value={form.serviceEstimateMin} onChange={(serviceEstimateMin) => setForm({ ...form, serviceEstimateMin })} /></Field><Field label="Maximum agreed service fee"><TextInput type="number" min={0} step="0.01" value={form.serviceEstimateMax} onChange={(serviceEstimateMax) => setForm({ ...form, serviceEstimateMax })} /></Field></div>
              <Field label="Studio receiving address and shipping instructions" hint="Shown in the approval email. Include recipient, street address, contact phone, packaging advice, and the request number to include in the parcel."><TextArea rows={5} maxLength={4000} value={form.materialShippingInstructions} onChange={(materialShippingInstructions) => setForm({ ...form, materialShippingInstructions })} /></Field>
            </section>
            {form.status === "AwaitingPayment" ? <section className="rv-card rv-stack"><h3>{selected.workCancelledAt ? "Material return invoice" : "Final invoice"}</h3>{selected.invoice?.status === "AwaitingPayment" ? <><Switch checked={reviseInvoice} onChange={setReviseInvoice} label="Revise this unpaid invoice and use the current customer address" />{reviseInvoice ? <Field label="Revision reason" hint="The old receipt is invalidated. The customer receives the revised invoice and must upload a new receipt."><TextArea required maxLength={1000} value={invoiceRevisionReason} onChange={setInvoiceRevisionReason} /></Field> : null}</> : null}<div className="rv-lapidary-admin__edit-grid"><Field label="Final lapidary service fee"><TextInput disabled={Boolean(selected.workCancelledAt) || (selected.invoice?.status === "Paid" || (selected.invoice?.status === "AwaitingPayment" && !reviseInvoice))} type="number" min={0} step="0.01" value={form.invoiceServiceAmount} onChange={(invoiceServiceAmount) => setForm({ ...form, invoiceServiceAmount })} /></Field><Field label="Return shipping fee"><TextInput disabled={selected.invoice?.status === "Paid" || (selected.invoice?.status === "AwaitingPayment" && !reviseInvoice)} type="number" min={0} step="0.01" value={form.invoiceReturnShippingAmount} onChange={(invoiceReturnShippingAmount) => setForm({ ...form, invoiceReturnShippingAmount })} /></Field><Field label="Invoice currency"><TextInput maxLength={3} value={form.invoiceCurrency} onChange={(invoiceCurrency) => setForm({ ...form, invoiceCurrency })} /></Field></div></section> : null}
            {form.status === "ReturnShipped" ? <section className="rv-card rv-stack"><h3>Return tracking</h3><div className="rv-lapidary-admin__edit-grid"><Field label="Carrier"><TextInput maxLength={120} value={form.returnCarrier} onChange={(returnCarrier) => setForm({ ...form, returnCarrier })} /></Field><Field label="Tracking number"><TextInput maxLength={160} value={form.returnTrackingNumber} onChange={(returnTrackingNumber) => setForm({ ...form, returnTrackingNumber })} /></Field><Field label="Tracking link"><TextInput type="url" maxLength={1000} value={form.returnTrackingUrl} onChange={(returnTrackingUrl) => setForm({ ...form, returnTrackingUrl })} /></Field></div></section> : null}
          </> : null}
          <Field label="Internal notes"><TextArea value={form.adminNotes} onChange={(adminNotes) => setForm({ ...form, adminNotes })} rows={4} maxLength={8000} /></Field>
          <p className="rv-hint">Status transitions are checked by the API. Every new request queues a secure account link; approved customer-supplied projects also email studio shipping instructions. Invoices are created when you move the project to Awaiting Payment.</p>
          {error ? <p className="rv-error-text" role="alert">{error}</p> : null}
          <div className="rv-inline rv-lapidary-admin__actions"><Button onClick={() => setSelected(null)} disabled={saving}>Cancel</Button><Button type="submit" variant="primary" loading={saving}>Save request</Button></div>
        </form>
        <section className="rv-card rv-stack">
          <div><h3>Customer progress timeline</h3><p className="rv-hint">Publish a concise step and add photos. Only customer-visible updates are shown in their account.</p></div>
          {selected.progressUpdates?.length ? selected.progressUpdates.map((update) => <article className="rv-lapidary-work-update" key={update.id}><small>{new Date(update.createdAt).toLocaleString()} · {update.isCustomerVisible ? "Customer visible" : "Internal"}</small><h4>{update.title}</h4><p>{update.body}</p>{update.media.length ? <div className="rv-lapidary-admin__media">{update.media.map((media) => <a key={media.id} href={`/api/admin/lapidary/requests/${selected.id}/updates/${update.id}/media/${media.id}`} target="_blank" rel="noreferrer"><img src={`/api/admin/lapidary/requests/${selected.id}/updates/${update.id}/media/${media.id}`} alt={media.originalName} loading="lazy" /></a>)}</div> : null}</article>) : <p className="rv-hint">No progress updates yet.</p>}
          <Field label="Progress template"><Select value="" onChange={(value) => { if (value) setProgressTitle(value); }} options={[{ value: "", label: "Choose a stage or write your own" }, ...["Material received and photographed", "Stone assessment complete", "Shaping complete", "Grinding complete", "Polishing complete", "Final quality review complete", "Finished stone photos"].map((value) => ({ value, label: value }))]} /></Field>
          <Switch checked={progressVisible} onChange={setProgressVisible} label="Visible to the customer (turn off for an internal note)" />
          <Field label="Update title"><TextInput maxLength={160} value={progressTitle} onChange={setProgressTitle} placeholder="e.g. Stone assessment complete" /></Field>
          <Field label="Customer update"><TextArea rows={3} maxLength={4000} value={progressBody} onChange={setProgressBody} /></Field>
          <Field label="Progress photos" inputId="lapidary-progress-photos" hint="Up to 5 photos, 6 MB each." className="rv-lapidary-admin__progress-upload">
            <div className="rv-lapidary-progress-upload">
              <input id="lapidary-progress-photos" className="rv-lapidary-progress-upload__input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple aria-describedby="lapidary-progress-photos-hint" onChange={(event) => setProgressPhotos(Array.from(event.target.files ?? []))} />
              <label className="rv-lapidary-progress-upload__dropzone" htmlFor="lapidary-progress-photos">
                <span className="rv-lapidary-progress-upload__icon"><UploadIcon size={20} /></span>
                <span className="rv-lapidary-progress-upload__copy"><strong>{progressPhotos.length ? `${progressPhotos.length} photo${progressPhotos.length === 1 ? "" : "s"} selected` : "Choose progress photos"}</strong><small>{progressPhotos.length ? "Select again to replace these files." : "JPEG, PNG, WebP, or AVIF · up to 5 photos"}</small></span>
                <span className="rv-lapidary-progress-upload__browse">Browse files</span>
              </label>
              {progressPhotos.length ? <ul className="rv-lapidary-progress-upload__files">{progressPhotos.map((file) => <li key={`${file.name}-${file.size}-${file.lastModified}`}><span>{file.name}</span><small>{(file.size / (1024 * 1024)).toFixed(1)} MB</small></li>)}</ul> : null}
            </div>
          </Field>
          <Button variant="primary" loading={publishingProgress} disabled={progressTitle.trim().length < 2 || progressBody.trim().length < 2} onClick={() => void publishProgress()}>Publish progress update</Button>
        </section>
      </div> : error ? <p className="rv-error-text" role="alert">{error}</p> : null}
    </Modal>
  </>;
}
