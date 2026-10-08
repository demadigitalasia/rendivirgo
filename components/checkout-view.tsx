"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart, useCopy } from "@/components/providers";
import { formatUSD } from "@/lib/catalog";

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

type ShippingOption = {
  id: string;
  name: string;
  carrier: string | null;
  price: number;
  breakdown: Record<string, number>;
};

type Quote = {
  options: ShippingOption[];
  source: "CarrierAPI" | "AdminOverride" | "FreeShipping";
  overrideApplied: boolean;
};

type Discount = {
  valid: boolean;
  code: string;
  type: string;
  discountAmount: number;
  freeShipping: boolean;
  message: string;
};

type PaymentNotice = "cancelled" | "unavailable" | "failed" | "review";

type PaymentResult = {
  orderId: string;
  orderNumber: string;
  total: number;
  paymentStatus: "Paid" | "Pending";
  notice?: PaymentNotice;
};

type StoredOrder = {
  orderId: string;
  orderNumber: string;
  total: number;
  email: string;
};

const LAST_ORDER_KEY = "rv.lastOrder";

const readLastOrder = (): StoredOrder | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_ORDER_KEY);
    return raw ? (JSON.parse(raw) as StoredOrder) : null;
  } catch {
    return null;
  }
};

const sourceLabel: Record<Quote["source"], string> = {
  CarrierAPI: "API default",
  AdminOverride: "Admin override",
  FreeShipping: "Free shipping",
};

export function CheckoutView() {
  const t = useCopy();
  const searchParams = useSearchParams();
  const { lines, subtotal, totalWeight, clearCart } = useCart();

  const [country, setCountry] = useState("United States");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState<string>("");
  const [discountInput, setDiscountInput] = useState("");
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const handledReturn = useRef(false);

  const countryCode = useMemo(() => countries.find((item) => item.name === country)?.code ?? "", [country]);
  const hasFragile = lines.some((line) => line.fragile);
  const hasOversized = lines.some((line) => line.shipping.shippingClass === "Oversized");

  const loadQuote = useCallback(async () => {
    if (!lines.length) return;
    setQuoteLoading(true);
    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weightGram: totalWeight,
          subtotal,
          countryCode,
          fragile: hasFragile,
          oversized: hasOversized,
        }),
      });
      if (!response.ok) {
        setQuote(null);
        return;
      }
      const payload = (await response.json()) as Quote;
      if (!Array.isArray(payload?.options)) {
        setQuote(null);
        return;
      }
      setQuote(payload);
      setSelectedRateId((current) => {
        if (payload.options.some((option) => option.id === current)) return current;
        return payload.options[0]?.id ?? "";
      });
    } catch {
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [lines.length, totalWeight, subtotal, countryCode, hasFragile, hasOversized]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const selectedOption = quote?.options.find((option) => option.id === selectedRateId) ?? quote?.options[0] ?? null;
  const shippingCost = discount?.freeShipping ? 0 : (selectedOption?.price ?? 0);
  const discountTotal = discount?.valid ? discount.discountAmount : 0;
  const total = Math.max(0, subtotal - discountTotal) + shippingCost;

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
            notice: response.status === 503 ? "unavailable" : "failed",
          });
          return;
        }
        window.location.assign(payload.approveUrl);
      } catch {
        setResult({ orderId, orderNumber, total: orderTotal, paymentStatus: "Pending", notice: "failed" });
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
          notice: "cancelled",
        });
      } else if (orderId) {
        setResult({ orderId, orderNumber: "", total: 0, paymentStatus: "Pending", notice: "cancelled" });
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
          message?: string;
        };
        if (!response.ok) throw new Error(payload?.message ?? "capture failed");

        const stored = readLastOrder();
        const paid = payload.status === "Paid";
        setResult({
          orderId: payload.orderId ?? orderId,
          orderNumber: payload.orderNumber ?? stored?.orderNumber ?? "",
          total: Number(payload.total ?? stored?.total ?? 0),
          paymentStatus: paid ? "Paid" : "Pending",
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
          notice: "failed",
        });
      } finally {
        setCapturing(false);
      }
    })();
  }, [searchParams, clearCart, t]);

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
        setDiscountError(payload?.message || t.checkout.discountInvalid);
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

  const placeOrder = async () => {
    setPlacing(true);
    setOrderError(null);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          customerName: `${firstName} ${lastName}`.trim(),
          phone: phone || undefined,
          shippingAddress: {
            line1: address,
            line2: addressLine2 || undefined,
            city,
            state: state || undefined,
            postalCode: postalCode || undefined,
            country,
            countryCode: countryCode || undefined,
          },
          customerNote: notes || undefined,
          shippingRateId: selectedOption?.id || undefined,
          discountCode: discount?.valid ? discount.code : undefined,
          items: lines.map((line) => ({ productId: line.id, variantId: line.variantId, quantity: line.quantity })),
        }),
      });
      const payload = (await response.json()) as {
        id?: string;
        orderNumber?: string;
        total?: number;
        message?: string | string[];
      };
      if (!response.ok || !payload.id || !payload.orderNumber) {
        const raw = payload?.message;
        setOrderError(Array.isArray(raw) ? raw.join(", ") : (raw ?? t.checkout.orderError));
        return;
      }

      const orderTotal = Number(payload.total ?? total);
      const stored: StoredOrder = {
        orderId: payload.id,
        orderNumber: payload.orderNumber,
        total: orderTotal,
        email,
      };
      window.localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(stored));
      clearCart();
      await startPayment(stored.orderId, stored.orderNumber, stored.total);
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
    const paid = result.paymentStatus === "Paid";
    const canRetry = result.notice === "cancelled" || result.notice === "failed";
    const pendingMessage =
      result.notice === "unavailable"
        ? t.checkout.paypalUnavailable
        : result.notice === "cancelled"
          ? t.checkout.paymentCancelled
          : result.notice === "review"
            ? t.checkout.paymentPendingReview
            : result.notice === "failed"
              ? t.checkout.paymentFailed
              : t.checkout.successPending;

    return (
      <div className="page-container content-page">
        <div className="success-state">
          <div className="eyebrow">{paid ? t.checkout.successEyebrow : t.checkout.pendingEyebrow}</div>
          <h2>{result.orderNumber ? t.checkout.successOrder(result.orderNumber) : t.checkout.successTitle}</h2>
          <p>{paid ? t.checkout.successPaid : pendingMessage}</p>
          {paid ? <p style={{ marginTop: 8 }}>{t.checkout.ordersEmailNote}</p> : null}
          {paymentError ? (
            <p className="form-status form-status--error" role="alert">
              {paymentError}
            </p>
          ) : null}
          {result.total > 0 ? (
            <p style={{ marginTop: 12 }}>
              <strong>{formatUSD(result.total)}</strong>
            </p>
          ) : null}
          {!paid && canRetry && result.orderId ? (
            <button
              type="button"
              className="button"
              style={{ marginTop: 18 }}
              onClick={() => void startPayment(result.orderId, result.orderNumber, result.total)}
            >
              {result.notice === "failed" ? t.checkout.retryPayment : t.checkout.payNow(formatUSD(result.total))}
            </button>
          ) : null}
          {result.orderNumber ? (
            <p style={{ marginTop: 14 }}>
              <Link
                href={`/track?order=${encodeURIComponent(result.orderNumber)}&email=${encodeURIComponent(readLastOrder()?.email ?? "")}`}
                className="text-button"
              >
                {t.footer.track}
              </Link>
            </p>
          ) : null}
          <Link href="/shop" className="button" style={{ marginTop: 18 }}>
            {t.checkout.continue}
          </Link>
        </div>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="page-container content-page">
        <div className="eyebrow">{t.checkout.eyebrow}</div>
        <h1>{t.checkout.emptyTitle}</h1>
        <p className="muted" style={{ margin: "18px 0 26px" }}>
          {t.checkout.emptyBody}
        </p>
        <Link href="/shop" className="button">
          {t.checkout.browse}
        </Link>
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
            if (!placing && lines.length) void placeOrder();
          }}
        >
          <div className="field-grid">
            <div className="field">
              <label htmlFor="first-name">{t.checkout.firstName}</label>
              <input id="first-name" name="firstName" autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="last-name">{t.checkout.lastName}</label>
              <input id="last-name" name="lastName" autoComplete="family-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">{t.checkout.email}</label>
            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="phone">{t.checkout.phone}</label>
            <input id="phone" name="phone" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
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
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label id="shipping-method-label">{t.checkout.shippingTitle}</label>
            {quoteLoading ? (
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
                      {option.price === 0 ? t.checkout.freeShipping : formatUSD(option.price)}
                    </strong>
                  </label>
                ))}
              </div>
            ) : (
              <p className="muted">{t.checkout.shippingUnavailable}</p>
            )}
            {quote ? <p className="product-detail__note">{t.checkout.shippingSource(sourceLabel[quote.source])}</p> : null}
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
                {discount.freeShipping ? t.checkout.discountFreeShipping(discount.code) : t.checkout.discountApplied(discount.code, formatUSD(discount.discountAmount))}
              </span>
            ) : null}
            {discountError ? <span className="form-status form-status--error">{discountError}</span> : null}
          </div>

          <div className="payment-box">
            <strong>{t.checkout.paypalTitle}</strong>
            <span>{t.checkout.paypalRedirectHint}</span>
          </div>

          {orderError ? (
            <p className="form-status form-status--error" role="alert">
              {orderError}
            </p>
          ) : null}

          <button className="button button--full" type="submit" disabled={placing || !selectedOption}>
            {placing ? t.checkout.placing : t.checkout.placeOrder(formatUSD(total))}
          </button>
        </form>

        <aside className="summary-card">
          <h2>{t.checkout.summary}</h2>
          {lines.map((line) => (
            <div className="summary-row" key={`${line.id}:${line.variantId ?? "base"}`}>
              <span>
                {line.name} × {line.quantity}
              </span>
              <strong>{formatUSD(line.price * line.quantity)}</strong>
            </div>
          ))}
          <div className="summary-row">
            <span>{t.checkout.totalWeight}</span>
            <span>{t.checkout.weightUnit(totalWeight)}</span>
          </div>
          {discountTotal > 0 ? (
            <div className="summary-row">
              <span>{discount?.code}</span>
              <strong>−{formatUSD(discountTotal)}</strong>
            </div>
          ) : null}
          <div className="summary-row">
            <span>{t.checkout.shipping}</span>
            <strong>
              {selectedOption
                ? shippingCost === 0
                  ? t.checkout.freeShipping
                  : formatUSD(shippingCost)
                : "—"}
            </strong>
          </div>
          <div className="summary-row summary-row--total">
            <span>{t.checkout.total}</span>
            <strong>{formatUSD(total)}</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}
