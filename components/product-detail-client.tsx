"use client";

import { useState } from "react";
import type { Product } from "@/lib/catalog";
import { formatDimensions, formatUSD, maxQuantityFor } from "@/lib/catalog";
import { useCart, useCopy } from "@/components/providers";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ProductCard } from "@/components/product-card";

export function ProductDetailClient({ product, related = [] }: { product: Product; related?: Product[] }) {
  const t = useCopy();
  const initialVariant = product.variants?.[0];
  const [variantId, setVariantId] = useState(initialVariant?.id);
  const { quantityInCart } = useCart();
  const variant = product.variants?.find((item) => item.id === variantId);
  const selectedProduct = variant ? { ...product, price: variant.price, weightGram: variant.weightGram } : product;
  const maxQuantity = maxQuantityFor(product, variant?.id);
  const inCart = quantityInCart(product.id, variant?.id);
  const conditionLabel =
    product.condition === "Natural"
      ? t.product.conditionNatural
      : product.condition === "Treated"
        ? t.product.conditionTreated
        : t.product.conditionDyed;
  const stockMessage =
    product.status === "Sold"
      ? t.product.stockSold
      : product.status === "Reserved"
        ? t.product.stockReserved
        : maxQuantity === 1
          ? t.product.stockOne
          : t.product.stockMany(maxQuantity);

  return (
    <>
      <div className="page-container product-detail">
        <div>
        <img
          className="product-detail__image"
          src={product.images[0]}
          alt={`${product.name} — ${product.stoneType} from ${product.origin}`}
          width={800}
          height={800}
        />
      </div>
      <div className="product-detail__info">
        <div className="eyebrow">
          {product.category} · {product.sku}
        </div>
        <h1>{product.name}</h1>
        <div className="product-detail__price">{formatUSD(selectedProduct.price)}</div>
        <p className="product-detail__stock">{stockMessage}</p>
        <p className="product-detail__description">{product.description}</p>
        {product.variants && (
          <div className="variant-picker">
            <span className="variant-picker__label">{t.product.format}</span>
            <div className="variant-options">
              {product.variants.map((item) => (
                <button
                  key={item.id}
                  className={variantId === item.id ? "is-selected" : ""}
                  type="button"
                  aria-pressed={variantId === item.id}
                  onClick={() => setVariantId(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <AddToCartButton product={selectedProduct} variantId={variant?.id} variantName={variant?.name} />
        <p className="product-detail__note">{t.product.stockNote}</p>
        <ul className="detail-list">
          <li>
            <span>{t.product.specStone}</span>
            <span>{product.stoneType}</span>
          </li>
          <li>
            <span>{t.product.specOrigin}</span>
            <span>{product.origin}</span>
          </li>
          <li>
            <span>{t.product.specWeight}</span>
            <span>{selectedProduct.weightGram} g</span>
          </li>
          <li>
            <span>{t.product.specDimensions}</span>
            <span>{formatDimensions(product.dimensionsMm)}</span>
          </li>
          <li>
            <span>{t.product.specCondition}</span>
            <span>{conditionLabel}</span>
          </li>
        </ul>
        {inCart > 0 && <p className="product-detail__note">{t.common.inCart}</p>}
        </div>
      </div>
      {related.length ? (
        <section className="page-container product-detail__related">
          <div className="section-heading">
            <h2>{t.home.stonesTitle}</h2>
          </div>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
