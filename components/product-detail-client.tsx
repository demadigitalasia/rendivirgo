"use client";

import Image from "next/image";
import Link from "@/components/localized-link";
import { useEffect, useRef, useState } from "react";
import type { DimensionsMm, Product } from "@/lib/catalog";
import { formatDimensions, formatUSD, maxQuantityFor } from "@/lib/catalog";
import { useCart, useCopy, useLanguage } from "@/components/providers";
import { Breadcrumb } from "@/components/breadcrumb";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ArrowIcon, ArrowUpRightIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, GlobeIcon, PlusIcon, ShareIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { ProductReviews } from "@/components/product-reviews";
import { ProductWatermark } from "@/components/product-watermark";
import "./product-detail.css";

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
  const { language } = useLanguage();
  const images = product.images.length ? product.images : [fallbackImage];
  const initialVariant = product.variants?.find((item) => item.stockQuantity > 0) ?? product.variants?.[0];
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
        : product.condition === "Dyed"
          ? t.product.conditionDyed
          : product.condition;
  const stockMessage =
    product.status === "Sold"
      ? t.product.stockSold
      : product.status === "Reserved"
        ? t.product.stockReserved
        : maxQuantity === 0
          ? t.common.outOfStock
        : maxQuantity === 1
          ? t.product.stockOne
          : t.product.stockMany(maxQuantity);
  const imageAlt = (index: number) =>
    product.imageAlts?.[index]?.trim() || `${product.name} — ${product.stoneType}${product.origin ? ` from ${product.origin}` : ""}, view ${index + 1}`;
  const descriptionParagraphs = product.description.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
  const introduction = descriptionParagraphs[0] ?? product.description;
  const titleBreak = product.name.lastIndexOf(" ");

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
    product.conditionNote || (product.condition === "Natural"
      ? t.product.conditionNaturalNote
      : product.condition === "Treated"
        ? t.product.conditionTreatedNote
        : product.condition === "Dyed"
          ? t.product.conditionDyedNote
          : t.product.noConditionNote);
  const conditionNoteLanguage = product.conditionNote ? product.conditionNoteContentLocale ?? "en" : language;

  return (
    <div className="product-page">
      <Breadcrumb
        items={[
          { label: t.breadcrumb.shop, href: "/shop" },
          { label: product.category, href: `/shop/${product.categorySlug}` },
          { label: product.name },
        ]}
      />

      <div className="page-container product-detail">
        {language === "id" && (product.contentLocale === "en" || product.categoryContentLocale === "en") ? <p className="muted" role="note">{t.draft.fallback}</p> : null}
        <section className="product-gallery" aria-label={t.product.galleryLabel}>
          <div className="product-gallery__folio">
            <span>{t.product.collectionLabel}</span>
            <span>{String(activeImageIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span>
          </div>
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
              preload
              sizes="(max-width: 900px) 100vw, (max-width: 1400px) 52vw, 660px"
            />
            <ProductWatermark />
            <span className="product-gallery__zoom"><PlusIcon size={19} /></span>
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
          <div className="product-gallery__caption">
            <span className="product-gallery__hint">{t.product.zoomHint}</span>
          </div>
          {product.videoUrl ? (
            <div className="product-gallery__video-section">
              <p className="product-gallery__video-label">{t.product.videoLabel}</p>
              <video
                className="product-gallery__video"
                controls
                playsInline
                preload="none"
                poster={images[0]}
                aria-label={`${product.name} product video`}
              >
                <source src={product.videoUrl} type="video/mp4" />
                Your browser does not support the video player.
              </video>
            </div>
          ) : null}
        </section>

        <div className="product-detail__info">
          <div className="product-detail__meta">
            <div className="eyebrow">
              <span className="product-detail__category-mark" aria-hidden="true" />
              <span lang={product.categoryContentLocale}>{product.category}</span>
            </div>
            {product.status === "Sold" || product.status === "Reserved" ? (
              <span className={`status-badge status-badge--${product.status.toLowerCase()}`}>
                {product.status === "Sold" ? t.common.sold : t.common.reserved}
              </span>
            ) : null}
          </div>
          <h1 lang={product.contentLocale}>{titleBreak > 0 ? <>{product.name.slice(0, titleBreak)} <em>{product.name.slice(titleBreak + 1)}</em></> : product.name}</h1>
          <p className="product-detail__description" lang={product.contentLocale}>{introduction}</p>
          <a className="product-detail__read" href="#stone-details">{t.product.readDetails}<ArrowUpRightIcon size={17} /></a>

          <div className="product-detail__purchase">
            <div>
              <div className="product-detail__price">{formatUSD(selectedProduct.price, language)}</div>
              <span className="product-detail__unit">USD · {t.product.priceUnits[product.unit]}</span>
            </div>
            <p className={`product-detail__stock ${product.status === "Available" && maxQuantity > 0 ? "is-available" : ""}`}>{stockMessage}</p>
          </div>

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
                    disabled={product.status !== "Available" || item.stockQuantity <= 0}
                    onClick={() => setVariantId(item.id)}
                  >
                    {item.name}{item.stockQuantity <= 0 ? ` — ${t.common.outOfStock}` : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="product-detail__actions">
            <AddToCartButton product={selectedProduct} variantId={variant?.id} variantName={variant?.name} />
            <button className="product-detail__share" type="button" onClick={shareProduct}>
              {shareMessage || t.product.share}
              <ShareIcon size={18} />
            </button>
          </div>
          {product.inStock && ["rough", "slab"].includes(product.categorySlug) ? <Link className="product-detail__custom-order" href={`/lapidary/custom-order?source=stock&stone=${encodeURIComponent(product.slug)}`}>
            {language === "id" ? "Minta batu ini dikerjakan" : "Request custom work with this stone"}
            <ArrowUpRightIcon size={17} />
          </Link> : null}
          <p className="product-detail__note">{t.product.stockNote}</p>

          <div className="product-detail__shipping-note"><GlobeIcon /><span>{t.product.shippingWorldwide}</span><Link href="/shipping-returns"><ArrowIcon /><span className="sr-only">{t.product.shippingTitle}</span></Link></div>
          {inCart > 0 ? <p className="product-detail__note" role="status">{t.common.inCart}</p> : null}
        </div>
      </div>

      <section className="page-container product-particulars" id="stone-details" aria-labelledby="stone-details-title">
        <div className="product-particulars__heading">
          <div className="eyebrow">{t.product.particulars}</div>
          <h2 id="stone-details-title">{t.product.closerLook}</h2>
          <span className="product-particulars__reference">REF. {variant?.sku ?? product.sku}</span>
        </div>
        <div className="product-particulars__content">
          <ul className="detail-list">
            <li>
              <span>{t.product.specStone}</span>
              <span>{product.stoneType}</span>
            </li>
            {product.origin ? (
              <li>
                <span>{t.product.specOrigin}</span>
                <span>{product.origin}</span>
              </li>
            ) : null}
            <li>
              <span>{t.product.specWeight}</span>
              <span>{selectedWeight > 0 ? `${selectedWeight} g` : t.product.notRecorded}</span>
            </li>
            {product.mohsHardness ? (
              <li>
                <span>{t.product.specHardness}</span>
                <span>{product.mohsHardness}</span>
              </li>
            ) : null}
            <li>
              <span>{t.product.specDimensions}</span>
              <span>{selectedDimensions.length > 0 && selectedDimensions.width > 0 && selectedDimensions.height > 0 ? formatDimensions(selectedDimensions) : t.product.notRecorded}</span>
            </li>
            <li>
              <span>{t.product.specCondition}</span>
              <span>{conditionLabel}</span>
            </li>
          </ul>
          <div className="product-detail__accordions" aria-label={t.product.detailsTitle}>
            <details open>
              <summary>{t.product.detailsDescription}</summary>
              <div className="product-detail__accordion-body">
                {descriptionParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              </div>
            </details>
            <details>
              <summary>{t.product.conditionTitle}</summary>
              <div className="product-detail__accordion-body">
                {language === "id" && conditionNoteLanguage === "en" && product.conditionNote
                  ? <p className="muted" role="note">{t.draft.fallback}</p> : null}
                <p lang={conditionNoteLanguage}>{conditionNote}</p>
                {conditionNote !== t.product.noConditionNote ? <p className="product-detail__note">{t.product.noConditionNote}</p> : null}
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
          </div>
        </div>
      </section>

      <ProductReviews slug={product.slug} />

      {related.length ? (
        <section className={`page-container product-detail__related ${related.length <= 2 ? "product-detail__related--compact" : ""}`}>
          <div className="home-section-heading">
            <div><div className="eyebrow">{t.product.collectionMore}</div><h2>{t.product.relatedTitle}</h2></div>
            <Link className="text-button" href={`/shop/${product.categorySlug}`}>{t.product.backToCollection}<ArrowIcon /></Link>
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
              <ChevronLeftIcon size={22} />
            </button>
            <div className="product-lightbox__image-wrap">
              <div className="product-lightbox__image-stage">
                <Image
                  className="product-lightbox__image"
                  src={images[activeImageIndex]}
                  alt={imageAlt(activeImageIndex)}
                  width={1400}
                  height={1400}
                  sizes="90vw"
                />
                <ProductWatermark />
              </div>
            </div>
            <button className="product-lightbox__nav product-lightbox__nav--next" type="button" aria-label={t.product.nextImage} onClick={() => moveImage(1)}>
              <ChevronRightIcon size={22} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
