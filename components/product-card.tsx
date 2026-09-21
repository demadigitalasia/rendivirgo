"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/catalog";
import { formatUSD } from "@/lib/catalog";
import { useCart } from "@/components/providers";
import { HeartIcon } from "@/components/icons";
import { ProductArt } from "@/components/product-art";

const wishlistStorageKey = "rendi-virgo-wishlist";

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const unavailable = product.status !== "Available";
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(wishlistStorageKey) ?? "[]");
      setWishlisted(Array.isArray(saved) && saved.includes(product.id));
    } catch {
      setWishlisted(false);
    }
  }, [product.id]);

  const toggleWishlist = () => {
    const nextValue = !wishlisted;
    setWishlisted(nextValue);

    try {
      const saved = JSON.parse(window.localStorage.getItem(wishlistStorageKey) ?? "[]");
      const ids = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
      const updated = nextValue ? [...new Set([...ids, product.id])] : ids.filter((id) => id !== product.id);
      window.localStorage.setItem(wishlistStorageKey, JSON.stringify(updated));
    } catch {
      // Wishlist feedback remains available for the current session if storage is unavailable.
    }
  };

  return (
    <article className="product-card">
      <div className="product-card__visual">
        <Link href={`/shop/${product.categorySlug}/${product.slug}`} className="product-card__image-link">
          <ProductArt tone={product.tone} label={product.stoneType} />
          <span className={`status-badge status-badge--${product.status.toLowerCase()}`}>{product.status === "Available" ? "Available" : product.status}</span>
        </Link>
        <button className={`wishlist-button ${wishlisted ? "is-active" : ""}`} type="button" aria-pressed={wishlisted} aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`} onClick={toggleWishlist}><HeartIcon /></button>
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
