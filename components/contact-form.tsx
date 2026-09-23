"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

type FormValues = { name: string; email: string; phone: string; subject: string; body: string };
type Status = { state: "idle" | "sending" | "success" } | { state: "error"; message: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emptyForm: FormValues = { name: "", email: "", phone: "", subject: "", body: "" };

export function ContactForm() {
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
      setValidationError("Please complete your name, email, subject, and message.");
      return;
    }
    if (!emailPattern.test(email)) {
      setValidationError("Please enter a valid email address.");
      return;
    }

    setValidationError("");
    setStatus({ state: "sending" });

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ name, email, phone: values.phone.trim() || undefined, subject, body }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
      if (!response.ok) {
        const raw = payload?.message;
        setStatus({ state: "error", message: Array.isArray(raw) ? raw.join(", ") : (raw ?? "Your message could not be sent. Please try again.") });
        return;
      }
      setValues(emptyForm);
      setStatus({ state: "success" });
    } catch {
      setStatus({ state: "error", message: "Could not reach the store API. Please try again." });
    }
  };

  return (
    <form className="checkout-form" onSubmit={handleSubmit} noValidate>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="contact-name">Name</label>
          <input id="contact-name" name="name" value={values.name} onChange={update("name")} autoComplete="name" required />
        </div>
        <div className="field">
          <label htmlFor="contact-email">Email</label>
          <input id="contact-email" name="email" type="email" value={values.email} onChange={update("email")} autoComplete="email" required />
        </div>
      </div>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="contact-phone">Phone (optional)</label>
          <input id="contact-phone" name="phone" value={values.phone} onChange={update("phone")} autoComplete="tel" />
        </div>
        <div className="field">
          <label htmlFor="contact-subject">Subject</label>
          <input id="contact-subject" name="subject" value={values.subject} onChange={update("subject")} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="contact-body">Message</label>
        <textarea id="contact-body" name="body" value={values.body} onChange={update("body")} required />
      </div>
      <button className="button button--full" type="submit" disabled={status.state === "sending"}>
        {status.state === "sending" ? "Sending…" : "Send message"}
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
          Thank you — your message has been received. We will reply by email shortly.
        </p>
      )}
    </form>
  );
}
