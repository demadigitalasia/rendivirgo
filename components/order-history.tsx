"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCopy } from "@/components/providers";
import { formatUSD } from "@/lib/catalog";

type HistoryOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  currency: string;
  total: number;
  placedAt: string;
  shippingName: string | null;
  trackingNumber: string | null;
  itemCount: number;
  items: Array<{ name: string; quantity: number; lineTotal: number; imageUrl: string | null }>;
};

type HistoryPayload = { email: string; expiresAt: string; orders: HistoryOrder[] };

const labelize = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2");

export function OrderHistory() {
  const t = useCopy();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [email, setEmail] = useState("");
  const [requestState, setRequestState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [payload, setPayload] = useState<HistoryPayload | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (!token || fetched.current) return;
    fetched.current = true;
    setLoadingHistory(true);
    void (async () => {
      try {
        const response = await fetch(`/api/orders/history?token=${encodeURIComponent(token)}`, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          setInvalidToken(true);
          return;
        }
        setPayload((await response.json()) as HistoryPayload);
      } catch {
        setInvalidToken(true);
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [token]);

  const requestLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || requestState === "loading") return;
    setRequestState("loading");
    try {
      const response = await fetch("/api/orders/history-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setRequestState(response.ok ? "sent" : "error");
    } catch {
      setRequestState("error");
    }
  };

  return (
    <>
      <section className="page-hero">
        <div className="page-container">
          <div className="eyebrow eyebrow--light">{t.orderHistory.eyebrow}</div>
          <h1>{t.orderHistory.title}</h1>
          <p>{t.orderHistory.intro}</p>
        </div>
      </section>
      <section className="page-container section track-page">
        {loadingHistory ? <p className="muted">{t.track.searching}</p> : null}

        {payload ? (
          <div className="history-result" aria-live="polite">
            <h2>{t.orderHistory.ordersFor(payload.email)}</h2>
            {payload.orders.length ? (
              <ul className="history-list">
                {payload.orders.map((order) => (
                  <li key={order.id} className="history-item">
                    <div className="history-item__head">
                      <strong>{order.orderNumber}</strong>
                      <span className={`track-status track-status--${order.status.toLowerCase()}`}>{labelize(order.status)}</span>
                      <span className={`track-status track-status--${order.paymentStatus.toLowerCase()}`}>
                        {labelize(order.paymentStatus)}
                      </span>
                    </div>
                    <p className="muted">
                      {new Date(order.placedAt).toLocaleDateString()} · {t.orderHistory.itemCount(order.itemCount)} ·{" "}
                      {t.orderHistory.total} {formatUSD(order.total)}
                    </p>
                    <Link
                      className="text-button"
                      href={`/track?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(payload.email)}`}
                    >
                      {t.orderHistory.view}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t.orderHistory.empty}</p>
            )}
            <Link href="/shop" className="button" style={{ marginTop: 20 }}>
              {t.orderHistory.backToShop}
            </Link>
          </div>
        ) : null}

        {invalidToken ? (
          <p className="form-status form-status--error" role="alert">
            {t.orderHistory.invalid}
          </p>
        ) : null}

        {!payload && !loadingHistory ? (
          <form className="track-form" onSubmit={requestLink}>
            <div className="field">
              <label htmlFor="history-email">{t.orderHistory.email}</label>
              <input
                id="history-email"
                type="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (requestState !== "idle") setRequestState("idle");
                }}
                autoComplete="email"
              />
            </div>
            <button className="button" type="submit" disabled={requestState === "loading"}>
              {requestState === "loading" ? t.orderHistory.sending : t.orderHistory.submit}
            </button>
          </form>
        ) : null}

        {requestState === "sent" ? (
          <p className="form-status form-status--success" role="status">
            {t.orderHistory.sent}
          </p>
        ) : null}
        {requestState === "error" ? (
          <p className="form-status form-status--error" role="alert">
            {t.orderHistory.error}
          </p>
        ) : null}
      </section>
    </>
  );
}
