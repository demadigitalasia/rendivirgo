"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/catalog";
import { maxQuantityFor } from "@/lib/catalog";
import { useCart, useCopy } from "@/components/providers";

export function AddToCartButton({ product, variantId, variantName }: { product: Product; variantId?: string; variantName?: string }) {
  const t = useCopy();
  const { addToCart, quantityInCart } = useCart();
  const [added, setAdded] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const limit = maxQuantityFor(product, variantId);
  const inCart = quantityInCart(product.id, variantId);
  const unavailable = product.status !== "Available";
  const reached = inCart >= limit;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const label = unavailable
    ? product.status === "Sold"
      ? t.common.sold
      : t.common.reserved
    : reached
      ? limit === 1
        ? t.common.inCart
        : t.common.maxReached
      : added
        ? t.common.addedToCart
        : t.common.addToCart;

  return (
    <button
      className="button button--full"
      type="button"
      disabled={unavailable || reached}
      onClick={() => {
        addToCart(product, 1, variantId, variantName);
        setAdded(true);
        timer.current = window.setTimeout(() => setAdded(false), 1800);
      }}
    >
      {label}
    </button>
  );
}
