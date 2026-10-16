"use client";

import { formatUSD } from "@/lib/catalog";
import { useCopy, useLanguage } from "@/components/providers";
import type { CheckoutPriceQuote } from "./types";

type CheckoutPriceReviewProps = {
  quote: CheckoutPriceQuote;
  placing: boolean;
  onAccept: () => void;
  onCancel: () => void;
};

export function CheckoutPriceReview({ quote, placing, onAccept, onCancel }: CheckoutPriceReviewProps) {
  const t = useCopy();
  const { language } = useLanguage();

  return (
    <section className="checkout-price-review" aria-labelledby="checkout-price-review-title" role="status" aria-live="polite">
      <h3 id="checkout-price-review-title">{t.checkout.priceChanged}</h3>
      <p>{t.checkout.priceChangedBody}</p>
      <dl className="checkout-price-review__details">
        <div><dt>{t.checkout.subtotal}</dt><dd>{formatUSD(quote.subtotal, language)}</dd></div>
        <div><dt>{t.checkout.shipping}</dt><dd>{formatUSD(quote.shippingCost, language)}</dd></div>
        <div><dt>{t.checkout.discountTotal}</dt><dd>{formatUSD(quote.discountTotal, language)}</dd></div>
        <div><dt>{t.checkout.total}</dt><dd><strong>{formatUSD(quote.total, language)}</strong></dd></div>
      </dl>
      <div className="checkout-price-review__actions">
        <button type="button" className="button" disabled={placing} onClick={onAccept}>
          {t.checkout.acceptPrice}
        </button>
        <button type="button" className="text-button" onClick={onCancel}>
          {t.checkout.cancelPriceReview}
        </button>
      </div>
    </section>
  );
}
