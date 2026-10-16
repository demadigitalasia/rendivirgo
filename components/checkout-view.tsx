"use client";

import Link from "@/components/localized-link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart, useCopy, useLanguage } from "@/components/providers";
import { formatUSD } from "@/lib/catalog";
import { CheckoutOrderSummary } from "@/components/checkout/order-summary";
import { CheckoutPaymentResult } from "@/components/checkout/payment-result";
import { CheckoutPriceReview } from "@/components/checkout/price-review";
import type { CheckoutPriceQuote, Discount, PaymentResult } from "@/components/checkout/types";
import { usePaymentAvailability } from "@/components/checkout/use-payment-availability";
import { useShippingQuote } from "@/components/checkout/use-shipping-quote";
import {
  checkoutRequest,
  clearCheckoutAttempt,
  hasCheckoutAttempt,
  readLastOrder,
  recoverCheckoutAttempt,
  writeLastOrder,
  type StoredOrder,
} from "@/lib/checkout-recovery";

const countries: Array<{ name: string; code: string }> = [
  { name: "United States", code: "US" },
  { name: "Canada", code: "CA" },
  { name: "United Kingdom", code: "GB" },
  { name: "Ireland", code: "IE" },
  { name: "Germany", code: "DE" },
  { name: "France", code: "FR" },
  { name: "Netherlands", code: "NL" },
  { name: "Belgium", code: "BE" },
  { name: "Spain", code: "ES" },
  { name: "Portugal", code: "PT" },
  { name: "Italy", code: "IT" },
  { name: "Switzerland", code: "CH" },
  { name: "Austria", code: "AT" },
  { name: "Sweden", code: "SE" },
  { name: "Norway", code: "NO" },
  { name: "Denmark", code: "DK" },
  { name: "Finland", code: "FI" },
  { name: "Poland", code: "PL" },
  { name: "Czech Republic", code: "CZ" },
  { name: "Greece", code: "GR" },
  { name: "Turkey", code: "TR" },
  { name: "United Arab Emirates", code: "AE" },
  { name: "Saudi Arabia", code: "SA" },
  { name: "India", code: "IN" },
  { name: "Singapore", code: "SG" },
  { name: "Malaysia", code: "MY" },
  { name: "Thailand", code: "TH" },
  { name: "Vietnam", code: "VN" },
  { name: "Philippines", code: "PH" },
  { name: "Japan", code: "JP" },
  { name: "South Korea", code: "KR" },
  { name: "China", code: "CN" },
  { name: "Hong Kong", code: "HK" },
  { name: "Taiwan", code: "TW" },
  { name: "Australia", code: "AU" },
  { name: "New Zealand", code: "NZ" },
  { name: "Brazil", code: "BR" },
  { name: "Argentina", code: "AR" },
  { name: "Chile", code: "CL" },
  { name: "Mexico", code: "MX" },
  { name: "South Africa", code: "ZA" },
  { name: "Egypt", code: "EG" },
  { name: "Indonesia", code: "ID" },
  { name: "Other", code: "" },
];

const CHECKOUT_DRAFT_KEY = "rv.checkoutDraft";

export function CheckoutView() {
  const t = useCopy();
  const { language } = useLanguage();
  const countryNames = useMemo(
    () => new Intl.DisplayNames([language === "id" ? "id-ID" : "en-GB"], { type: "region" }),
    [language],
  );
  const searchParams = useSearchParams();
  const { lines, hydrated: cartHydrated, subtotal, totalWeight, clearCart } = useCart();

  const [country, setCountry] = useState("United States");
  const [otherCountryName, setOtherCountryName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [priceReview, setPriceReview] = useState<CheckoutPriceQuote | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<"waiting" | "checking" | "done" | "error">("waiting");
  const handledReturn = useRef(false);
  const countryCode = useMemo(() => countries.find((item) => item.name === country)?.code ?? "", [country]);
  const hasFragile = lines.some((line) => line.fragile);
  const hasOversized = lines.some((line) => line.shipping.shippingClass === "Oversized");
  const {
    quote,
    quoteStatus,
    selectedRateId,
    setSelectedRateId,
    selectedOption,
    reloadShippingQuote: loadQuote,
  } = useShippingQuote({
    itemCount: lines.length,
    totalWeight,
    subtotal,
    countryCode,
    fragile: hasFragile,
    oversized: hasOversized,
  });
  const {
    paymentAvailability,
    paymentMethods,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    selectedMethodAvailable,
    reloadPaymentAvailability: loadPaymentAvailability,
  } = usePaymentAvailability();

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Record<string, unknown>;
        const value = (key: string) => (typeof draft[key] === "string" ? (draft[key] as string) : "");
        setCountry(value("country") || "United States");
        setOtherCountryName(value("otherCountryName"));
        setFullName(value("fullName"));
        setEmail(value("email"));
        setPhone(value("phone"));
        setAddress(value("address"));
        setAddressLine2(value("addressLine2"));
        setCity(value("city"));
        setState(value("state"));
        setPostalCode(value("postalCode"));
        setNotes(value("notes"));
      }
    } catch {
      window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
    } finally {
      setDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    const draft = { country, otherCountryName, fullName, email, phone, address, addressLine2, city, state, postalCode, notes };
    if ([otherCountryName, fullName, email, phone, address, addressLine2, city, state, postalCode, notes].some((value) => value.trim())) {
      try {
        window.sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Checkout remains usable when session storage is unavailable.
      }
    } else {
      window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
    }
  }, [draftHydrated, country, otherCountryName, fullName, email, phone, address, addressLine2, city, state, postalCode, notes]);

  const shippingCost = discount?.freeShipping ? 0 : (selectedOption?.price ?? 0);
  const discountTotal = discount?.valid ? discount.discountAmount : 0;
  const total = Math.max(0, subtotal - discountTotal) + shippingCost;
  const totalIsKnown = quoteStatus === "ready" && selectedOption !== null;

  const startPayment = useCallback(
    async (orderId: string, orderNumber: string, orderTotal: number) => {
      setRedirecting(true);
      setPaymentError(null);
      try {
        const response = await fetch("/api/payments/paypal/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const payload = (await response.json().catch(() => ({}))) as { approveUrl?: string; message?: string };
        if (!response.ok || !payload.approveUrl) {
          setResult({
            orderId,
            orderNumber,
            total: orderTotal,
            paymentStatus: "Pending",
            paymentMethod: "PayPal",
            notice: response.status === 503 ? "unavailable" : "failed",
          });
          return;
        }
        window.location.assign(payload.approveUrl);
      } catch {
        setResult({ orderId, orderNumber, total: orderTotal, paymentStatus: "Pending", paymentMethod: "PayPal", notice: "failed" });
      } finally {
        setRedirecting(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (handledReturn.current) return;
    const mode = searchParams.get("paypal");
    if (!mode) return;
    handledReturn.current = true;

    const orderId = searchParams.get("orderId") ?? readLastOrder()?.orderId ?? "";
    const token = searchParams.get("token") ?? "";

    if (mode === "cancel") {
      const stored = readLastOrder();
      if (orderId && stored && stored.orderId === orderId) {
        setResult({
          orderId: stored.orderId,
          orderNumber: stored.orderNumber,
          total: stored.total,
          paymentStatus: "Pending",
          paymentMethod: "PayPal",
          notice: "cancelled",
        });
      } else if (orderId) {
        setResult({ orderId, orderNumber: "", total: 0, paymentStatus: "Pending", paymentMethod: "PayPal", notice: "cancelled" });
      }
      return;
    }

    if (mode !== "return" || !token) return;

    setCapturing(true);
    void (async () => {
      try {
        const response = await fetch("/api/payments/paypal/capture", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paypalOrderId: token }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          status?: string;
          orderId?: string;
          orderNumber?: string;
          total?: number;
          paymentMethod?: "PayPal" | "BankTransfer";
          paymentProofUploadedAt?: string | null;
          message?: string;
        };
        if (!response.ok) throw new Error(payload?.message ?? "capture failed");

        const stored = readLastOrder();
        const paid = payload.status === "Paid";
        if (stored && stored.orderId === (payload.orderId ?? orderId)) {
          writeLastOrder({ ...stored, paymentStatus: paid ? "Paid" : "Pending" });
        }
        setResult({
          orderId: payload.orderId ?? orderId,
          orderNumber: payload.orderNumber ?? stored?.orderNumber ?? "",
          total: Number(payload.total ?? stored?.total ?? 0),
          paymentStatus: paid ? "Paid" : "Pending",
          paymentMethod: "PayPal",
          notice: paid ? undefined : "review",
        });
        clearCart();
      } catch {
        const stored = readLastOrder();
        setPaymentError(t.checkout.paymentFailed);
        setResult({
          orderId: stored?.orderId ?? orderId,
          orderNumber: stored?.orderNumber ?? "",
          total: stored?.total ?? 0,
          paymentStatus: "Pending",
          paymentMethod: "PayPal",
          notice: "failed",
        });
      } finally {
        setCapturing(false);
      }
    })();
  }, [searchParams, clearCart, t]);

  const recoverCheckout = useCallback(async () => {
    setRecoveryStatus("checking");
    try {
      const recovery = await recoverCheckoutAttempt();
      if (recovery.kind === "missing") {
        setRecoveryStatus("done");
        return;
      }
      clearCart();
      const paid = recovery.paymentStatus === "Paid";
      const failed = recovery.failed;
      setResult({
        orderId: recovery.order.orderId,
        orderNumber: recovery.order.orderNumber,
        total: recovery.order.total,
        paymentStatus: paid ? "Paid" : "Pending",
        paymentMethod: recovery.paymentMethod,
        paymentProofUploadedAt: recovery.order.paymentProofUploadedAt,
        orderStatus: recovery.orderStatus,
        retryAllowed: recovery.canRetry,
        notice: paid ? undefined : failed ? "expired" : recovery.orderStatus === "Cancelled" || recovery.orderStatus === "Returned" ? "terminal" : "recovered",
      });
      setRecoveryStatus("done");
    } catch {
      setRecoveryStatus("error");
    }
  }, [clearCart]);

  useEffect(() => {
    if (!cartHydrated || !draftHydrated || recoveryStatus !== "waiting") return;
    if (searchParams.has("paypal")) {
      setRecoveryStatus("done");
      return;
    }

    const hasAttempt = hasCheckoutAttempt();
    const stored = readLastOrder();
    if (hasAttempt || (!lines.length && stored?.paymentStatus !== "Paid" && stored?.orderId)) {
      void recoverCheckout();
      return;
    }
    setRecoveryStatus("done");
  }, [cartHydrated, draftHydrated, lines.length, recoveryStatus, searchParams, recoverCheckout]);

  const applyDiscount = async () => {
    const code = discountInput.trim();
    if (!code) return;
    setDiscountLoading(true);
    setDiscountError(null);
    try {
      const response = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          subtotal,
          items: lines.map((line) => ({
            productId: line.id,
            quantity: line.quantity,
            lineTotal: line.price * line.quantity,
          })),
        }),
      });
      const payload = (await response.json()) as Discount;
      if (!response.ok || !payload.valid) {
        setDiscount(null);
        setDiscountError(language === "id" ? t.checkout.discountInvalid : payload?.message || t.checkout.discountInvalid);
      } else {
        setDiscount(payload);
      }
    } catch {
      setDiscount(null);
      setDiscountError(t.checkout.discountInvalid);
    } finally {
      setDiscountLoading(false);
    }
  };

  const placeOrder = async (acceptedQuote?: CheckoutPriceQuote) => {
    if (paymentAvailability !== "available" || !selectedMethodAvailable || !totalIsKnown || !selectedOption) return;
    if (selectedPaymentMethod === "PayPal" && !/^[A-Z]{2}$/.test(countryCode)) {
      setOrderError(t.checkout.paypalAddressCountryRequired);
      return;
    }
    setPlacing(true);
    setOrderError(null);
    try {
      const input = {
        checkoutKey: checkoutRequest(email),
        paymentMethod: selectedPaymentMethod,
        email,
        customerName: fullName.trim(),
        phone: phone || undefined,
        shippingAddress: {
          line1: address,
          line2: addressLine2 || undefined,
          city,
          state: state || undefined,
          postalCode: postalCode || undefined,
          country: country === "Other" ? otherCountryName.trim() : country,
          countryCode: countryCode || undefined,
        },
        customerNote: notes || undefined,
        shippingRateId: selectedOption?.id || undefined,
        discountCode: discount?.valid ? discount.code : undefined,
        items: lines.map((line) => ({ productId: line.id, variantId: line.variantId, quantity: line.quantity })),
      };
      const postJson = async (path: string, body: unknown) => fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      let serverQuote = acceptedQuote;
      if (!serverQuote) {
        const quoteResponse = await postJson("/api/orders/quote", input);
        const quoted = (await quoteResponse.json().catch(() => ({}))) as CheckoutPriceQuote & { message?: string | string[] };
        if (!quoteResponse.ok || !quoted.quoteToken || typeof quoted.total !== "number") {
          const raw = quoted?.message;
          setOrderError(language === "id" ? t.checkout.orderError : Array.isArray(raw) ? raw.join(", ") : (raw ?? t.checkout.orderError));
          return;
        }
        serverQuote = quoted;
        if (Math.round(serverQuote.total * 100) !== Math.round(total * 100)) {
          setPriceReview(serverQuote);
          return;
        }
      }

      let response = await postJson("/api/orders", { ...input, quoteToken: serverQuote.quoteToken });
      let payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        orderNumber?: string;
        total?: number;
        quoteChanged?: boolean;
        quote?: CheckoutPriceQuote;
        message?: string | string[];
      };
      if (response.ok && payload.quoteChanged && payload.quote?.quoteToken) {
        if (Math.round(payload.quote.total * 100) !== Math.round(serverQuote.total * 100)) {
          setPriceReview(payload.quote);
          return;
        }
        serverQuote = payload.quote;
        response = await postJson("/api/orders", { ...input, quoteToken: serverQuote.quoteToken });
        payload = (await response.json().catch(() => ({}))) as typeof payload;
      }
      if (!response.ok || !payload.id || !payload.orderNumber) {
        if (response.status === 409) {
          await recoverCheckout();
          return;
        }
        const raw = payload?.message;
        setOrderError(language === "id" ? t.checkout.orderError : Array.isArray(raw) ? raw.join(", ") : (raw ?? t.checkout.orderError));
        return;
      }

      setPriceReview(null);

      const orderTotal = Number(payload.total ?? total);
      const stored: StoredOrder = {
        orderId: payload.id,
        orderNumber: payload.orderNumber,
        total: orderTotal,
        email,
        createdAt: new Date().toISOString(),
        paymentStatus: "Pending",
        paymentMethod: selectedPaymentMethod,
      };
      writeLastOrder(stored);
      clearCheckoutAttempt();
      clearCart();
      if (selectedPaymentMethod === "PayPal") {
        await startPayment(stored.orderId, stored.orderNumber, stored.total);
      } else {
        setResult({
          orderId: stored.orderId,
          orderNumber: stored.orderNumber,
          total: stored.total,
          paymentStatus: "Pending",
          paymentMethod: "BankTransfer",
          paymentProofUploadedAt: null,
        });
      }
    } catch {
      setOrderError(t.checkout.orderError);
    } finally {
      setPlacing(false);
    }
  };

  if (capturing || redirecting) {
    return (
      <div className="page-container content-page">
        <div className="success-state">
          <div className="eyebrow">{t.checkout.eyebrow}</div>
          <h2>{capturing ? t.checkout.processingTitle : t.checkout.redirecting}</h2>
          <p className="muted">{t.checkout.processingBody}</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <CheckoutPaymentResult
        result={result}
        paymentMethods={paymentMethods}
        paymentError={paymentError}
        onStartPayment={(orderId, orderNumber, total) => void startPayment(orderId, orderNumber, total)}
        onProofUploaded={(uploadedAt) => {
          setResult((current) => current ? { ...current, paymentProofUploadedAt: uploadedAt, notice: undefined } : current);
        }}
      />
    );
  }

  if (!lines.length) {
    const isRecovering = !cartHydrated || recoveryStatus === "waiting" || recoveryStatus === "checking";
    return (
      <div className="page-container content-page">
        <div className="eyebrow">{t.checkout.eyebrow}</div>
        <h1>{isRecovering ? t.checkout.restoringCart : recoveryStatus === "error" ? t.checkout.recoveryError : t.checkout.emptyTitle}</h1>
        <p className="muted" style={{ margin: "18px 0 26px" }}>
          {isRecovering ? t.checkout.processingBody : recoveryStatus === "error" ? t.checkout.recoveryErrorBody : t.checkout.emptyBody}
        </p>
        {recoveryStatus === "error" ? (
          <button type="button" className="button" onClick={() => void recoverCheckout()}>{t.checkout.retryRecovery}</button>
        ) : null}
        {!isRecovering && recoveryStatus !== "error" ? <Link href="/shop" className="button">{t.checkout.browse}</Link> : null}
      </div>
    );
  }

  return (
    <div className="page-container content-page">
      <div className="content-page__intro">
        <div className="eyebrow">{t.checkout.eyebrow}</div>
        <h1>{t.checkout.title}</h1>
        <p>{t.checkout.intro}</p>
      </div>
      <div className="checkout-layout">
        <form
          className="checkout-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!placing && lines.length && paymentAvailability === "available" && selectedMethodAvailable && totalIsKnown) void placeOrder();
          }}
        >
          <details className="checkout-summary-mobile">
            <summary>{t.checkout.summary} · {totalIsKnown ? formatUSD(total, language) : t.checkout.totalAfterShipping}</summary>
            <CheckoutOrderSummary
              className="checkout-summary-card"
              lines={lines}
              subtotal={subtotal}
              totalWeight={totalWeight}
              discount={discount}
              discountTotal={discountTotal}
              selectedOption={selectedOption}
              shippingCost={shippingCost}
              total={total}
              totalIsKnown={totalIsKnown}
            />
          </details>
          <div className="field">
            <label htmlFor="full-name">{t.checkout.fullName}</label>
            <input id="full-name" name="name" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">{t.checkout.email}</label>
            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="phone">{t.checkout.phone}</label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="address">{t.checkout.address}</label>
            <textarea id="address" name="address" autoComplete="street-address" required value={address} onChange={(event) => setAddress(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="address-2">{t.checkout.addressLine2}</label>
            <input id="address-2" name="addressLine2" value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
          </div>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="city">{t.checkout.city}</label>
              <input id="city" name="city" autoComplete="address-level2" required value={city} onChange={(event) => setCity(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="state">{t.checkout.state}</label>
              <input id="state" name="state" autoComplete="address-level1" value={state} onChange={(event) => setState(event.target.value)} />
            </div>
          </div>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="postal-code">{t.checkout.postalCode}</label>
              <input id="postal-code" name="postalCode" autoComplete="postal-code" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="country">{t.checkout.country}</label>
              <select id="country" name="country" value={country} onChange={(event) => setCountry(event.target.value)}>
                {countries.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.code ? countryNames.of(item.code) ?? item.name : t.checkout.otherCountryOption}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {country === "Other" ? (
            <div className="field">
              <label htmlFor="other-country">{t.checkout.otherCountry}</label>
              <input id="other-country" name="otherCountry" autoComplete="country-name" required value={otherCountryName} onChange={(event) => setOtherCountryName(event.target.value)} />
            </div>
          ) : null}

          <div className="field">
            <label id="shipping-method-label">{t.checkout.shippingTitle}</label>
            {quoteStatus === "loading" ? (
              <p className="muted">{t.checkout.shippingCalculating}</p>
            ) : quote?.options.length ? (
              <div className="shipping-options" role="radiogroup" aria-labelledby="shipping-method-label">
                {quote.options.map((option) => (
                  <label key={option.id} className={`shipping-option ${selectedRateId === option.id ? "is-selected" : ""}`}>
                    <input
                      type="radio"
                      name="shipping-option"
                      checked={selectedRateId === option.id}
                      onChange={() => setSelectedRateId(option.id)}
                    />
                    <span className="shipping-option__details">
                      <strong>{option.name}</strong>
                      {option.carrier ? <span className="muted">· {option.carrier}</span> : null}
                    </span>
                    <strong className="shipping-option__price">
                      {option.price === 0 ? t.checkout.freeShipping : formatUSD(option.price, language)}
                    </strong>
                  </label>
                ))}
              </div>
            ) : quoteStatus === "error" ? (
              <div className="checkout-shipping-error">
                <p className="form-status form-status--error" role="alert">{t.checkout.shippingError}</p>
                <button type="button" className="text-button" onClick={() => void loadQuote()}>{t.checkout.retryShipping}</button>
              </div>
            ) : (
              <p className="muted">{t.checkout.shippingUnavailable}</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="notes">{t.checkout.notes}</label>
            <textarea id="notes" name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="discount">{t.checkout.discount}</label>
            <div className="discount-row">
              <input
                id="discount"
                name="discount"
                value={discountInput}
                onChange={(event) => setDiscountInput(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (!discountLoading && discountInput.trim()) void applyDiscount();
                  }
                }}
                placeholder="WELCOME10"
              />
              {discount?.valid ? (
                <button type="button" className="text-button" onClick={() => { setDiscount(null); setDiscountInput(""); }}>
                  {t.checkout.removeDiscount}
                </button>
              ) : (
                <button type="button" className="button" disabled={discountLoading || !discountInput.trim()} onClick={() => void applyDiscount()}>
                  {t.checkout.applyDiscount}
                </button>
              )}
            </div>
            {discount?.valid ? (
              <span className="form-status form-status--success">
                      {discount.freeShipping ? t.checkout.discountFreeShipping(discount.code) : t.checkout.discountApplied(discount.code, formatUSD(discount.discountAmount, language))}
              </span>
            ) : null}
            {discountError ? <span className="form-status form-status--error">{discountError}</span> : null}
          </div>

          <fieldset className="payment-box" disabled={paymentAvailability === "loading" || paymentAvailability === "error"}>
            <legend>{t.checkout.paymentMethodTitle}</legend>
            {paymentMethods?.paypal.enabled ? (
              <label className={`payment-method-option ${selectedPaymentMethod === "PayPal" ? "is-selected" : ""}`}>
                <input type="radio" name="payment-method" value="PayPal" checked={selectedPaymentMethod === "PayPal"} onChange={() => setSelectedPaymentMethod("PayPal")} />
                <span><strong>{t.checkout.paypalTitle}</strong><small>{t.checkout.paypalRedirectHint}</small></span>
              </label>
            ) : null}
            {paymentMethods?.bankTransfer.enabled ? (
              <label className={`payment-method-option ${selectedPaymentMethod === "BankTransfer" ? "is-selected" : ""}`}>
                <input type="radio" name="payment-method" value="BankTransfer" checked={selectedPaymentMethod === "BankTransfer"} onChange={() => setSelectedPaymentMethod("BankTransfer")} />
                <span><strong>{t.checkout.bankTransferOption}</strong><small>{t.checkout.bankTransferOptionHint}</small></span>
              </label>
            ) : null}
            {paymentAvailability === "loading" ? <span>{t.checkout.checkingPayment}</span> : null}
            {paymentAvailability === "unavailable" ? (
              <>
                <span>{t.checkout.allPaymentsUnavailable}</span>
                <Link href="/contact" className="text-button">{t.checkout.shippingSupport}</Link>
              </>
            ) : null}
            {paymentAvailability === "error" ? (
              <>
                <span className="form-status form-status--error" role="alert">{t.checkout.paypalCheckFailed}</span>
                <button type="button" className="text-button" onClick={() => void loadPaymentAvailability()}>{t.checkout.retryPaymentCheck}</button>
              </>
            ) : null}
          </fieldset>

          {orderError ? (
            <p className="form-status form-status--error" role="alert">
              {orderError}
            </p>
          ) : null}

          {priceReview ? (
            <CheckoutPriceReview
              quote={priceReview}
              placing={placing}
              onAccept={() => void placeOrder(priceReview)}
              onCancel={() => setPriceReview(null)}
            />
          ) : null}

          <button className="button button--full" type="submit" disabled={placing || !selectedOption || !totalIsKnown || paymentAvailability !== "available" || !selectedMethodAvailable}>
            {placing
              ? t.checkout.placing
              : paymentAvailability === "loading"
                ? t.checkout.checkingPayment
                : paymentAvailability !== "available"
                  ? t.checkout.paypalUnavailableShort
                  : !totalIsKnown
                    ? t.checkout.waitingForShipping
                    : t.checkout.placeOrder(formatUSD(total, language))}
          </button>
        </form>

        <CheckoutOrderSummary
          className="checkout-summary-desktop"
          lines={lines}
          subtotal={subtotal}
          totalWeight={totalWeight}
          discount={discount}
          discountTotal={discountTotal}
          selectedOption={selectedOption}
          shippingCost={shippingCost}
          total={total}
          totalIsKnown={totalIsKnown}
        />
      </div>
    </div>
  );
}
