"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useCart, useCopy } from "@/components/providers";
import { LocalizedLink as Link } from "@/components/localized-link";
import { CountryDropdown } from "@/components/country-dropdown";
import { canAccessWholesale, storefrontRoutes } from "@/lib/navigation";
import { OTHER_COUNTRY_VALUE, countryCodeForName, countryNameForCode } from "@/lib/countries";
import { ArrowIcon, ArrowLeftIcon, ArrowUpRightIcon, ChevronRightIcon, ClockIcon, Icon, SparkleIcon } from "@/components/icons";

import { lapidaryRegistrationIntent, safeCustomerReturnPath, wholesaleRegistrationIntent } from "@/lib/customer-return-path";

type AccessMode = "login" | "register" | "verify" | "forgot" | "reset";
type CustomerProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  acceptsMarketing: boolean;
  wholesaleAccess: boolean;
  wholesaleStatus?: "None" | "Pending" | "Approved" | "Rejected";
  wholesaleReviewReason?: string | null;
  address: { line1: string | null; line2: string | null; city: string | null; state: string | null; postalCode: string | null; country: string | null; countryCode: string | null };
};
type AccountOrder = { id: string; orderNumber: string; source: string; status: string; paymentStatus: string; currency: string; total: number; itemCount: number; placedAt: string };
type OrderSummaryStats = { total: number; pendingPayment: number; activeOrders: number };
type OrderDetail = AccountOrder & {
  paymentMethod: string;
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  taxTotal: number;
  shippingName: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingAddress: CustomerProfile["address"] & { name: string };
  items: Array<{ name: string; sku: string; quantity: number; unitPrice: number; lineTotal: number; imageUrl: string | null }>;
};

function customerApiError(payload: unknown, status: number): string {
  const body = payload && typeof payload === "object" ? payload as { message?: unknown } : {};
  const messages = Array.isArray(body.message)
    ? body.message.map((message) => String(message))
    : typeof body.message === "string" ? [body.message] : [];
  const combined = messages.join(" ").toLowerCase();
  const invalidName = combined.includes("name must") || combined.includes("enter your name");
  const invalidPassword = combined.includes("password must");

  if (invalidName && invalidPassword) return "Enter your name and a password between 12 and 200 characters.";
  if (invalidName) return "Enter your name (up to 200 characters).";
  if (invalidPassword) return "Your password must be between 12 and 200 characters.";
  if (combined.includes("token must") || combined.includes("verification link is invalid") || combined.includes("verification link has expired")) {
    return "This verification link is invalid or has expired. Request a new one.";
  }
  if (combined.includes("verify your email before signing in")) return "Please verify your email before signing in.";
  if (combined.includes("invalid email or password")) return "Email or password is incorrect.";
  if (combined.includes("email must")) return "Enter a valid email address.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status >= 500) return "We couldn't complete your request right now. Please try again shortly.";
  return "Please check your details and try again.";
}

function customerErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TypeError) return "We couldn't connect to the server. Please try again shortly.";
  return error instanceof Error ? error.message : fallback;
}

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
async function sendJson(path: string, data: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept-language": document.documentElement.lang.toLowerCase().startsWith("id") ? "id-ID" : "en-GB",
    },
    credentials: "same-origin",
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(customerApiError(payload, response.status));
  return payload;
}

export function CustomerAccess({ mode, token = "" }: { mode: AccessMode; token?: string }) {
  const router = useRouter();
  const [returnPath, setReturnPath] = useState("/account");
  useEffect(() => {
    setReturnPath(safeCustomerReturnPath(new URLSearchParams(window.location.search).get("next")));
  }, []);
  const accountLink = (path: string) => returnPath === "/account" ? path : `${path}?next=${encodeURIComponent(returnPath)}`;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (!verificationRequested || !resendAfter) return;
    const updateCountdown = () => setResendCountdown(Math.max(0, Math.ceil((resendAfter - Date.now()) / 1000)));
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [verificationRequested, resendAfter]);

  const verifyEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    if (password !== confirmPassword) {
      setError("The passwords do not match. Enter the same password in both fields.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await sendJson("/api/customer-auth/verify-email", { token, name, password });
      setVerified(true);
      setMessage("Email verified and account set up. You can now sign in.");
      setName("");
      setPassword("");
      setConfirmPassword("");
      window.history.replaceState(window.history.state, "", window.location.pathname);
    } catch (caught) {
      setError(customerErrorMessage(caught, "We couldn't verify your email."));
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await sendJson("/api/customer-auth/resend-verification", { email, next: wholesaleRegistrationIntent(returnPath) ?? lapidaryRegistrationIntent(returnPath) });
      setResendAfter(Date.now() + 2 * 60_000);
      setMessage("If this email has a pending registration, we'll send another setup link shortly.");
    } catch (caught) {
      setError(customerErrorMessage(caught, "We couldn't request another email."));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "register") {
        await sendJson("/api/customer-auth/register", { email, next: wholesaleRegistrationIntent(returnPath) ?? lapidaryRegistrationIntent(returnPath) });
        setVerificationRequested(true);
        setResendAfter(Date.now() + 2 * 60_000);
        setMessage("If this email can be registered, we'll send a setup link shortly. Check your inbox and spam folder. You can request another email after two minutes.");
      } else if (mode === "login") {
        await sendJson("/api/customer-auth/login", { email, password });
        const requestedPath = new URLSearchParams(window.location.search).get("next");
        const safePath = safeCustomerReturnPath(requestedPath);
        router.replace(safePath);
        router.refresh();
      } else if (mode === "forgot") {
        await sendJson("/api/customer-auth/forgot-password", { email });
        setMessage("If a verified account uses this email, we’ll attempt to send a password reset link. If you recently requested one, use that link; it remains valid for 30 minutes.");
      } else if (mode === "reset") {
        await sendJson("/api/customer-auth/reset-password", { token, newPassword: password });
        setMessage("Password updated. Sign in with your new password.");
      }
    } catch (caught) {
      setError(customerErrorMessage(caught, "We couldn't complete your request."));
    } finally {
      if (mode === "reset" && token) {
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }
      setBusy(false);
    }
  };

  const title = mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Choose a new password" : mode === "verify" ? verified ? "Account ready" : "Finish setting up your account" : "Sign in";
  const description = mode === "login"
    ? "Welcome back. Your orders, tracking, and collection details are waiting for you."
    : mode === "register"
      ? "Enter your email and we’ll send a setup link so you can choose your name and password."
      : mode === "verify"
        ? verified
          ? "Your email is confirmed and your customer account is ready. Sign in to continue."
          : "Confirm you own this email, then choose your name and password to finish setting up your customer account."
        : mode === "reset"
          ? "Choose a new password for your customer account."
          : "Enter your email and we’ll attempt to send a secure reset link if an account is registered.";
  return (
    <section className="customer-account customer-access">
      <div className="customer-access__panel">
        <div className={`customer-access__content${mode === "verify" ? " is-verify" : ""}`}>
          <p className="customer-account__eyebrow"><span className="customer-access__status-dot" /> CUSTOMER ACCOUNT</p>
          <h1>{title}</h1>
          <p className="customer-access__description">{description}</p>
          {mode === "verify" ? (
            verified ? (
              <div className="customer-access__success">
                <p className="customer-access__notice" role="status">{message}</p>
                <Link className="button button--primary" href={accountLink("/account/login")}>Sign in now<ArrowIcon size={17} /></Link>
              </div>
            ) : <>
              <p className="customer-access__notice" role={error ? "alert" : "status"}>{busy ? "Setting up your account…" : error || message || "Choose your account name and password to continue."}</p>
              {token ? (
                <form className="customer-account__form" onSubmit={(event) => void verifyEmail(event)}>
                  <label>Name<input autoComplete="name" maxLength={200} required value={name} onChange={(event) => setName(event.target.value)} /></label>
                  <div className="customer-access__password-control">
                    <label htmlFor="customer-password">Password</label>
                    <span className="customer-access__password-field">
                      <input id="customer-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={200} required value={password} onChange={(event) => setPassword(event.target.value)} />
                      <button
                        className="customer-access__password-toggle"
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        <Icon name={showPassword ? "eye" : "eyeOff"} size={18} />
                      </button>
                    </span>
                  </div>
                  <div className="customer-access__password-control">
                    <label htmlFor="customer-password-confirm">Confirm password</label>
                    <span className="customer-access__password-field">
                      <input id="customer-password-confirm" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={200} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                      <button
                        className="customer-access__password-toggle"
                        type="button"
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        aria-pressed={showConfirmPassword}
                        onClick={() => setShowConfirmPassword((visible) => !visible)}
                      >
                        <Icon name={showConfirmPassword ? "eye" : "eyeOff"} size={18} />
                      </button>
                    </span>
                  </div>
                  <button className="button button--primary" disabled={busy}>{busy ? "Please wait…" : "Verify email & create account"}<ArrowIcon size={17} /></button>
                </form>
              ) : null}
              {verified ? <Link className="button button--primary customer-access__continue" href={accountLink("/account/login")}>Sign in now<ArrowIcon size={17} /></Link> : null}
              {!token && !verified ? <p className="customer-account__error" role="alert">The verification link is missing. Register again to request a new setup link.</p> : null}
            </>
          ) : mode === "register" && verificationRequested ? (
            <div className="customer-access__pending-registration">
              <p className="customer-access__notice" role={error ? "alert" : "status"}>{busy ? "Sending…" : error || message}</p>
              <p className="customer-access__pending-email">Setup link requested for <strong>{email}</strong></p>
              <button className="customer-access__resend" type="button" disabled={busy || resendCountdown > 0} onClick={() => void resendVerification()}>
                {busy ? "Sending…" : resendCountdown > 0 ? `Didn't receive it? Request another in ${formatCountdown(resendCountdown)}` : "Resend setup email"}
              </button>
              <button
                className="customer-access__resend customer-access__change-email"
                type="button"
                onClick={() => {
                  setVerificationRequested(false);
                  setEmail("");
                  setResendAfter(0);
                  setResendCountdown(0);
                  setMessage("");
                  setError("");
                }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form className="customer-account__form" onSubmit={(event) => void submit(event)}>
              {mode !== "reset" ? <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label> : null}
              {mode === "login" || mode === "reset" ? (
                <div className="customer-access__password-control">
                  <label htmlFor="customer-password">Password</label>
                  <span className="customer-access__password-field">
                    <input id="customer-password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "reset" ? 12 : 1} maxLength={200} required value={password} onChange={(event) => setPassword(event.target.value)} />
                    <button
                      className="customer-access__password-toggle"
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      <Icon name={showPassword ? "eye" : "eyeOff"} size={18} />
                    </button>
                  </span>
                </div>
              ) : null}
              {error ? <p className="customer-account__error" role="alert">{error}</p> : null}
              {message ? <p className="customer-account__message" role="status">{message}</p> : null}
              <button className="button button--primary" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Update password" : "Sign in"}<ArrowIcon size={17} /></button>
            </form>
          )}
          <nav className="customer-access__links" aria-label="Account options">
            {mode === "login" ? <Link href={accountLink("/account/forgot-password")}>Forgot password?</Link> : !verified ? <Link href={accountLink("/account/login")}>Back to sign in</Link> : null}
            {mode === "register" ? <span>Already have an account? <Link href={accountLink("/account/login")}>Sign in</Link></span> : !verified ? <span>New to RENDI VIRGO? <Link href={accountLink("/account/register")}>Create account</Link></span> : null}
          </nav>
          <Link className="customer-access__guest" href="/orders">Looking for a past guest order? <span>View order history <ArrowIcon size={15} /></span></Link>
        </div>
      </div>
    </section>
  );
}

export function CustomerDashboard({ ordersOnly = false }: { ordersOnly?: boolean }) {
  const router = useRouter();
  const { clearCart } = useCart();
  const t = useCopy();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [profileCountryCode, setProfileCountryCode] = useState("");
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [summary, setSummary] = useState<OrderSummaryStats>({ total: 0, pendingPayment: 0, activeOrders: 0 });
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [meResponse, orderResponse] = await Promise.all([
      fetch("/api/customer-account/me", { credentials: "same-origin", cache: "no-store" }),
      fetch(`/api/customer-account/orders?page=${page}`, { credentials: "same-origin", cache: "no-store" }),
    ]);
    if (meResponse.status === 401 || meResponse.status === 403) {
      router.replace("/account/login?next=%2Faccount");
      return;
    }
    const me = await meResponse.json().catch(() => ({}));
    const list = await orderResponse.json().catch(() => ({}));
    if (!meResponse.ok || !orderResponse.ok) throw new Error(me?.message || "Could not load your account");
    setProfile(me);
    setProfileCountryCode(
      countryCodeForName(me.address?.countryCode) ??
      countryCodeForName(me.address?.country) ??
      (me.address?.country ? OTHER_COUNTRY_VALUE : ""),
    );
    setOrders(Array.isArray(list?.orders) ? list.orders : []);
    setSummary(list?.summary ?? { total: list?.total ?? 0, pendingPayment: 0, activeOrders: 0 });
    setPageCount(Math.max(1, Number(list?.pageCount) || 1));
  };

  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load your account")).finally(() => setBusy(false));
  }, [page]);

  const updateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const submittedCountryCode = String(form.get("countryCode") ?? "");
      const countryIsOther = submittedCountryCode === OTHER_COUNTRY_VALUE;
      const response = await fetch("/api/customer-account/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"), phone: form.get("phone") || null,
          addressLine1: form.get("addressLine1") || null, addressLine2: form.get("addressLine2") || null,
          city: form.get("city") || null, state: form.get("state") || null,
          postalCode: form.get("postalCode") || null,
          country: countryIsOther ? form.get("country") || null : countryNameForCode(submittedCountryCode, "en"),
          countryCode: countryIsOther ? null : submittedCountryCode || null,
          acceptsMarketing: form.get("acceptsMarketing") === "on",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Profile could not be updated");
      setProfile(payload);
      setProfileCountryCode(submittedCountryCode);
      setMessage("Profile updated. Changes apply to future orders.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Profile could not be updated");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    try {
      await sendJson("/api/customer-account/logout", {});
    } catch {
      // Clear local Wholesale pricing even when the server session already expired.
    } finally {
      clearCart("wholesale");
      router.replace("/account/login");
      router.refresh();
    }
  };

  if (busy) return <section className="customer-account"><p>Loading your account…</p></section>;
  if (!profile) return <section className="customer-account"><h1>Customer account</h1><p role="alert">{error || "Sign in to continue."}</p><Link href="/account/login">Sign in</Link></section>;
  const customerNavigation = t.customerNavigation;
  const wholesaleEnabled = canAccessWholesale(profile);

  return (
    <section className="customer-account customer-dashboard">
      <aside className="customer-dashboard__sidebar">
        <div className="customer-dashboard__identity">
          <span className="customer-dashboard__avatar">
            {profile.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word.charAt(0)).join("").toUpperCase() || "R"}
          </span>
          <span className="customer-dashboard__identity-copy"><strong>{profile.name}</strong><small>{profile.email}</small></span>
        </div>
        <p className="customer-dashboard__nav-label">{customerNavigation.menu}</p>
        <nav className="customer-dashboard__nav" aria-label={customerNavigation.menu}>
          <Link href={storefrontRoutes.account} className={`customer-dashboard__nav-link${ordersOnly ? "" : " is-active"}`} aria-current={ordersOnly ? undefined : "page"}>
            <Icon name="dashboard" size={19} /><span>{customerNavigation.overview}</span><span className="customer-dashboard__nav-arrow"><ChevronRightIcon size={16} /></span>
          </Link>
          <Link href={storefrontRoutes.accountOrders} className={`customer-dashboard__nav-link${ordersOnly ? " is-active" : ""}`} aria-current={ordersOnly ? "page" : undefined}>
            <Icon name="fileText" size={19} /><span>{customerNavigation.orders}</span><span className="customer-dashboard__nav-arrow"><ChevronRightIcon size={16} /></span>
          </Link>
          <Link href="/account/lapidary" className="customer-dashboard__nav-link">
            <Icon name="gem" size={19} /><span>Lapidary projects</span><span className="customer-dashboard__nav-arrow"><ChevronRightIcon size={16} /></span>
          </Link>
          <Link href={storefrontRoutes.wholesaleCatalog} className="customer-dashboard__nav-link">
            <Icon name="gem" size={19} /><span>{customerNavigation.wholesale}</span><span className="customer-dashboard__nav-arrow"><ChevronRightIcon size={16} /></span>
          </Link>
        </nav>
        <div className="customer-dashboard__account-status">
          <span className="customer-dashboard__status-mark" />
          <span><small>{customerNavigation.accountType}</small><strong>{wholesaleEnabled ? customerNavigation.wholesaleApproved : customerNavigation.retailCustomer}</strong></span>
        </div>
        <button className="customer-dashboard__signout" onClick={() => void logout()}>
          <Icon name="logOut" size={19} /><span>{customerNavigation.signOut}</span>
        </button>
      </aside>

      <div className="customer-dashboard__content">
        <header className="customer-dashboard__topbar">
          <div>
            <p className="customer-dashboard__eyebrow">CUSTOMER DASHBOARD</p>
            <h1>{ordersOnly ? "Order history" : `Welcome back, ${profile.name.split(/\s+/)[0]}`}</h1>
            <p>{ordersOnly ? "Review your purchases, payment status, and delivery progress." : "Your orders, profile, and collection details in one place."}</p>
          </div>
          <span className={`customer-dashboard__member-badge${profile.wholesaleAccess ? " is-wholesale" : ""}`}>
            <span />{profile.wholesaleAccess ? "WHOLESALE MEMBER" : "CUSTOMER ACCOUNT"}
          </span>
        </header>

        {!ordersOnly ? (
          <>
            <div className="customer-account__stats customer-dashboard__stats">
              <div className="customer-dashboard__stat-card"><span className="customer-dashboard__stat-icon"><Icon name="fileText" size={18} /></span><strong>{summary.total}</strong><span>All orders</span><small>Orders linked to your account</small></div>
              <div className="customer-dashboard__stat-card"><span className="customer-dashboard__stat-icon is-amber"><ClockIcon size={18} /></span><strong>{summary.pendingPayment}</strong><span>Awaiting payment</span><small>Orders that need your attention</small></div>
              <div className="customer-dashboard__stat-card"><span className="customer-dashboard__stat-icon is-sage"><ArrowUpRightIcon size={18} /></span><strong>{summary.activeOrders}</strong><span>In progress</span><small>Being prepared or delivered</small></div>
            </div>

            {profile.wholesaleAccess ? (
              <Link className="customer-dashboard__wholesale-banner" href="/wholesale/finished">
                <span className="customer-dashboard__wholesale-icon"><Icon name="gem" /></span>
                <span><small>WHOLESALE ACCESS</small><strong>Your private catalog is ready</strong><em>Browse approved wholesale products and pricing.</em></span>
                <span className="customer-dashboard__wholesale-arrow"><ArrowIcon size={18} /></span>
              </Link>
            ) : (
              <Link className="customer-dashboard__wholesale-banner" href={storefrontRoutes.wholesaleCatalog}>
                <span className="customer-dashboard__wholesale-icon"><Icon name="gem" /></span>
                <span><small>FINISHED PRODUCTS WHOLESALE</small><strong>{profile.wholesaleStatus === "Pending" ? "Your request is under review" : profile.wholesaleStatus === "Rejected" ? "Review your wholesale application" : "Apply for wholesale access"}</strong><em>{profile.wholesaleStatus === "Pending" ? "We will email you when a decision is ready." : profile.wholesaleStatus === "Rejected" ? profile.wholesaleReviewReason || "View the decision and update your business details." : "Tell us about your business to request private catalog access."}</em></span>
                <span className="customer-dashboard__wholesale-arrow"><ArrowIcon size={18} /></span>
              </Link>
            )}

            <div className="customer-dashboard__card customer-dashboard__profile-card" id="profile-details">
              <div className="customer-dashboard__card-heading">
                <span className="customer-dashboard__section-icon"><SparkleIcon size={18} /></span>
                <span><small>PERSONAL DETAILS</small><h2>Profile information</h2><p>Keep your contact and delivery details up to date.</p></span>
              </div>
              <form className="customer-account__form customer-dashboard__profile-form" onSubmit={(event) => void updateProfile(event)}>
                <div className="customer-account__grid customer-dashboard__profile-grid">
                  <label>Name<input name="name" autoComplete="name" required defaultValue={profile.name} /></label>
                  <label>Email<input type="email" value={profile.email} disabled readOnly /></label>
                  <label>Phone<input name="phone" autoComplete="tel" defaultValue={profile.phone ?? ""} /></label>
                  <label>Address<input name="addressLine1" autoComplete="address-line1" defaultValue={profile.address.line1 ?? ""} /></label>
                  <label>Address line 2<input name="addressLine2" autoComplete="address-line2" defaultValue={profile.address.line2 ?? ""} /></label>
                  <label>City<input name="city" autoComplete="address-level2" defaultValue={profile.address.city ?? ""} /></label>
                  <label>State / Province<input name="state" autoComplete="address-level1" defaultValue={profile.address.state ?? ""} /></label>
                  <label>Postal code<input name="postalCode" autoComplete="postal-code" defaultValue={profile.address.postalCode ?? ""} /></label>
                  <div>
                    <label htmlFor="customer-profile-country">Country</label>
                    <CountryDropdown
                      id="customer-profile-country"
                      value={profileCountryCode}
                      onChange={setProfileCountryCode}
                      includeOther
                      name="countryCode"
                      placeholder="Select a country"
                      ariaLabel="Country"
                    />
                    {profileCountryCode === OTHER_COUNTRY_VALUE ? (
                      <label>Country name<input name="country" autoComplete="country-name" defaultValue={profile.address.country ?? ""} /></label>
                    ) : (
                      <input type="hidden" name="country" value={countryNameForCode(profileCountryCode, "en") ?? ""} readOnly />
                    )}
                  </div>
                </div>
                <label className="customer-account__checkbox customer-dashboard__marketing"><input name="acceptsMarketing" type="checkbox" defaultChecked={profile.acceptsMarketing} /> I agree to receive marketing emails</label>
                {message ? <p className="customer-account__message" role="status">{message}</p> : null}
                {error ? <p className="customer-account__error" role="alert">{error}</p> : null}
                <button className="button button--primary customer-dashboard__save-button" disabled={saving}>{saving ? "Saving…" : "Save profile"}<ArrowIcon size={17} /></button>
              </form>
            </div>
          </>
        ) : null}

        <section className="customer-account__orders customer-dashboard__card customer-dashboard__orders">
          <div className="customer-dashboard__orders-heading">
            <span className="customer-dashboard__section-icon"><Icon name="fileText" size={18} /></span>
            <span><small>{ordersOnly ? "YOUR PURCHASES" : "ORDER ACTIVITY"}</small><h2>{ordersOnly ? "All orders" : "Recent orders"}</h2></span>
            {!ordersOnly ? <Link href="/account/orders">View all <ArrowIcon size={16} /></Link> : null}
          </div>
          {orders.length ? orders.map((order) => (
            <Link className="customer-account__order customer-dashboard__order" key={order.id} href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}>
              <span className="customer-dashboard__order-identity"><span className="customer-dashboard__order-icon"><Icon name="package" size={18} /></span><span><strong>{order.orderNumber}</strong><small>Placed {new Date(order.placedAt).toLocaleDateString()}</small></span></span>
              <span className="customer-dashboard__order-total"><strong>{order.currency} {Number(order.total).toFixed(2)}</strong><small>{order.itemCount} items · {order.status} · {order.paymentStatus}</small></span>
              <span className="customer-dashboard__order-arrow"><ArrowUpRightIcon size={17} /></span>
            </Link>
          )) : (
            <div className="customer-dashboard__empty">
              <span className="customer-dashboard__empty-icon"><Icon name="package" size={18} /></span>
              <span><strong>No orders yet</strong><small>Orders placed with this email will appear here.</small></span>
              <Link href="/shop">Explore the collection <ArrowIcon size={16} /></Link>
            </div>
          )}
          {ordersOnly && pageCount > 1 ? <div className="customer-account__pagination customer-dashboard__pagination">
            <button className="button button--outline button--compact" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ArrowLeftIcon size={15} /> Previous</button>
            <span>Page {page} of {pageCount}</span>
            <button className="button button--outline button--compact" type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next <ChevronRightIcon size={15} /></button>
          </div> : null}
        </section>
      </div>
    </section>
  );
}

export function CustomerOrderPage({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch(`/api/customer-account/orders/${encodeURIComponent(orderNumber)}`, { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) { router.replace("/account/login"); return; }
        if (!response.ok) throw new Error(payload?.message || "Order not found");
        setOrder(payload);
      }).catch((caught) => setError(caught instanceof Error ? caught.message : "Order not found"));
  }, [orderNumber, router]);

  if (error) return <section className="customer-account"><h1>Order</h1><p role="alert">{error}</p><Link href="/account/orders">Back to orders</Link></section>;
  if (!order) return <section className="customer-account"><p>Loading order…</p></section>;
  return (
    <section className="customer-account customer-order-page">
      <header className="customer-order-page__header">
        <div><p className="customer-account__eyebrow">ORDER DETAILS</p><h1>{order.orderNumber}</h1><p>Placed {new Date(order.placedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p></div>
        <Link href="/account/orders"><ArrowLeftIcon size={15} /> Back to orders</Link>
      </header>

      <section className="customer-order-page__status" aria-label="Order status">
        <div><span>Order status</span><strong className="customer-order-page__status-badge">{order.status}</strong></div>
        <div><span>Payment</span><strong>{order.paymentStatus} · {order.paymentMethod}</strong></div>
        {order.trackingUrl ? <a href={order.trackingUrl} rel="noreferrer" target="_blank">Track shipment {order.trackingNumber ? `· ${order.trackingNumber}` : ""}<ArrowUpRightIcon size={15} /></a> : order.trackingNumber ? <div><span>Tracking number</span><strong>{order.trackingNumber}</strong></div> : null}
      </section>

      <div className="customer-order-page__layout">
        <section className="customer-order-page__card customer-order-page__items">
          <div className="customer-order-page__card-heading"><div><p className="customer-account__eyebrow">YOUR PURCHASE</p><h2>Items in this order</h2></div><span>{order.itemCount} {order.itemCount === 1 ? "item" : "items"}</span></div>
          {order.items.map((item, index) => <article className="customer-order-page__item" key={`${item.sku}:${index}`}>
            {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className="customer-order-page__item-placeholder"><Icon name="package" size={20} /></span>}
            <div className="customer-order-page__item-copy"><h3>{item.name}</h3><p>SKU {item.sku}</p><small>Qty {item.quantity} · {order.currency} {Number(item.unitPrice).toFixed(2)} each</small></div>
            <strong>{order.currency} {Number(item.lineTotal).toFixed(2)}</strong>
          </article>)}
        </section>

        <aside className="customer-order-page__side">
          <section className="customer-order-page__card customer-order-page__shipping">
            <div className="customer-order-page__card-heading"><div><p className="customer-account__eyebrow">DELIVERY</p><h2>Shipping address</h2></div><Icon name="package" size={18} /></div>
            <address>{order.shippingAddress.name}<br />{order.shippingAddress.line1}{order.shippingAddress.line2 ? <><br />{order.shippingAddress.line2}</> : null}<br />{[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode].filter(Boolean).join(", ")}<br />{order.shippingAddress.country}</address>
            {order.carrier || order.trackingNumber ? <p className="customer-order-page__carrier">{order.carrier ? `Carrier · ${order.carrier}` : "Shipment tracking"}{order.trackingNumber ? ` · ${order.trackingNumber}` : ""}</p> : null}
          </section>
          <section className="customer-order-page__card customer-order-page__totals">
            <div className="customer-order-page__card-heading"><div><p className="customer-account__eyebrow">PAYMENT SUMMARY</p><h2>Order total</h2></div></div>
            <dl><div><dt>Subtotal</dt><dd>{order.currency} {Number(order.subtotal).toFixed(2)}</dd></div><div><dt>Shipping</dt><dd>{order.currency} {Number(order.shippingCost).toFixed(2)}</dd></div><div><dt>Discount</dt><dd>− {order.currency} {Number(order.discountTotal).toFixed(2)}</dd></div>{order.taxTotal > 0 ? <div><dt>Tax</dt><dd>{order.currency} {Number(order.taxTotal).toFixed(2)}</dd></div> : null}<div className="customer-order-page__grand-total"><dt>Total paid</dt><dd>{order.currency} {Number(order.total).toFixed(2)}</dd></div></dl>
          </section>
        </aside>
      </div>
    </section>
  );
}
