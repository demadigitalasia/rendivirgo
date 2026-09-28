"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCopy } from "@/components/providers";
import { formatUSD } from "@/lib/catalog";

type TrackedItem = {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl: string | null;
};

type TrackedOrder = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  total: number;
  customerName: string;
  shippingName: string | null;
  items: TrackedItem[];
  tracking: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null };
  shippingAddress: { city: string | null; state: string | null; postalCode: string | null; country: string | null };
  placedAt: string;
  paidAt: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};

const labelize = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2");

export function OrderTracking() {
  const t = useCopy();
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "notFound">("idle");
  const autoChecked = useRef(false);

  const lookup = async (number: string, address: string) => {
    setStatus("loading");
    setOrder(null);
    try {
      const response = await fetch(
        `/api/orders/track/${encodeURIComponent(number.trim())}?email=${encodeURIComponent(address.trim())}`,
        { headers: { accept: "application/json" } },
      );
      if (response.status === 404) {
        setStatus("notFound");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setOrder((await response.json()) as TrackedOrder);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    if (autoChecked.current) return;
    const number = searchParams.get("order");
    const address = searchParams.get("email");
    if (!number || !address) return;
    autoChecked.current = true;
    setOrderNumber(number);
    setEmail(address);
    void lookup(number, address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const timeline = order
    ? ([
        [t.track.placedAt, order.placedAt],
        [t.track.paidAt, order.paidAt],
        [t.track.packedAt, order.packedAt],
        [t.track.shippedAt, order.shippedAt],
        [t.track.completedAt, order.completedAt],
        [t.track.cancelledAt, order.cancelledAt],
      ].filter(([, date]) => Boolean(date)) as Array<[string, string]>)
    : [];

  return (
    <>
      <section className="page-hero">
        <div className="page-container">
          <div className="eyebrow eyebrow--light">{t.track.eyebrow}</div>
          <h1>{t.track.title}</h1>
          <p>{t.track.intro}</p>
        </div>
      </section>
      <section className="page-container section track-page">
        <form
          className="track-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (status !== "loading" && orderNumber.trim() && email.trim()) void lookup(orderNumber, email);
          }}
        >
          <div className="field">
            <label htmlFor="track-order">{t.track.orderNumber}</label>
            <input
              id="track-order"
              name="order"
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value.toUpperCase())}
              placeholder={t.track.orderNumberPlaceholder}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="track-email">{t.track.email}</label>
            <input
              id="track-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <button className="button" type="submit" disabled={status === "loading"}>
            {status === "loading" ? t.track.searching : t.track.submit}
          </button>
        </form>

        {status === "notFound" ? (
          <p className="form-status form-status--error" role="alert">
            {t.track.notFound}
          </p>
        ) : null}
        {status === "error" ? (
          <p className="form-status form-status--error" role="alert">
            {t.track.error}
          </p>
        ) : null}

        {order ? (
          <div className="track-result" aria-live="polite">
            <div className="track-result__head">
              <div>
                <div className="eyebrow">{t.track.eyebrow}</div>
                <h2>{order.orderNumber}</h2>
                <p className="muted">
                  {order.customerName} · {new Date(order.placedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="track-badges">
                <span className={`track-status track-status--${order.status.toLowerCase()}`}>{labelize(order.status)}</span>
                <span className={`track-status track-status--${order.paymentStatus.toLowerCase()}`}>
                  {labelize(order.paymentStatus)}
                </span>
              </div>
            </div>

            {order.tracking.trackingNumber ? (
              <div className="track-card">
                <strong>{t.track.trackingNumber}</strong>
                <span>
                  {order.tracking.carrier ? `${order.tracking.carrier} · ` : ""}
                  {order.tracking.trackingNumber}
                </span>
                {order.tracking.trackingUrl ? (
                  <a className="text-button" href={order.tracking.trackingUrl} target="_blank" rel="noreferrer noopener">
                    {t.track.openTracking}
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="track-grid">
              <div className="track-card">
                <strong>{t.track.items}</strong>
                <ul className="track-items">
                  {order.items.map((item, index) => (
                    <li key={`${item.sku}-${index}`}>
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <strong>{formatUSD(item.lineTotal)}</strong>
                    </li>
                  ))}
                </ul>
                <div className="track-totals">
                  <span>
                    {t.track.subtotal} <strong>{formatUSD(order.subtotal)}</strong>
                  </span>
                  {order.discountTotal > 0 ? (
                    <span>
                      {t.track.discount} <strong>−{formatUSD(order.discountTotal)}</strong>
                    </span>
                  ) : null}
                  <span>
                    {t.track.shipping} <strong>{order.shippingCost === 0 ? "—" : formatUSD(order.shippingCost)}</strong>
                  </span>
                  <span className="track-totals__total">
                    {t.track.total} <strong>{formatUSD(order.total)}</strong>
                  </span>
                </div>
              </div>

              <div className="track-card">
                <strong>{t.track.timeline}</strong>
                <ol className="track-timeline">
                  {timeline.map(([label, date]) => (
                    <li key={label}>
                      <span>{label}</span>
                      <span>{new Date(date).toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
                {order.shippingAddress.country ? (
                  <p className="muted" style={{ marginTop: 10 }}>
                    {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.country]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            </div>

            <Link href="/shop" className="button" style={{ marginTop: 22 }}>
              {t.track.backToShop}
            </Link>
          </div>
        ) : null}
      </section>
    </>
  );
}
