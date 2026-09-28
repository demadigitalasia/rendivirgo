"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiFetch, errorMessage } from "@/components/admin/api";
import { Button, Field, TextInput } from "@/components/admin/ui";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!token) {
      setError("This reset link is incomplete. Request a new one.");
      return;
    }
    if (password.length < 12) {
      setError("Use at least 12 characters for the new password.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/reset-password", { json: { token, newPassword: password } });
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rv-login">
      <section className="rv-login__card" aria-labelledby="admin-reset-title">
        <div className="rv-login__brand">RENDI VIRGO</div>
        <h1 id="admin-reset-title" className="rv-login__tagline">Choose a new password</h1>

        {done ? (
          <>
            <p className="rv-login__footer" role="status">
              Password updated. All previous sessions were signed out — sign in with your new password.
            </p>
            <p style={{ marginTop: 12 }}>
              <Link href="/admin/login">Go to sign in</Link>
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
            <Field label="New password" inputId="reset-password">
              <TextInput
                id="reset-password"
                name="newPassword"
                value={password}
                onChange={setPassword}
                type="password"
                required
                autoComplete="new-password"
                placeholder="At least 12 characters"
              />
            </Field>
            <Field label="Confirm new password" inputId="reset-password-confirm">
              <TextInput
                id="reset-password-confirm"
                name="confirmPassword"
                value={confirm}
                onChange={setConfirm}
                type="password"
                required
                autoComplete="new-password"
                placeholder="Repeat the new password"
              />
            </Field>

            {error ? (
              <p className="rv-error-text rv-login__error" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" className="rv-btn--block" loading={loading}>
              {loading ? "Saving…" : "Save new password"}
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
