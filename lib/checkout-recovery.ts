export type StoredOrder = {
  orderId: string;
  orderNumber: string;
  total: number;
  email: string;
  createdAt?: string;
  paymentStatus?: "Pending" | "Paid";
  paymentMethod?: "PayPal" | "BankTransfer";
  paymentProofUploadedAt?: string | null;
};

export type CheckoutRecoveryResult =
  | { kind: "missing" }
  | {
      kind: "recovered";
      order: StoredOrder;
      paymentStatus: "Paid" | "Pending";
      paymentMethod: "PayPal" | "BankTransfer";
      orderStatus?: string;
      canRetry: boolean;
      failed: boolean;
    };

const LAST_ORDER_KEY = "rv.lastOrder";
const CHECKOUT_DRAFT_KEY = "rv.checkoutDraft";
const CHECKOUT_REQUEST_KEY = "rv.checkoutRequestKey";
const CHECKOUT_REQUEST_EMAIL_KEY = "rv.checkoutRequestEmail";
const scopedKey = (key: string, scope?: string) => scope ? `${key}:${scope}` : key;

export function readLastOrder(scope?: string): StoredOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(scopedKey(LAST_ORDER_KEY, scope));
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
}

export function writeLastOrder(order: StoredOrder, scope?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scopedKey(LAST_ORDER_KEY, scope), JSON.stringify(order));
}

export function checkoutRequest(email: string, scope?: string): string {
  try {
    const requestKey = scopedKey(CHECKOUT_REQUEST_KEY, scope);
    const emailKey = scopedKey(CHECKOUT_REQUEST_EMAIL_KEY, scope);
    const key = window.sessionStorage.getItem(requestKey) ?? window.crypto.randomUUID();
    window.sessionStorage.setItem(requestKey, key);
    if (!window.sessionStorage.getItem(emailKey)) {
      window.sessionStorage.setItem(emailKey, email.trim().toLowerCase());
    }
    return key;
  } catch {
    return window.crypto.randomUUID();
  }
}

export function hasCheckoutAttempt(scope?: string): boolean {
  try {
    return Boolean(window.sessionStorage.getItem(scopedKey(CHECKOUT_REQUEST_KEY, scope)));
  } catch {
    return false;
  }
}

export function clearCheckoutAttempt(scope?: string): void {
  try {
    window.sessionStorage.removeItem(scopedKey(CHECKOUT_REQUEST_KEY, scope));
    window.sessionStorage.removeItem(scopedKey(CHECKOUT_REQUEST_EMAIL_KEY, scope));
    window.sessionStorage.removeItem(scopedKey(CHECKOUT_DRAFT_KEY, scope));
  } catch {
    // The saved order remains available through the local last-order record.
  }
}

export async function recoverCheckoutAttempt(scope?: string): Promise<CheckoutRecoveryResult> {
  const stored = readLastOrder(scope);
  let checkoutKey: string | undefined;
  let attemptEmail: string | undefined;
  try {
    checkoutKey = window.sessionStorage.getItem(scopedKey(CHECKOUT_REQUEST_KEY, scope)) ?? undefined;
    attemptEmail = window.sessionStorage.getItem(scopedKey(CHECKOUT_REQUEST_EMAIL_KEY, scope)) ?? undefined;
  } catch {
    // A saved order below can still be recovered without session storage.
  }
  const email = attemptEmail || stored?.email;
  if (!email || (!checkoutKey && !stored?.orderId)) return { kind: "missing" };

  const response = await fetch("/api/payments/resume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...(checkoutKey ? { checkoutKey } : { orderId: stored?.orderId }), email }),
  });
  if (response.status === 404) return { kind: "missing" };
  const payload = (await response.json().catch(() => ({}))) as {
    orderId?: string;
    orderNumber?: string;
    total?: number;
    paymentStatus?: string;
    paymentMethod?: "PayPal" | "BankTransfer";
    paymentProofUploadedAt?: string | null;
    orderStatus?: string;
    canRetry?: boolean;
  };
  if (!response.ok || !payload.orderId || !payload.orderNumber || typeof payload.total !== "number") {
    throw new Error("The saved order could not be recovered");
  }

  const paymentStatus = payload.paymentStatus === "Paid" ? "Paid" : "Pending";
  const order: StoredOrder = {
    orderId: payload.orderId,
    orderNumber: payload.orderNumber,
    total: payload.total,
    email,
    createdAt: new Date().toISOString(),
    paymentStatus,
    paymentMethod: payload.paymentMethod ?? stored?.paymentMethod ?? "PayPal",
    paymentProofUploadedAt: payload.paymentProofUploadedAt ?? stored?.paymentProofUploadedAt ?? null,
  };
  writeLastOrder(order, scope);
  clearCheckoutAttempt(scope);
  return {
    kind: "recovered",
    order,
    paymentStatus,
    paymentMethod: order.paymentMethod ?? "PayPal",
    orderStatus: payload.orderStatus,
    canRetry: payload.canRetry === true,
    failed: payload.paymentStatus === "Failed" || payload.paymentStatus === "Refunded",
  };
}
