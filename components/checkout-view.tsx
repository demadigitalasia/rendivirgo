"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type PaymentNotice = "cancelled" | "unavailable" | "failed" | "review" | "recovered" | "expired";
type ShippingQuoteStatus = "loading" | "ready" | "unavailable" | "error";
type PaymentAvailability = "loading" | "available" | "unavailable" | "error";

type PaymentResult = {
  orderId: string;
  orderNumber: string;
  total: number;
  paymentStatus: "Paid" | "Pending";
  paymentMethod?: "PayPal" | "BankTransfer";
  paymentProofUploadedAt?: string | null;
  notice?: PaymentNotice;
};

type StoredOrder = {
  orderId: string;
  orderNumber: string;
  total: number;
  email: string;
  createdAt?: string;
  paymentStatus?: "Pending" | "Paid";
  paymentMethod?: "PayPal" | "BankTransfer";
  paymentProofUploadedAt?: string | null;
};

type BankTransferDetails = {
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  swiftCode: string;
  currency: string;
};

type PaymentMethods = {
  paypal: { enabled: boolean };
  bankTransfer: BankTransferDetails;
};

const LAST_ORDER_KEY = "rv.lastOrder";
const CHECKOUT_DRAFT_KEY = "rv.checkoutDraft";
const CHECKOUT_REQUEST_KEY = "rv.checkoutRequestKey";
const CHECKOUT_REQUEST_EMAIL_KEY = "rv.checkoutRequestEmail";

const readLastOrder = (): StoredOrder | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_ORDER_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredOrder>;
    if (
      typeof stored.orderId !== "string" ||
      typeof stored.orderNumber !== "string" ||
      typeof stored.total !== "number" ||
      typeof stored.email !== "string"
    ) return null;
    return stored as StoredOrder;
  } catch {
    return null;
  }
};

const checkoutRequest = (email: string) => {
  try {
    const key = window.sessionStorage.getItem(CHECKOUT_REQUEST_KEY) ?? window.crypto.randomUUID();
    window.sessionStorage.setItem(CHECKOUT_REQUEST_KEY, key);
    if (!window.sessionStorage.getItem(CHECKOUT_REQUEST_EMAIL_KEY)) {
      window.sessionStorage.setItem(CHECKOUT_REQUEST_EMAIL_KEY, email.trim().toLowerCase());
    }
    return key;
  } catch {
    return window.crypto.randomUUID();
  }
};

export function CheckoutView() {
  const t = useCopy();
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
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<ShippingQuoteStatus>("loading");
  const [selectedRateId, setSelectedRateId] = useState<string>("");
  const [paymentAvailability, setPaymentAvailability] = useState<PaymentAvailability>("loading");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"PayPal" | "BankTransfer">("PayPal");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [proofUploadError, setProofUploadError] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<"waiting" | "checking" | "done" | "error">("waiting");
  const handledReturn = useRef(false);
  const quoteRequestId = useRef(0);
  const proofInputRef = useRef<HTMLInputElement>(null);

  const countryCode = useMemo(() => countries.find((item) => item.name === country)?.code ?? "", [country]);
  const hasFragile = lines.some((line) => line.fragile);
  const hasOversized = lines.some((line) => line.shipping.shippingClass === "Oversized");

  const loadQuote = useCallback(async () => {
    const requestId = ++quoteRequestId.current;
    if (!lines.length) {
      setQuote(null);
      setQuoteStatus("unavailable");
      return;
    }
    setQuote(null);
    setQuoteStatus("loading");
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
        if (requestId === quoteRequestId.current) setQuoteStatus("error");
        return;
      }
      const payload = (await response.json()) as Quote;
      if (!Array.isArray(payload?.options)) {
        if (requestId === quoteRequestId.current) setQuoteStatus("error");
        return;
      }
      if (requestId !== quoteRequestId.current) return;
      setQuote(payload);
      setQuoteStatus(payload.options.length ? "ready" : "unavailable");
      setSelectedRateId((current) => {
        if (payload.options.some((option) => option.id === current)) return current;
        return payload.options[0]?.id ?? "";
      });
    } catch {
      if (requestId === quoteRequestId.current) setQuoteStatus("error");
    }
  }, [lines.length, totalWeight, subtotal, countryCode, hasFragile, hasOversized]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const loadPaymentAvailability = useCallback(async () => {
    setPaymentAvailability("loading");
    try {
      const response = await fetch("/api/payments/methods", { cache: "no-store" });
      const payload = (await response.json()) as Partial<PaymentMethods>;
      if (!response.ok || typeof payload?.paypal?.enabled !== "boolean" || typeof payload?.bankTransfer?.enabled !== "boolean") {
        throw new Error("Payment availability unavailable");
      }
      const methods = payload as PaymentMethods;
      setPaymentMethods(methods);
      setPaymentAvailability(methods.paypal.enabled || methods.bankTransfer.enabled ? "available" : "unavailable");
      setSelectedPaymentMethod((current) => {
        if (current === "PayPal" && !methods.paypal.enabled && methods.bankTransfer.enabled) return "BankTransfer";
        if (current === "BankTransfer" && !methods.bankTransfer.enabled && methods.paypal.enabled) return "PayPal";
        return current;
      });
    } catch {
      setPaymentAvailability("error");
    }
  }, []);

  useEffect(() => {
    void loadPaymentAvailability();
  }, [loadPaymentAvailability]);

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

  const selectedOption = quote?.options.find((option) => option.id === selectedRateId) ?? quote?.options[0] ?? null;
  const shippingCost = discount?.freeShipping ? 0 : (selectedOption?.price ?? 0);
  const discountTotal = discount?.valid ? discount.discountAmount : 0;
  const total = Math.max(0, subtotal - discountTotal) + shippingCost;
  const totalIsKnown = quoteStatus === "ready" && selectedOption !== null;
  const selectedMethodAvailable = selectedPaymentMethod === "PayPal"
    ? Boolean(paymentMethods?.paypal.enabled)
    : Boolean(paymentMethods?.bankTransfer.enabled);

  const renderOrderSummary = (className: string) => (
    <section className={`summary-card ${className}`}>
      <h2>{t.checkout.summary}</h2>
      <Link href="/cart" className="text-button checkout-summary__edit">{t.checkout.editCart}</Link>
      {lines.map((line) => (
        <div className="summary-row" key={`${line.id}:${line.variantId ?? "base"}`}>
          <span>
            {line.name}{line.variantName ? ` — ${line.variantName}` : ""} × {line.quantity}
          </span>
          <strong>{formatUSD(line.price * line.quantity)}</strong>
        </div>
      ))}
      <div className="summary-row">
        <span>{t.checkout.subtotal}</span>
        <strong>{formatUSD(subtotal)}</strong>
      </div>
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
            : t.checkout.calculatedShipping}
        </strong>
      </div>
      <div className="summary-row summary-row--total">
        <span>{t.checkout.total}</span>
        <strong>{totalIsKnown ? formatUSD(total) : t.checkout.totalAfterShipping}</strong>
      </div>
    </section>
  );

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
          window.localStorage.setItem(
            LAST_ORDER_KEY,
            JSON.stringify({ ...stored, paymentStatus: paid ? "Paid" : "Pending" }),
          );
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
    const stored = readLastOrder();
    let checkoutKey: string | undefined;
    let attemptEmail: string | undefined;
    try {
      checkoutKey = window.sessionStorage.getItem(CHECKOUT_REQUEST_KEY) ?? undefined;
      attemptEmail = window.sessionStorage.getItem(CHECKOUT_REQUEST_EMAIL_KEY) ?? undefined;
    } catch {
      // A saved order below can still be recovered without session storage.
    }
    const emailForLookup = attemptEmail || stored?.email;
    if (!emailForLookup || (!checkoutKey && !stored?.orderId)) {
      setRecoveryStatus("done");
      return;
    }

    setRecoveryStatus("checking");
    try {
      const response = await fetch("/api/payments/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(checkoutKey ? { checkoutKey } : { orderId: stored?.orderId }),
          email: emailForLookup,
        }),
      });
      if (response.status === 404) {
        setRecoveryStatus("done");
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as {
        orderId?: string;
        orderNumber?: string;
        total?: number;
        paymentStatus?: string;
        paymentMethod?: "PayPal" | "BankTransfer";
        paymentProofUploadedAt?: string | null;
      };
      if (!response.ok || !payload.orderId || !payload.orderNumber || typeof payload.total !== "number") {
        throw new Error("The saved order could not be recovered");
      }

      const paid = payload.paymentStatus === "Paid";
      const failed = payload.paymentStatus === "Failed" || payload.paymentStatus === "Refunded";
      const recovered: StoredOrder = {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        total: payload.total,
        email: emailForLookup,
        createdAt: new Date().toISOString(),
        paymentStatus: paid ? "Paid" : "Pending",
        paymentMethod: payload.paymentMethod ?? stored?.paymentMethod ?? "PayPal",
        paymentProofUploadedAt: payload.paymentProofUploadedAt ?? stored?.paymentProofUploadedAt ?? null,
      };
      window.localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(recovered));
      window.sessionStorage.removeItem(CHECKOUT_REQUEST_KEY);
      window.sessionStorage.removeItem(CHECKOUT_REQUEST_EMAIL_KEY);
      window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
      clearCart();
      setResult({
        orderId: recovered.orderId,
        orderNumber: recovered.orderNumber,
        total: recovered.total,
        paymentStatus: paid ? "Paid" : "Pending",
        paymentMethod: recovered.paymentMethod,
        paymentProofUploadedAt: recovered.paymentProofUploadedAt,
        notice: paid ? undefined : failed ? "expired" : "recovered",
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

    let hasAttempt = false;
    try {
      hasAttempt = Boolean(window.sessionStorage.getItem(CHECKOUT_REQUEST_KEY));
    } catch {
      // The last-order record is checked below when available.
    }
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
    if (paymentAvailability !== "available" || !selectedMethodAvailable || !totalIsKnown || !selectedOption) return;
    setPlacing(true);
    setOrderError(null);
    try {
      const checkoutKey = checkoutRequest(email);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkoutKey,
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
        }),
      });
      const payload = (await response.json()) as {
        id?: string;
        orderNumber?: string;
        total?: number;
        message?: string | string[];
      };
      if (!response.ok || !payload.id || !payload.orderNumber) {
        if (response.status === 409) {
          await recoverCheckout();
          return;
        }
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
        createdAt: new Date().toISOString(),
        paymentStatus: "Pending",
        paymentMethod: selectedPaymentMethod,
      };
      window.localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(stored));
      window.sessionStorage.removeItem(CHECKOUT_REQUEST_KEY);
      window.sessionStorage.removeItem(CHECKOUT_REQUEST_EMAIL_KEY);
      window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
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

  const uploadBankTransferProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!result || result.paymentMethod !== "BankTransfer" || !paymentProof) return;
    if (paymentProof.size > 8 * 1024 * 1024) {
      setProofUploadError(t.checkout.proofTooLarge);
      return;
    }
    const orderEmail = readLastOrder()?.email;
    if (!orderEmail) {
      setProofUploadError(t.checkout.proofUploadFailed);
      return;
    }
    setUploadingProof(true);
    setProofUploadError(null);
    try {
      const formData = new FormData();
      formData.append("email", orderEmail);
      formData.append("file", paymentProof);
      const response = await fetch(`/api/payments/bank-transfer/${encodeURIComponent(result.orderId)}/proof`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as { uploadedAt?: string; message?: string | string[] };
      if (!response.ok || !payload.uploadedAt) {
        const message = Array.isArray(payload.message) ? payload.message.join(", ") : payload.message;
        throw new Error(message || t.checkout.proofUploadFailed);
      }
      const updated: PaymentResult = { ...result, paymentProofUploadedAt: payload.uploadedAt, notice: undefined };
      setResult(updated);
      const stored = readLastOrder();
      if (stored?.orderId === result.orderId) {
        window.localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ ...stored, paymentProofUploadedAt: payload.uploadedAt }));
      }
      setPaymentProof(null);
      if (proofInputRef.current) proofInputRef.current.value = "";
    } catch (caught) {
      setProofUploadError(caught instanceof Error ? caught.message : t.checkout.proofUploadFailed);
    } finally {
      setUploadingProof(false);
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
    const isBankTransfer = result.paymentMethod === "BankTransfer";
    const canRetry = !isBankTransfer && (result.notice === "cancelled" || result.notice === "failed" || result.notice === "unavailable" || result.notice === "recovered");
    const pendingMessage =
      isBankTransfer && result.notice === "expired"
        ? t.checkout.paymentExpired
        : isBankTransfer
          ? result.paymentProofUploadedAt
            ? t.checkout.bankTransferProofPending
            : t.checkout.bankTransferPending
        : result.notice === "unavailable"
        ? t.checkout.paypalUnavailable
        : result.notice === "cancelled"
          ? t.checkout.paymentCancelled
          : result.notice === "review"
            ? t.checkout.paymentPendingReview
            : result.notice === "expired"
              ? t.checkout.paymentExpired
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
          {!paid && isBankTransfer && result.notice !== "expired" ? (
            <section className="bank-transfer-panel" aria-labelledby="bank-transfer-title">
              <h3 id="bank-transfer-title">{t.checkout.bankTransferTitle}</h3>
              <p>{t.checkout.transferExactAmount}</p>
              <dl className="bank-transfer-details">
                <div><dt>{t.checkout.bankName}</dt><dd>{paymentMethods?.bankTransfer.bankName || "—"}</dd></div>
                {paymentMethods?.bankTransfer.accountName ? (
                  <div><dt>{t.checkout.accountName}</dt><dd>{paymentMethods.bankTransfer.accountName}</dd></div>
                ) : null}
                <div><dt>{t.checkout.accountNumber}</dt><dd>{paymentMethods?.bankTransfer.accountNumber || "—"}</dd></div>
                <div><dt>{t.checkout.swiftCode}</dt><dd>{paymentMethods?.bankTransfer.swiftCode || "—"}</dd></div>
                <div><dt>{t.checkout.transferAmount}</dt><dd><strong>{formatUSD(result.total)}</strong></dd></div>
              </dl>
              {result.paymentProofUploadedAt ? (
                <p className="form-status form-status--success" role="status">
                  {t.checkout.proofReceived(new Date(result.paymentProofUploadedAt).toLocaleString())}
                </p>
              ) : null}
              <form className="bank-transfer-upload" onSubmit={(event) => void uploadBankTransferProof(event)}>
                <label htmlFor="bank-transfer-proof">{t.checkout.uploadProof}</label>
                <input
                  ref={proofInputRef}
                  id="bank-transfer-proof"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  required
                  onChange={(event) => {
                    setPaymentProof(event.target.files?.[0] ?? null);
                    setProofUploadError(null);
                  }}
                />
                <span className="muted">{t.checkout.proofImageHint}</span>
                {proofUploadError ? <span className="form-status form-status--error" role="alert">{proofUploadError}</span> : null}
                <button className="button" type="submit" disabled={uploadingProof || !paymentProof}>
                  {uploadingProof ? t.checkout.uploadingProof : result.paymentProofUploadedAt ? t.checkout.replaceProof : t.checkout.submitProof}
                </button>
              </form>
            </section>
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
            <summary>{t.checkout.summary} · {totalIsKnown ? formatUSD(total) : t.checkout.totalAfterShipping}</summary>
            {renderOrderSummary("checkout-summary-card")}
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
                    {item.name}
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
                      {option.price === 0 ? t.checkout.freeShipping : formatUSD(option.price)}
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
                {discount.freeShipping ? t.checkout.discountFreeShipping(discount.code) : t.checkout.discountApplied(discount.code, formatUSD(discount.discountAmount))}
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

          <button className="button button--full" type="submit" disabled={placing || !selectedOption || !totalIsKnown || paymentAvailability !== "available" || !selectedMethodAvailable}>
            {placing
              ? t.checkout.placing
              : paymentAvailability === "loading"
                ? t.checkout.checkingPayment
                : paymentAvailability !== "available"
                  ? t.checkout.paypalUnavailableShort
                  : !totalIsKnown
                    ? t.checkout.waitingForShipping
                    : t.checkout.placeOrder(formatUSD(total))}
          </button>
        </form>

        {renderOrderSummary("checkout-summary-desktop")}
      </div>
    </div>
  );
}
