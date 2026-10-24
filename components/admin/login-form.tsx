"use client";

import Image from "next/image";
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
    <main className="rv-admin-login">
      <section className="rv-admin-login__story" aria-label="RENDI VIRGO founders">
        <div className="rv-admin-login__story-top">
          <Image
            className="rv-admin-login__brand-mark"
            src="/brand/rendi-virgo-primary.webp"
            alt="RENDI VIRGO"
            width={780}
            height={260}
            sizes="220px"
            priority
          />
          <span className="rv-admin-login__workspace-tag"><span />Private workspace</span>
        </div>

        <div className="rv-admin-login__intro">
          <span className="rv-admin-login__eyebrow">A considered eye for natural stone</span>
          <h2>From Indonesia,<br /><em>with intention.</em></h2>
          <p>Every detail, collection, and order comes together here.</p>
        </div>

        <div className="rv-admin-login__founders" aria-label="The people behind RENDI VIRGO">
          <article className="rv-admin-login__founder rv-admin-login__founder--rendi">
            <div className="rv-admin-login__portrait">
              <Image
                src="/images/rendi-virgo-owner-cutout.png"
                alt="Rendi Virgo, founder of RENDI VIRGO"
                fill
                sizes="(max-width: 900px) 44vw, 360px"
                priority
                unoptimized
              />
            </div>
            <div className="rv-admin-login__founder-caption">
              <span>Founder &amp; curator</span>
              <strong>Rendi Virgo</strong>
            </div>
          </article>
          <article className="rv-admin-login__founder rv-admin-login__founder--pajar">
            <div className="rv-admin-login__portrait">
              <Image
                src="/images/pajar-agung-owner-cutout.png"
                alt="Pajar Agung, co-owner of RENDI VIRGO"
                fill
                sizes="(max-width: 900px) 44vw, 360px"
                priority
                unoptimized
              />
            </div>
            <div className="rv-admin-login__founder-caption">
              <span>Co-founder</span>
              <strong>Pajar Agung</strong>
            </div>
          </article>
        </div>

        <div className="rv-admin-login__story-footer">
          <span>RENDI VIRGO</span>
          <span>Selected in Indonesia · Shared worldwide</span>
        </div>
      </section>

      <section className="rv-admin-login__panel" aria-labelledby="admin-login-title">
        <div className="rv-admin-login__form-wrap">
          <div className="rv-admin-login__form-heading">
            <span className="rv-admin-login__eyebrow">Admin workspace</span>
            <h1 id="admin-login-title">Welcome back<span>.</span></h1>
            <p>Sign in to manage the RENDI VIRGO collection.</p>
          </div>

          <form
            className="rv-stack rv-admin-login__form"
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

            <Button type="submit" variant="primary" className="rv-btn--block rv-admin-login__submit" loading={loading}>
              <span>{loading ? "Signing in…" : "Continue to dashboard"}</span>
              {!loading ? <span className="rv-admin-login__submit-arrow" aria-hidden="true">→</span> : null}
            </Button>
          </form>

          <div className="rv-admin-login__help-row">
            <Link href="/admin/forgot-password">Forgot password?</Link>
            <span><i aria-hidden="true" /> Secure admin access</span>
          </div>
          <p className="rv-admin-login__session-note">This is a private workspace. Your session expires automatically.</p>
        </div>
        <div className="rv-admin-login__panel-footer"><span>© RENDI VIRGO</span><span>Indonesia · Worldwide</span></div>
      </section>
    </main>
  );
}
