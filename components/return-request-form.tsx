"use client";

import { useState, type FormEvent } from "react";
import { FilterDropdown } from "@/components/filter-dropdown";
import { useCopy, useLanguage } from "@/components/providers";

type FormStatus = "idle" | "sending" | "success" | "error";

export function ReturnRequestForm() {
  const t = useCopy().returns;
  const { language } = useLanguage();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("Damaged");
  const [details, setDetails] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    if (evidence && evidence.size > 8 * 1024 * 1024) {
      setError(t.evidenceTooLarge);
      setStatus("error");
      return;
    }
    setError("");
    setStatus("sending");
    const body = new FormData();
    body.set("orderNumber", orderNumber.trim());
    body.set("email", email.trim());
    body.set("reason", reason);
    body.set("details", details.trim());
    if (evidence) body.set("evidence", evidence);

    try {
      const response = await fetch("/api/orders/return-requests", { method: "POST", body });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
        const raw = payload?.message;
        setError(language === "id" ? t.error : Array.isArray(raw) ? raw.join(", ") : raw || t.error);
        setStatus("error");
        return;
      }
      setOrderNumber("");
      setEmail("");
      setDetails("");
      setEvidence(null);
      setStatus("success");
    } catch {
      setError(t.error);
      setStatus("error");
    }
  };

  return (
    <>
      <div className="content-page__intro">
        <div className="eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </div>
      <form className="checkout-form" onSubmit={(event) => void submit(event)}>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="return-order-number">{t.orderNumber}</label>
          <input id="return-order-number" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} required autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="return-email">{t.email}</label>
          <input id="return-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="return-reason">{t.reason}</label>
        <FilterDropdown id="return-reason" ariaLabel={t.reason} value={reason} onChange={setReason} options={[
          { value: "Damaged", label: t.damaged },
          { value: "NotAsDescribed", label: t.notAsDescribed },
          { value: "Other", label: t.other },
        ]} />
      </div>
      <div className="field">
        <label htmlFor="return-details">{t.details}</label>
        <textarea id="return-details" value={details} onChange={(event) => setDetails(event.target.value)} required minLength={10} maxLength={3000} rows={5} />
      </div>
      <div className="field">
        <label htmlFor="return-evidence">{t.evidence}</label>
        <input
          id="return-evidence"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          onChange={(event) => setEvidence(event.target.files?.[0] ?? null)}
        />
        <span className="muted">{t.evidenceHint}</span>
      </div>
      <button className="button button--full" type="submit" disabled={status === "sending"}>
        {status === "sending" ? t.submitting : t.submit}
      </button>
      {status === "success" ? <p className="form-status form-status--success" role="status">{t.success}</p> : null}
      {status === "error" ? <p className="form-status form-status--error" role="alert">{error}</p> : null}
      </form>
    </>
  );
}
