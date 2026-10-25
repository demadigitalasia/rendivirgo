"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useCopy } from "@/components/providers";

type FormValues = { name: string; email: string; phone: string; subject: string; body: string; website: string };
type Status = { state: "idle" | "sending" | "success" } | { state: "error"; message: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emptyForm: FormValues = { name: "", email: "", phone: "", subject: "", body: "", website: "" };

export function ContactForm() {
  const t = useCopy().contact.form;
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [validationError, setValidationError] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  const update = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = values.name.trim();
    const email = values.email.trim();
    const subject = values.subject.trim();
    const body = values.body.trim();

    if (!name || !email || !subject || !body) {
      setValidationError(t.required);
      return;
    }
    if (name.length < 2 || name.length > 120) {
      setValidationError(t.nameLength);
      return;
    }
    if (!emailPattern.test(email)) {
      setValidationError(t.invalidEmail);
      return;
    }
    if (email.length > 200) {
      setValidationError(t.emailTooLong);
      return;
    }
    if (values.phone.trim().length > 40) {
      setValidationError(t.phoneTooLong);
      return;
    }
    if (subject.length < 2 || subject.length > 200) {
      setValidationError(t.subjectLength);
      return;
    }
    if (body.length < 2 || body.length > 8000) {
      setValidationError(t.messageLength);
      return;
    }

    setValidationError("");
    setStatus({ state: "sending" });

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ name, email, phone: values.phone.trim() || undefined, subject, body, website: values.website }),
      });
      const result = await response.json().catch(() => null) as { ok?: boolean } | null;
      if (!response.ok || result?.ok !== true) {
        setStatus({ state: "error", message: response.status === 429 ? t.tooManyRequests : t.sendError });
        return;
      }
      setValues(emptyForm);
      setStatus({ state: "success" });
    } catch {
      setStatus({ state: "error", message: t.connectionError });
    }
  };

  return (
    <form className="checkout-form" onSubmit={handleSubmit} noValidate>
      <label className="sr-only" aria-hidden="true">
        Website
        <input name="website" value={values.website} onChange={update("website")} tabIndex={-1} autoComplete="off" />
      </label>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="contact-name">{t.name}</label>
          <input id="contact-name" name="name" value={values.name} onChange={update("name")} autoComplete="name" maxLength={120} required />
        </div>
        <div className="field">
          <label htmlFor="contact-email">{t.email}</label>
          <input id="contact-email" name="email" type="email" value={values.email} onChange={update("email")} autoComplete="email" maxLength={200} required />
        </div>
      </div>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="contact-phone">{t.phone}</label>
          <input id="contact-phone" name="phone" type="tel" value={values.phone} onChange={update("phone")} autoComplete="tel" maxLength={40} />
        </div>
        <div className="field">
          <label htmlFor="contact-subject">{t.subject}</label>
          <input id="contact-subject" name="subject" value={values.subject} onChange={update("subject")} maxLength={200} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="contact-body">{t.message}</label>
        <textarea id="contact-body" name="body" value={values.body} onChange={update("body")} maxLength={8000} required />
      </div>
      <button className="button button--full" type="submit" disabled={status.state === "sending"}>
        {status.state === "sending" ? t.sending : t.send}
      </button>
      {validationError && (
        <p className="form-status form-status--error" role="alert">
          {validationError}
        </p>
      )}
      {status.state === "error" && (
        <p className="form-status form-status--error" role="alert">
          {status.message}
        </p>
      )}
      {status.state === "success" && (
        <p className="form-status form-status--success" role="status">
          {t.success}
        </p>
      )}
    </form>
  );
}
