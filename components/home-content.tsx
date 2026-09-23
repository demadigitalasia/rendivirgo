"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowIcon, GlobeIcon, LeafIcon, SparkleIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { useCopy } from "@/components/providers";
import type { Product } from "@/lib/catalog";
import type { ApiTestimonial, SiteContent } from "@/lib/storefront";

export function HomeContent({
  featured,
  categories,
  siteContent,
  testimonials,
}: {
  featured: Product[];
  categories: Array<{ slug: string; name: string }>;
  siteContent: SiteContent;
  testimonials: ApiTestimonial[];
}) {
  const t = useCopy();
  const heroImage = siteContent.heroImage || "/images/rendi-virgo-hero-stones.webp";
  const ownerImage = siteContent.ownerImage || "/images/rendi-virgo-owner.webp";

  return (
    <>
      <section className="hero">
        {heroImage.startsWith("/") ? (
          <Image
            className="hero__image"
            src={heroImage}
            alt="Polished green Indonesian stones resting on volcanic rock beside a calm river"
            fill
            sizes="100vw"
            preload
          />
        ) : (
          <img className="hero__image" src={heroImage} alt="RENDI VIRGO collection" />
        )}
        <div className="hero__overlay" aria-hidden="true" />
        <div className="page-container hero__inner">
          <div className="hero__copy">
            <div className="eyebrow eyebrow--light">{t.home.eyebrow}</div>
            <h1>{siteContent.heroTitle || t.home.heroTitle}</h1>
            <p>{siteContent.heroSubtitle || t.home.heroBody}</p>
            <div className="hero__actions">
              <Link href="/shop" className="button button--light">
                {t.home.heroCta} <ArrowIcon />
              </Link>
            </div>
          </div>
          <div className="hero__side-note">{t.home.sideNote}</div>
        </div>
      </section>

      <section className="page-container section--tight">
        <div className="owner-banner">
          <div className="owner-banner__portrait">
            {ownerImage.startsWith("/") ? (
              <Image
                src={ownerImage}
                alt="Indonesian stone collector examining a polished moss agate"
                fill
                sizes="(max-width: 980px) 100vw, 30vw"
              />
            ) : (
              <img src={ownerImage} alt={siteContent.ownerName} />
            )}
          </div>
          <div className="owner-banner__copy">
            <div className="eyebrow">{t.home.ownerEyebrow}</div>
            <h2>{siteContent.ownerName || t.home.ownerTitle}</h2>
            <p>{siteContent.ownerBio || t.home.ownerBody}</p>
            <div>
              <Link href={siteContent.ownerCtaHref || "/about-us"} className="text-button">
                {siteContent.ownerCtaLabel || t.home.ownerCta}
              </Link>
            </div>
          </div>
          <div className="owner-banner__quote">{t.home.ownerQuote}</div>
        </div>
      </section>

      <section className="page-container section--tight">
        <div className="section-heading">
          <h2>{t.home.categoriesTitle}</h2>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <Link className="category-tile" key={category.slug} href={`/shop/${category.slug}`}>
              <span>{category.name}</span>
            </Link>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/shop" className="text-button">
            {t.home.categoriesAll}
          </Link>
        </div>
      </section>

      <section className="page-container section--tight">
        <div className="section-heading">
          <h2>{t.home.stonesTitle}</h2>
        </div>
        <div className="product-grid">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <div style={{ marginTop: 28, textAlign: "center" }}>
          <Link href="/shop" className="button button--outline">
            {t.common.viewAll} <ArrowIcon />
          </Link>
        </div>
      </section>

      {testimonials.length ? (
        <section className="page-container section--tight">
          <div className="section-heading">
            <h2>{t.home.trustLabel}</h2>
          </div>
          <div className="testimonial-grid">
            {testimonials.slice(0, 3).map((testimonial) => (
              <figure className="testimonial-card" key={testimonial.id}>
                <blockquote>{testimonial.quote}</blockquote>
                <figcaption>
                  <strong>{testimonial.customerName}</strong>
                  {testimonial.location ? <span>{testimonial.location}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <section className="page-container trust-bar" aria-label={t.home.trustLabel}>
        <div className="trust-item">
          <LeafIcon />
          <span>{t.home.trustAuthentic}</span>
        </div>
        <div className="trust-item">
          <GlobeIcon />
          <span>{t.home.trustWorldwide}</span>
        </div>
        <div className="trust-item">
          <SparkleIcon />
          <span>{t.home.trustSelected}</span>
        </div>
      </section>
    </>
  );
}
