"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch, errorMessage } from "@/components/admin/api";
import { Button, Field, TextInput } from "@/components/admin/ui";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

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
    <main className="rv-login">
      <section className="rv-login__card" aria-labelledby="admin-login-title">
        <div className="rv-login__brand">RENDI VIRGO</div>
        <h1 id="admin-login-title" className="rv-login__tagline">Admin workspace</h1>

        <form
          className="rv-stack"
          autoComplete="on"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field label="Email" inputId="admin-email">
            <TextInput
              id="admin-email"
              name="email"
              value={email}
              onChange={setEmail}
              type="email"
              required
              ariaInvalid={Boolean(error)}
              ariaDescribedBy={error ? "admin-login-error" : undefined}
              autoComplete="username"
              placeholder="you@rendivirgo.com"
            />
          </Field>
          <Field label="Password" inputId="admin-password">
            <div className="rv-password-input">
              <TextInput
                id="admin-password"
                name="password"
                value={password}
                onChange={setPassword}
                type={showPassword ? "text" : "password"}
                required
                ariaInvalid={Boolean(error)}
                ariaDescribedBy={error ? "admin-login-error" : undefined}
                autoComplete="current-password"
                placeholder="Your password"
              />
              <button
                className="rv-password-toggle"
                type="button"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </Field>

          {error ? <p id="admin-login-error" className="rv-error-text rv-login__error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p> : null}

          <Button type="submit" variant="primary" className="rv-btn--block" loading={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="rv-login__footer">
          <Link href="/admin/forgot-password">Forgot password?</Link>
          <br />
          Single-admin workspace. Sessions expire automatically.
        </p>
      </section>
    </main>
  );
}
