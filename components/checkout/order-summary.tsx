"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "@/components/localized-link";
import { formatUSD } from "@/lib/catalog";
import type { CartLine } from "@/components/providers";
import { useCopy, useLanguage } from "@/components/providers";
import type { Discount, ShippingOption } from "./types";

type CheckoutOrderSummaryProps = {
  className: string;
  lines: CartLine[];
  subtotal: number;
  totalWeight: number;
  discount: Discount | null;
  discountTotal: number;
  selectedOption: ShippingOption | null;
  shippingCost: number;
  total: number;
  totalIsKnown: boolean;
  editHref?: string;
};

export function CheckoutOrderSummary({
  className,
  lines,
  subtotal,
  totalWeight,
  discount,
  discountTotal,
  selectedOption,
  shippingCost,
  total,
  totalIsKnown,
  editHref = "/cart",
}: CheckoutOrderSummaryProps) {
  const t = useCopy();
  const { language } = useLanguage();

  return (
    <section className={"summary-card " + className}>
      <div className="checkout-summary__header">
        <h2>{t.checkout.summary}</h2>
        <Link href={editHref} className="checkout-summary__edit">
          <span>{t.checkout.editCart}</span>
          <ArrowUpRight className="rv-icon" size={15} strokeWidth={1.7} aria-hidden="true" />
        </Link>
      </div>
      <div className="checkout-summary__items" role="list">
        {lines.map((line) => (
          <div className="checkout-summary__item" role="listitem" key={line.id + ":" + (line.variantId ?? "base")}>
            <div className="checkout-summary__item-main">
              <span className="checkout-summary__item-name">
                {line.name}{line.variantName ? " — " + line.variantName : ""}
              </span>
              <span className="checkout-summary__quantity">× {line.quantity}</span>
            </div>
            <strong className="checkout-summary__item-price">{formatUSD(line.price * line.quantity, language)}</strong>
          </div>
        ))}
      </div>
      <div className="checkout-summary__totals">
        <div className="summary-row summary-row--subtotal">
          <span>{t.checkout.subtotal}</span>
          <strong>{formatUSD(subtotal, language)}</strong>
        </div>
        <div className="summary-row">
          <span>{t.checkout.totalWeight}</span>
          <span>{t.checkout.weightUnit(totalWeight)}</span>
        </div>
        {discountTotal > 0 ? (
          <div className="summary-row summary-row--discount">
            <span>{discount?.code}</span>
            <strong>−{formatUSD(discountTotal, language)}</strong>
          </div>
        ) : null}
        <div className="summary-row">
          <span>{t.checkout.shipping}</span>
          <strong>
            {selectedOption
              ? shippingCost === 0
                ? t.checkout.freeShipping
                : formatUSD(shippingCost, language)
              : t.checkout.calculatedShipping}
          </strong>
        </div>
      </div>
      <div className="summary-row summary-row--total">
        <span>{t.checkout.total}</span>
        <strong>{totalIsKnown ? formatUSD(total, language) : t.checkout.totalAfterShipping}</strong>
      </div>
    </section>
  );
}
