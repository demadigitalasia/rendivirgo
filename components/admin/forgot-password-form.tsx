"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch, errorMessage } from "@/components/admin/api";
import { Button, Field, TextInput } from "@/components/admin/ui";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      setError("Enter the email address of your admin account.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/forgot-password", { json: { email: email.trim() } });
      setSent(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rv-login">
      <section className="rv-login__card" aria-labelledby="admin-forgot-title">
        <div className="rv-login__brand">RENDI VIRGO</div>
        <h1 id="admin-forgot-title" className="rv-login__tagline">Reset password</h1>

        {sent ? (
          <>
            <p className="rv-login__footer" role="status">
              If that email matches an admin account, a reset link is on its way. The link expires in 30 minutes.
            </p>
            <p style={{ marginTop: 12 }}>
              <Link href="/admin/login">Back to sign in</Link>
            </p>
          </>
        ) : (
          <form
            className="rv-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Field label="Admin email" inputId="forgot-email">
              <TextInput
                id="forgot-email"
                name="email"
                value={email}
                onChange={setEmail}
                type="email"
                required
                autoComplete="username"
                placeholder="you@rendivirgo.com"
              />
            </Field>

            {error ? (
              <p className="rv-error-text rv-login__error" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" className="rv-btn--block" loading={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </Button>
            <p className="rv-login__footer">
              <Link href="/admin/login">Back to sign in</Link>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
