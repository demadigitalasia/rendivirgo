"use client";

import Link from "next/link";
import { ProductArt } from "@/components/product-art";
import { cartLineKey, useCart, useCopy } from "@/components/providers";
import { formatUSD } from "@/lib/catalog";

export function CartView() {
  const t = useCopy();
  const { lines, subtotal, totalWeight, removeFromCart, updateQuantity } = useCart();

  if (!lines.length) {
    return (
      <div className="page-container content-page">
        <div className="eyebrow">{t.cart.eyebrow}</div>
        <h1>{t.cart.emptyTitle}</h1>
        <p className="muted" style={{ margin: "18px 0 26px" }}>
          {t.cart.emptyBody}
        </p>
        <Link href="/shop" className="button">
          {t.cart.browse}
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container content-page">
      <div className="content-page__intro">
        <div className="eyebrow">{t.cart.eyebrow}</div>
        <h1>{t.cart.title}</h1>
        <p>{t.cart.intro}</p>
      </div>
      <div className="cart-layout">
        <div>
          {lines.map((line) => {
            const key = cartLineKey(line);
            const uniqueLine = line.maxQuantity === 1;
            return (
              <article className="cart-line" key={key}>
                <div className="cart-line__art">
                  <ProductArt tone={line.tone} label={line.stoneType} />
                </div>
                <div>
                  <h3>{line.name}</h3>
                  <div className="cart-line__meta">
                    {line.variantName ?? line.category} · {line.weightGram} g
                  </div>
                  <div className="cart-line__meta">
                    {formatUSD(line.price)} {t.cart.each}
                  </div>
                </div>
                <div className="cart-line__actions">
                  {uniqueLine ? (
                    <span className="cart-line__unique">{t.cart.uniqueNote}</span>
                  ) : (
                    <div className="quantity-control">
                      <button type="button" onClick={() => updateQuantity(key, line.quantity - 1)} aria-label={t.cart.decrease}>
                        −
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        type="button"
                        disabled={line.quantity >= line.maxQuantity}
                        onClick={() => updateQuantity(key, line.quantity + 1)}
                        aria-label={t.cart.increase}
                      >
                        +
                      </button>
                    </div>
                  )}
                  <strong>{formatUSD(line.price * line.quantity)}</strong>
                  <button className="text-button" type="button" onClick={() => removeFromCart(key)}>
                    {t.cart.remove}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <aside className="summary-card">
          <h2>{t.cart.summary}</h2>
          <div className="summary-row">
            <span>{t.cart.subtotal}</span>
            <strong>{formatUSD(subtotal)}</strong>
          </div>
          <div className="summary-row">
            <span>{t.cart.totalWeight}</span>
            <span>{t.checkout.weightUnit(totalWeight)}</span>
          </div>
          <div className="summary-row">
            <span>{t.cart.shipping}</span>
            <span>{t.cart.shippingNext}</span>
          </div>
          <div className="summary-row summary-row--total">
            <span>{t.cart.totalBefore}</span>
            <strong>{formatUSD(subtotal)}</strong>
          </div>
          <Link href="/checkout" className="button button--full" style={{ marginTop: 20 }}>
            {t.cart.checkout}
          </Link>
        </aside>
      </div>
    </div>
  );
}
