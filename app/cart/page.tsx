"use client";

import Link from "next/link";
import { ProductArt } from "@/components/product-art";
import { useCart } from "@/components/providers";
import { formatUSD } from "@/lib/catalog";

export default function CartPage() {
  const { lines, subtotal, removeFromCart, updateQuantity } = useCart();
  const keyFor = (line: (typeof lines)[number]) => `${line.id}:${line.variantId ?? "base"}`;
  if (!lines.length) return <div className="page-container content-page"><div className="eyebrow">Your selection</div><h1>Your cart is waiting.</h1><p className="muted" style={{ margin: "18px 0 26px" }}>Add a natural stone from the collection and return here when you are ready.</p><Link href="/shop" className="button">Explore the collection</Link></div>;

  return <div className="page-container content-page"><div className="content-page__intro"><div className="eyebrow">Your selection</div><h1>Shopping cart</h1><p>Review your stones before continuing to worldwide shipping and PayPal checkout.</p></div><div className="cart-layout"><div>{lines.map((line) => { const key = keyFor(line); return <article className="cart-line" key={key}><div className="cart-line__art"><ProductArt tone={line.tone} label={line.stoneType} /></div><div><h3>{line.name}</h3><div className="cart-line__meta">{line.variantName ?? line.category} · {line.weightGram} g</div><div className="cart-line__meta">{formatUSD(line.price)} each</div></div><div className="cart-line__actions"><div className="quantity-control"><button type="button" onClick={() => updateQuantity(key, line.quantity - 1)} aria-label="Decrease quantity">−</button><span>{line.quantity}</span><button type="button" onClick={() => updateQuantity(key, line.quantity + 1)} aria-label="Increase quantity">+</button></div><strong>{formatUSD(line.price * line.quantity)}</strong><button className="text-button" type="button" onClick={() => removeFromCart(key)}>Remove</button></div></article>; })}</div><aside className="summary-card"><h2>Order summary</h2><div className="summary-row"><span>Subtotal</span><strong>{formatUSD(subtotal)}</strong></div><div className="summary-row"><span>Shipping</span><span>Calculated next</span></div><div className="summary-row summary-row--total"><span>Total before shipping</span><strong>{formatUSD(subtotal)}</strong></div><Link href="/checkout" className="button button--full" style={{ marginTop: 20 }}>Continue to checkout</Link></aside></div></div>;
}
