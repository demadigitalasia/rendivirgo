"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiFetch, errorMessage } from "@/components/admin/api";
import { Button, Field, TextInput } from "@/components/admin/ui";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/login", { json: { email: email.trim(), password } });
      const from = searchParams.get("from");
      router.push(from && from.startsWith("/admin") ? from : "/admin");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rv-login">
      <div className="rv-login__card">
        <div className="rv-login__brand">RENDI VIRGO</div>
        <p className="rv-login__tagline">Admin workspace</p>

        <form
          className="rv-stack"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field label="Email">
            <TextInput
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="username"
              placeholder="you@rendivirgo.com"
            />
          </Field>
          <Field label="Password">
            <TextInput
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
            />
          </Field>

          {error ? <p className="rv-error-text">{error}</p> : null}

          <Button type="submit" variant="primary" className="rv-btn--block" loading={loading}>
            Sign in
          </Button>
        </form>

        <p className="rv-login__footer">Single-admin workspace. Sessions expire automatically.</p>
      </div>
    </div>
  );
}
