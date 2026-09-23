"use client";

import Link from "next/link";
import { use, useEffect } from "react";
import { formatDate, formatDateTime, formatUSD, useApi } from "@/components/admin/api";
import { Button, Card, Loading } from "@/components/admin/ui";
import "../../orders.css";

type InvoiceAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  countryCode: string | null;
};

type Invoice = {
  invoiceNumber: string;
  orderNumber: string;
  issuedAt: string;
  placedAt: string;
  currency: string;
  seller: { name: string; address: string; email: string; phone: string };
  buyer: { name: string; email: string; phone: string | null; address: InvoiceAddress };
  items: Array<{ name: string; sku: string | null; quantity: number; unitPrice: number; lineTotal: number }>;
  subtotal: number;
  discountCode: string | null;
  discountTotal: number;
  shippingName: string | null;
  shippingCost: number;
  taxTotal: number;
  total: number;
  refundedAmount: number;
  paymentStatus: string;
  paymentMethod: string | null;
  paidAt: string | null;
};

export default function AdminOrderInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const state = useApi<Invoice>(`/api/admin/orders/${id}/invoice`);
  const invoice = state.data;

  useEffect(() => {
    if (!invoice) return;
    const timer = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timer);
  }, [invoice]);

  const cityLine = invoice
    ? [invoice.buyer.address.city, invoice.buyer.address.state, invoice.buyer.address.postalCode].filter(Boolean).join(", ")
    : "";
  const countryLine = invoice
    ? [invoice.buyer.address.country, invoice.buyer.address.countryCode].filter(Boolean).join(" ")
    : "";

  return (
    <div className="rv-invoice">
      <div className="rv-invoice__actions">
        <Link className="rv-btn" href={`/admin/orders/${id}`}>
          Back to order
        </Link>
        <Button variant="primary" disabled={!invoice} onClick={() => window.print()}>
          Print
        </Button>
      </div>

      {state.loading && !invoice ? (
        <Card>
          <Loading label="Preparing invoice…" />
        </Card>
      ) : null}

      {state.error ? (
        <Card title="Could not load invoice">
          <p className="rv-error-text">{state.error}</p>
          <div style={{ marginTop: 14 }}>
            <Button onClick={state.refresh}>Try again</Button>
          </div>
        </Card>
      ) : null}

      {invoice ? (
        <article className="rv-invoice__sheet">
          <header className="rv-invoice__header">
            <div>
              <div className="rv-invoice__brand">{invoice.seller.name}</div>
              <div className="rv-invoice__seller">
                <div>{invoice.seller.address}</div>
                <div>{invoice.seller.email}</div>
                <div>{invoice.seller.phone}</div>
              </div>
            </div>
            <div className="rv-invoice__meta">
              <div className="rv-invoice__title">Invoice</div>
              <div>{invoice.invoiceNumber}</div>
              <div>Issued {formatDate(invoice.issuedAt)}</div>
              <div>Order placed {formatDate(invoice.placedAt)}</div>
            </div>
          </header>

          <section className="rv-invoice__parties">
            <div>
              <h3>Billed to</h3>
              <div>{invoice.buyer.name}</div>
              <div>{invoice.buyer.email}</div>
              {invoice.buyer.phone ? <div>{invoice.buyer.phone}</div> : null}
            </div>
            <div>
              <h3>Ship to</h3>
              {invoice.buyer.address.line1 ? <div>{invoice.buyer.address.line1}</div> : null}
              {invoice.buyer.address.line2 ? <div>{invoice.buyer.address.line2}</div> : null}
              {cityLine ? <div>{cityLine}</div> : null}
              {countryLine ? <div>{countryLine}</div> : null}
            </div>
          </section>

          <table className="rv-invoice__table">
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU</th>
                <th className="is-num">Qty</th>
                <th className="is-num">Unit price</th>
                <th className="is-num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={`${item.sku ?? item.name}-${index}`}>
                  <td>{item.name}</td>
                  <td>{item.sku ?? "—"}</td>
                  <td className="is-num">{item.quantity}</td>
                  <td className="is-num">{formatUSD(item.unitPrice)}</td>
                  <td className="is-num">{formatUSD(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="rv-invoice__totals">
            <div className="rv-invoice__totals-row">
              <span>Subtotal</span>
              <span>{formatUSD(invoice.subtotal)}</span>
            </div>
            {invoice.discountTotal ? (
              <div className="rv-invoice__totals-row">
                <span>Discount{invoice.discountCode ? ` (${invoice.discountCode})` : ""}</span>
                <span>-{formatUSD(invoice.discountTotal)}</span>
              </div>
            ) : null}
            <div className="rv-invoice__totals-row">
              <span>Shipping{invoice.shippingName ? ` — ${invoice.shippingName}` : ""}</span>
              <span>{formatUSD(invoice.shippingCost)}</span>
            </div>
            {invoice.taxTotal ? (
              <div className="rv-invoice__totals-row">
                <span>Tax</span>
                <span>{formatUSD(invoice.taxTotal)}</span>
              </div>
            ) : null}
            <div className="rv-invoice__totals-row rv-invoice__totals-row--grand">
              <span>Total</span>
              <span>{formatUSD(invoice.total)}</span>
            </div>
            {invoice.refundedAmount ? (
              <div className="rv-invoice__totals-row">
                <span>Refunded</span>
                <span>-{formatUSD(invoice.refundedAmount)}</span>
              </div>
            ) : null}
          </div>

          <footer className="rv-invoice__footer">
            <div>
              Payment: {invoice.paymentStatus}
              {invoice.paymentMethod ? ` · ${invoice.paymentMethod}` : ""}
              {invoice.paidAt ? ` · paid ${formatDateTime(invoice.paidAt)}` : ""}
            </div>
            <div>Thank you for shopping with {invoice.seller.name}.</div>
          </footer>
        </article>
      ) : null}
    </div>
  );
}
