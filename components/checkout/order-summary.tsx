"use client";

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
      <h2>{t.checkout.summary}</h2>
      <Link href={editHref} className="text-button checkout-summary__edit">{t.checkout.editCart}</Link>
      {lines.map((line) => (
        <div className="summary-row" key={line.id + ":" + (line.variantId ?? "base")}>
          <span>
            {line.name}{line.variantName ? " — " + line.variantName : ""} × {line.quantity}
          </span>
          <strong>{formatUSD(line.price * line.quantity, language)}</strong>
        </div>
      ))}
      <div className="summary-row">
        <span>{t.checkout.subtotal}</span>
        <strong>{formatUSD(subtotal, language)}</strong>
      </div>
      <div className="summary-row">
        <span>{t.checkout.totalWeight}</span>
        <span>{t.checkout.weightUnit(totalWeight)}</span>
      </div>
      {discountTotal > 0 ? (
        <div className="summary-row">
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
      <div className="summary-row summary-row--total">
        <span>{t.checkout.total}</span>
        <strong>{totalIsKnown ? formatUSD(total, language) : t.checkout.totalAfterShipping}</strong>
      </div>
    </section>
  );
}
