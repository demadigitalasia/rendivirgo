"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DimensionsMm, Product } from "@/lib/catalog";
import { formatDimensions, formatUSD, maxQuantityFor } from "@/lib/catalog";
import { useCart, useCopy } from "@/components/providers";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { CloseIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { ProductReviews } from "@/components/product-reviews";

const fallbackImage = "/images/products/stone-moss.svg";

function packageDimensionsFor(dimensions: DimensionsMm): DimensionsMm {
  return {
    length: dimensions.length + 30,
    width: dimensions.width + 30,
    height: dimensions.height + 20,
  };
}

export function ProductDetailClient({ product, related = [] }: { product: Product; related?: Product[] }) {
  const t = useCopy();
  const images = product.images.length ? product.images : [fallbackImage];
  const initialVariant = product.variants?.[0];
  const [variantId, setVariantId] = useState(initialVariant?.id);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const lightboxRef = useRef<HTMLDivElement>(null);
  const shareTimer = useRef<number | undefined>(undefined);
  const { quantityInCart } = useCart();
  const variant = product.variants?.find((item) => item.id === variantId);
  const selectedWeight = variant?.weightGram ?? product.weightGram;
  const selectedDimensions = variant?.dimensionsMm ?? product.dimensionsMm;
  const packageWeight = variant ? selectedWeight + 45 : product.shipping.packageWeightGram;
  const packageDimensions = variant ? packageDimensionsFor(selectedDimensions) : product.shipping.packageDimensionsMm;
  const maxQuantity = maxQuantityFor(product, variant?.id);
  const inCart = quantityInCart(product.id, variant?.id);
  const selectedProduct = variant
    ? { ...product, price: variant.price, weightGram: variant.weightGram, dimensionsMm: variant.dimensionsMm }
    : product;
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
  const imageAlt = (index: number) => `${product.name} — ${product.stoneType} from ${product.origin}, view ${index + 1}`;

  const moveImage = (direction: number) => {
    setActiveImageIndex((current) => (current + direction + images.length) % images.length);
  };

  const openLightbox = (index = activeImageIndex) => {
    setActiveImageIndex(index);
    setLightboxOpen(true);
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft") moveImage(-1);
      if (event.key === "ArrowRight") moveImage(1);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => lightboxRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [lightboxOpen, images.length]);

  useEffect(() => () => window.clearTimeout(shareTimer.current), []);

  const shareProduct = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: product.description, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareMessage(t.product.copied);
      shareTimer.current = window.setTimeout(() => setShareMessage(""), 2200);
    } catch {
      setShareMessage(t.product.shareUnavailable);
      shareTimer.current = window.setTimeout(() => setShareMessage(""), 3200);
    }
  };

  const conditionNote =
    product.condition === "Natural"
      ? t.product.conditionNaturalNote
      : product.condition === "Treated"
        ? t.product.conditionTreatedNote
        : t.product.conditionDyedNote;

  return (
    <>
      <div className="page-container product-breadcrumb">
        <nav aria-label="Breadcrumb">
          <Link href="/">{t.product.breadcrumbHome}</Link>
          <span aria-hidden="true">/</span>
          <Link href="/shop">{t.product.breadcrumbShop}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/shop/${product.categorySlug}`}>{product.category}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>
      </div>

      <div className="page-container product-detail">
        <section className="product-gallery" aria-label={t.product.galleryLabel}>
          <button
            className="product-gallery__hero"
            type="button"
            onClick={() => openLightbox()}
            aria-label={t.product.openImage(product.name, activeImageIndex + 1)}
          >
            <Image
              src={images[activeImageIndex]}
              alt={imageAlt(activeImageIndex)}
              width={900}
              height={900}
              priority
              sizes="(max-width: 720px) 100vw, 58vw"
            />
            <span className="product-gallery__zoom" aria-hidden="true">+</span>
          </button>
          {images.length > 1 ? (
            <div className="product-gallery__thumbs">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  className={`product-gallery__thumb ${activeImageIndex === index ? "is-active" : ""}`}
                  type="button"
                  aria-label={t.product.openImage(product.name, index + 1)}
                  aria-pressed={activeImageIndex === index}
                  onClick={() => setActiveImageIndex(index)}
                >
                  <Image src={image} alt="" width={120} height={120} sizes="80px" />
                </button>
              ))}
            </div>
          ) : null}
          <p className="product-gallery__hint">{t.product.zoomHint}</p>
        </section>

        <div className="product-detail__info">
          <div className="product-detail__meta">
            <div className="eyebrow">
              {product.category} · {product.sku}
            </div>
            <span className={`status-badge status-badge--${product.status.toLowerCase()}`}>
              {product.status === "Sold" ? t.common.sold : product.status === "Reserved" ? t.common.reserved : t.common.available}
            </span>
          </div>
          <h1>{product.name}</h1>
          <div className="product-detail__price">{formatUSD(selectedProduct.price)}</div>
          <p className="product-detail__stock">{stockMessage}</p>
          <p className="product-detail__description">{product.description}</p>

          {product.variants?.length ? (
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
          ) : null}

          <div className="product-detail__actions">
            <AddToCartButton product={selectedProduct} variantId={variant?.id} variantName={variant?.name} />
            <button className="button button--outline button--full" type="button" onClick={shareProduct}>
              {shareMessage || t.product.share}
            </button>
          </div>
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
              <span>{selectedWeight} g</span>
            </li>
            {product.mohsHardness ? (
              <li>
                <span>{t.product.specHardness}</span>
                <span>{product.mohsHardness}</span>
              </li>
            ) : null}
            <li>
              <span>{t.product.specDimensions}</span>
              <span>{formatDimensions(selectedDimensions)}</span>
            </li>
            <li>
              <span>{t.product.specCondition}</span>
              <span>{conditionLabel}</span>
            </li>
          </ul>
          {inCart > 0 ? <p className="product-detail__note">{t.common.inCart}</p> : null}
        </div>
      </div>

      <section className="page-container product-detail__accordions" aria-label={t.product.detailsTitle}>
        <details open>
          <summary>{t.product.detailsDescription}</summary>
          <div className="product-detail__accordion-body">
            <p>{product.description}</p>
            <p className="product-detail__note">SKU: {variant?.sku ?? product.sku}</p>
          </div>
        </details>
        <details>
          <summary>{t.product.conditionTitle}</summary>
          <div className="product-detail__accordion-body">
            <p>{conditionNote}</p>
            <p className="product-detail__note">{t.product.noConditionNote}</p>
            {product.fragile ? <p className="product-detail__note">{t.product.fragileNote}</p> : null}
          </div>
        </details>
        <details>
          <summary>{t.product.shippingTitle}</summary>
          <div className="product-detail__accordion-body">
            <p>{t.product.shippingIntro}</p>
            <dl className="shipping-facts">
              <div>
                <dt>{t.product.shippingWeight}</dt>
                <dd>{packageWeight} g</dd>
              </div>
              <div>
                <dt>{t.product.shippingDimensions}</dt>
                <dd>{formatDimensions(packageDimensions)}</dd>
              </div>
              <div>
                <dt>{t.product.shippingClass}</dt>
                <dd>{product.shipping.shippingClass}</dd>
              </div>
            </dl>
            <p className="product-detail__note">{t.product.shippingWorldwide}</p>
            <p className="product-detail__note">
              <Link href="/shipping-returns" className="text-button">{t.product.returnsNote}</Link>
            </p>
          </div>
        </details>
      </section>

      <ProductReviews slug={product.slug} />

      {related.length ? (
        <section className="page-container product-detail__related">
          <div className="section-heading">
            <h2>{t.product.relatedTitle}</h2>
          </div>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}

      {lightboxOpen ? (
        <div className="product-lightbox" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setLightboxOpen(false)}>
          <div className="product-lightbox__dialog" role="dialog" aria-modal="true" aria-label={t.product.galleryLabel} tabIndex={-1} ref={lightboxRef}>
            <div className="product-lightbox__toolbar">
              <span>{activeImageIndex + 1} / {images.length}</span>
              <button className="icon-button" type="button" aria-label={t.product.closeGallery} onClick={() => setLightboxOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <button className="product-lightbox__nav product-lightbox__nav--previous" type="button" aria-label={t.product.previousImage} onClick={() => moveImage(-1)}>
              ‹
            </button>
            <Image
              className="product-lightbox__image"
              src={images[activeImageIndex]}
              alt={imageAlt(activeImageIndex)}
              width={1400}
              height={1400}
              sizes="90vw"
            />
            <button className="product-lightbox__nav product-lightbox__nav--next" type="button" aria-label={t.product.nextImage} onClick={() => moveImage(1)}>
              ›
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
