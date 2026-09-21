"use client";

import { useState } from "react";
import type { Product } from "@/lib/catalog";
import { formatUSD } from "@/lib/catalog";
import { useCart } from "@/components/providers";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ProductArt } from "@/components/product-art";

export function ProductDetailClient({ product }: { product: Product }) {
  const initialVariant = product.variants?.[0];
  const [variantId, setVariantId] = useState(initialVariant?.id);
  const { addToCart } = useCart();
  const variant = product.variants?.find((item) => item.id === variantId);
  const selectedProduct = variant ? { ...product, price: variant.price, weightGram: variant.weightGram } : product;

  return (
    <div className="page-container product-detail">
      <div><ProductArt tone={product.tone} label={product.stoneType} large /></div>
      <div className="product-detail__info">
        <div className="eyebrow">{product.category} · {product.sku}</div>
        <h1>{product.name}</h1>
        <div className="product-detail__price">{formatUSD(selectedProduct.price)}</div>
        <p className="product-detail__description">{product.description}</p>
        {product.variants && <div className="variant-picker"><span className="variant-picker__label">Choose a format</span><div className="variant-options">{product.variants.map((item) => <button key={item.id} className={variantId === item.id ? "is-selected" : ""} type="button" onClick={() => setVariantId(item.id)}>{item.name}</button>)}</div></div>}
        <AddToCartButton product={selectedProduct} variantId={variant?.id} variantName={variant?.name} />
        <p className="product-detail__note">Stock is held for your cart until PayPal payment is successfully completed.</p>
        <ul className="detail-list">
          <li><span>Stone type</span><span>{product.stoneType}</span></li>
          <li><span>Origin</span><span>{product.origin}</span></li>
          <li><span>Weight</span><span>{selectedProduct.weightGram} g</span></li>
          <li><span>Dimensions</span><span>{product.dimensions}</span></li>
          <li><span>Condition</span><span>{product.condition}</span></li>
        </ul>
        <button className="text-button" type="button" onClick={() => addToCart(selectedProduct, 1, variant?.id, variant?.name)}>Add another to cart</button>
      </div>
    </div>
  );
}
