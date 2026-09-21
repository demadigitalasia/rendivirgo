"use client";

import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { formatUSD } from "@/lib/catalog";
import { useCart } from "@/components/providers";
import { HeartIcon } from "@/components/icons";
import { ProductArt } from "@/components/product-art";

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const unavailable = product.status !== "Available";

  return (
    <article className="product-card">
      <div className="product-card__visual">
        <Link href={`/shop/${product.categorySlug}/${product.slug}`} className="product-card__image-link">
          <ProductArt tone={product.tone} label={product.stoneType} />
          <span className={`status-badge status-badge--${product.status.toLowerCase()}`}>{product.status === "Available" ? "Available" : product.status}</span>
        </Link>
        <button className="wishlist-button" type="button" aria-label={`Add ${product.name} to wishlist`}><HeartIcon /></button>
      </div>
      <div className="product-card__body">
        <div className="eyebrow">{product.category} · {product.origin.split(",")[0]}</div>
        <Link href={`/shop/${product.categorySlug}/${product.slug}`} className="product-card__name">{product.name}</Link>
        <div className="product-card__footer">
          <strong>{formatUSD(product.price)}</strong>
          <button className="text-button" type="button" disabled={unavailable} onClick={() => addToCart(product)}>{unavailable ? product.status : "Add to cart"}</button>
        </div>
      </div>
    </article>
  );
}
