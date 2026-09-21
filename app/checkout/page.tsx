"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/components/providers";
import { formatUSD } from "@/lib/catalog";

const countries = ["United States", "United Kingdom", "Australia", "Canada", "Singapore", "Japan", "Indonesia", "Other"];

export default function CheckoutPage() {
  const { lines, subtotal, clearCart } = useCart();
  const [country, setCountry] = useState("United States");
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [override, setOverride] = useState("48");
  const [paid, setPaid] = useState(false);
  const totalWeight = lines.reduce((sum, line) => sum + line.weightGram * line.quantity, 0);
  const apiShipping = totalWeight > 500 ? 76 : totalWeight > 200 ? 58 : 42;
  const shipping = overrideEnabled ? Math.max(0, Number(override) || 0) : apiShipping;
  const total = subtotal + shipping;
  const canPay = Boolean(lines.length);
  const paymentMessage = useMemo(() => country === "Indonesia" ? "PayPal will process this order in USD." : "International PayPal checkout is ready for this destination.", [country]);

  if (!lines.length && !paid) return <div className="page-container content-page"><div className="eyebrow">Checkout</div><h1>Your cart is empty.</h1><p className="muted" style={{ margin: "18px 0 26px" }}>Choose a stone before opening checkout.</p><Link href="/shop" className="button">Browse the collection</Link></div>;
  if (paid) return <div className="page-container content-page"><div className="success-state"><div className="eyebrow">Payment received</div><h2>Thank you for your order.</h2><p>Your PayPal payment is marked successful in this prototype. Stock is now considered committed for this order.</p><Link href="/shop" className="button" style={{ marginTop: 20 }}>Continue exploring</Link></div></div>;

  return <div className="page-container content-page"><div className="content-page__intro"><div className="eyebrow">Secure checkout preview</div><h1>From Indonesia to your door.</h1><p>Shipping is calculated as one package by total weight. The admin dashboard can override the API rate when needed.</p></div><div className="checkout-layout"><form className="checkout-form" onSubmit={(event) => { event.preventDefault(); if (canPay) { setPaid(true); clearCart(); } }}><div className="field-grid"><div className="field"><label htmlFor="first-name">First name</label><input id="first-name" required placeholder="Your first name" /></div><div className="field"><label htmlFor="last-name">Last name</label><input id="last-name" required placeholder="Your last name" /></div></div><div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" required placeholder="you@example.com" /></div><div className="field"><label htmlFor="address">Shipping address</label><textarea id="address" required placeholder="Street, city, postal code" /></div><div className="field"><label htmlFor="country">Country</label><select id="country" value={country} onChange={(event) => setCountry(event.target.value)}>{countries.map((item) => <option key={item}>{item}</option>)}</select></div><div className="payment-box"><strong>PayPal</strong><span>{paymentMessage} This button is a frontend-only payment simulation until the backend and PayPal API are connected.</span></div><button className="button button--full" type="submit">Pay {formatUSD(total)} with PayPal</button></form><aside className="summary-card"><h2>Order summary</h2>{lines.map((line) => <div className="summary-row" key={`${line.id}:${line.variantId ?? "base"}`}><span>{line.name} × {line.quantity}</span><strong>{formatUSD(line.price * line.quantity)}</strong></div>)}<div className="summary-row"><span>Total weight</span><span>{totalWeight} g</span></div><div className="summary-row"><span>Shipping</span><strong>{formatUSD(shipping)}</strong></div><div className="summary-row summary-row--total"><span>Total</span><strong>{formatUSD(total)}</strong></div><p className="product-detail__note">Shipping source: {overrideEnabled ? "Admin override" : "API default"}</p></aside></div></div>;
}
