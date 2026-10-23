"use client";

import Image from "next/image";
import { MinusIcon, PlusIcon } from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import Link from "@/components/localized-link";
import { ProductArt } from "@/components/product-art";
import { cartLineKey, useCart, useCopy, useLanguage } from "@/components/providers";
import { formatUSD } from "@/lib/catalog";

export function CartView() {
  const t = useCopy();
  const { language } = useLanguage();
  const { lines, hydrated, removeFromCart, updateQuantity, clearCart } = useCart();
  const hasWholesaleLines = lines.some((line) => line.wholesale === true);
  const [wholesaleAccessChecked, setWholesaleAccessChecked] = useState(false);
  const wholesaleCheckStarted = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!hasWholesaleLines) {
      setWholesaleAccessChecked(true);
      return;
    }
    if (wholesaleCheckStarted.current) return;
    wholesaleCheckStarted.current = true;
    void fetch("/api/customer-account/me", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const customer = await response.json().catch(() => ({}));
        if (!response.ok || customer?.wholesaleAccess !== true) {
          clearCart("wholesale");
          return;
        }
        setWholesaleAccessChecked(true);
      })
      .catch(() => clearCart("wholesale"));
  }, [clearCart, hasWholesaleLines, hydrated]);

  const retailLines = lines.filter((line) => line.wholesale !== true);
  const wholesaleLines = lines.filter((line) => line.wholesale === true);
  const lineSubtotal = (items: typeof lines) => items.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const lineWeight = (items: typeof lines) => items.reduce((sum, line) => sum + line.weightGram * line.quantity, 0);

  const renderLines = (items: typeof lines) => items.map((line) => {
    const key = cartLineKey(line);
    const uniqueLine = line.maxQuantity === 1;
    return (
      <article className="cart-line" key={key}>
        <div className="cart-line__art">
          {line.images[0] ? (
            <Image className="cart-line__photo" src={line.images[0]} alt={`${line.name} — ${line.stoneType}`} width={160} height={160} sizes="110px" />
          ) : (
            <ProductArt tone={line.tone} label={line.stoneType} />
          )}
        </div>
        <div>
          <h3>{line.name}</h3>
          <div className="cart-line__meta">{line.variantName ?? line.category} · {line.weightGram} g</div>
          <div className="cart-line__meta">{formatUSD(line.price, language)} {t.cart.each}</div>
        </div>
        <div className="cart-line__actions">
          {uniqueLine ? (
            <span className="cart-line__unique">{t.cart.uniqueNote}</span>
          ) : (
            <div className="quantity-control">
              <button type="button" onClick={() => updateQuantity(key, line.quantity - 1)} aria-label={t.cart.decrease}><MinusIcon size={15} /></button>
              <span>{line.quantity}</span>
              <button type="button" disabled={line.quantity >= line.maxQuantity} onClick={() => updateQuantity(key, line.quantity + 1)} aria-label={t.cart.increase}><PlusIcon size={15} /></button>
            </div>
          )}
          <strong>{formatUSD(line.price * line.quantity, language)}</strong>
          <button className="text-button" type="button" onClick={() => removeFromCart(key)}>{t.cart.remove}</button>
        </div>
      </article>
    );
  });

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

  if (hasWholesaleLines && !wholesaleAccessChecked) {
    return <div className="page-container content-page"><p role="status">Checking Wholesale account access…</p></div>;
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
          {retailLines.length ? <section className="cart-channel"><h2>{language === "id" ? "Barang retail" : "Retail items"}</h2>{renderLines(retailLines)}</section> : null}
          {wholesaleLines.length ? <section className="cart-channel"><h2>Wholesale items</h2>{renderLines(wholesaleLines)}</section> : null}
        </div>
        <div className="cart-channel-summaries">
          {retailLines.length ? (
            <aside className="summary-card">
              <h2>{language === "id" ? "Checkout retail" : "Retail checkout"}</h2>
              <div className="summary-row"><span>{t.cart.subtotal}</span><strong>{formatUSD(lineSubtotal(retailLines), language)}</strong></div>
              <div className="summary-row"><span>{t.cart.totalWeight}</span><span>{t.checkout.weightUnit(lineWeight(retailLines))}</span></div>
              <div className="summary-row"><span>{t.cart.shipping}</span><span>{t.cart.shippingNext}</span></div>
              <div className="summary-row summary-row--total"><span>{t.cart.totalBefore}</span><strong>{formatUSD(lineSubtotal(retailLines), language)}</strong></div>
              <Link href="/checkout" className="button button--full" style={{ marginTop: 20 }}>{t.cart.checkout}</Link>
            </aside>
          ) : null}
          {wholesaleLines.length ? (
            <aside className="summary-card">
              <h2>{language === "id" ? "Checkout Wholesale" : "Wholesale checkout"}</h2>
              <div className="summary-row"><span>{t.cart.subtotal}</span><strong>{formatUSD(lineSubtotal(wholesaleLines), language)}</strong></div>
              <div className="summary-row"><span>{t.cart.totalWeight}</span><span>{t.checkout.weightUnit(lineWeight(wholesaleLines))}</span></div>
              <div className="summary-row"><span>{t.cart.shipping}</span><span>{t.cart.shippingNext}</span></div>
              <div className="summary-row summary-row--total"><span>{t.cart.totalBefore}</span><strong>{formatUSD(lineSubtotal(wholesaleLines), language)}</strong></div>
              <Link href="/wholesale/checkout" className="button button--full" style={{ marginTop: 20 }}>{language === "id" ? "Lanjut ke checkout Wholesale" : "Continue to Wholesale checkout"}</Link>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
