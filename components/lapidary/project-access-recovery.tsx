"use client";

import { useState } from "react";

type Props = {
  initialRequestNumber?: string;
  initialEmail?: string;
  compact?: boolean;
};

export function LapidaryProjectAccessRecovery({ initialRequestNumber = "", initialEmail = "", compact = false }: Props) {
  const [requestNumber, setRequestNumber] = useState(initialRequestNumber);
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    setSent(false);
    try {
      const response = await fetch("/api/lapidary/requests/access-link", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ requestNumber: requestNumber.trim().toUpperCase(), email: email.trim() }),
      });
      await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429) throw new Error("Too many requests. Wait a few minutes before trying again.");
        throw new Error("We could not process the request right now. Please try again shortly.");
      }
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not process the request right now. Please try again shortly.");
    } finally {
      setSending(false);
    }
  }

  return <section className={`lapidary-access-recovery${compact ? " is-compact" : ""}`} aria-labelledby="lapidary-access-recovery-title">
    <div>
      <h2 id="lapidary-access-recovery-title">Need a new project link?</h2>
      <p>Enter the project reference and the email address used for the request. If they match an eligible project, we’ll email a secure sign-in link.</p>
    </div>
    <form onSubmit={submit}>
      <label>Project reference<input required maxLength={32} pattern="LR-[0-9]{8}-[0-9]{4,}" autoComplete="off" placeholder="LR-20261026-0001" value={requestNumber} onChange={(event) => setRequestNumber(event.target.value.toUpperCase())} /></label>
      <label>Request email<input required type="email" maxLength={200} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      {error ? <p className="lapidary-access-recovery__error" role="alert">{error}</p> : null}
      {sent ? <p className="lapidary-access-recovery__success" role="status">If the details match an eligible request, a secure project link will arrive by email. Check your inbox and spam folder.</p> : null}
      <button type="submit" disabled={sending}>{sending ? "Sending…" : "Email my project link"}</button>
    </form>
  </section>;
}
