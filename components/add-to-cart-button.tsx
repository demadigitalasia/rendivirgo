"use client";

import { useState } from "react";
import type { Product } from "@/lib/catalog";
import { useCart } from "@/components/providers";

export function AddToCartButton({ product, variantId, variantName }: { product: Product; variantId?: string; variantName?: string }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);
  const unavailable = product.status !== "Available";

  return <button className="button button--primary button--full" type="button" disabled={unavailable} onClick={() => { addToCart(product, 1, variantId, variantName); setAdded(true); setTimeout(() => setAdded(false), 1800); }}>{unavailable ? product.status : added ? "Added to Cart" : "Add to Cart"}</button>;
}
