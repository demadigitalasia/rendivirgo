"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowIcon, GlobeIcon, LeafIcon, SparkleIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { HomeScrollMotion } from "@/components/home-scroll-motion";
import { OwnerStory } from "@/components/owner-story";
import { useCopy } from "@/components/providers";
import { WhatsAppPopup } from "@/components/whatsapp-popup";
import { formatUSD, type Product } from "@/lib/catalog";
import type { ApiTestimonial, SiteContent } from "@/lib/storefront";

export function HomeContent({ featured, categories, siteContent, testimonials, whatsapp, whatsappSecondary }: {
  featured: Product[];
  categories: Array<{ slug: string; name: string; imageUrl?: string | null }>;
  siteContent: SiteContent;
  testimonials: ApiTestimonial[];
  whatsapp: string;
  whatsappSecondary: string;
}) {
  const t = useCopy();
  const heroImage = siteContent.heroImage || "/images/rendi-virgo-hero-stones.webp";
  const heroTitle = !siteContent.heroTitle || ["Explore the Collection", "Jelajahi Koleksi"].includes(siteContent.heroTitle)
    ? t.home.heroTitle : siteContent.heroTitle;
  const heroSubtitle = !siteContent.heroSubtitle || siteContent.heroSubtitle === "Rare semi-precious stones from Indonesia, selected for collectors, makers, and quiet moments of wonder."
    ? t.home.heroBody : siteContent.heroSubtitle;
  const editorialForms: Record<string, string> = { cabochons: "cabochons", pair: "pair", rough: "rough", slab: "slab", specimen: "specimen" };

  return (
    <div className="home-page">
      <HomeScrollMotion />
      <section className="hero">
        {heroImage.startsWith("/") ? (
          <Image className="hero__image" src={heroImage}
            alt="Polished green Indonesian stones resting on volcanic rock beside a calm river"
            fill sizes="100vw" preload />
        ) : <img className="hero__image" src={heroImage} alt="RENDI VIRGO collection" />}
        <div className="hero__overlay" aria-hidden="true" />
        <div className="page-container hero__inner">
          <div className="hero__copy">
            <div className="eyebrow eyebrow--light hero__eyebrow"><span aria-hidden="true" />{t.home.eyebrow}</div>
            <h1>{heroTitle.split("\n").map((line, index) => <span key={index}>{line}</span>)}</h1>
            <p>{heroSubtitle}</p>
            <div className="hero__actions">
              <Link href="/shop" className="button button--light">{t.home.heroCta} <ArrowIcon /></Link>
              <Link href="/about-us" className="hero__story-link">{t.home.storyLink}<ArrowIcon /></Link>
            </div>
          </div>
          {featured[0] ? (
            <Link href={`/shop/${featured[0].categorySlug}/${featured[0].slug}`} className="hero__spec">
              <span className="eyebrow">{t.home.featuredPiece}</span>
              <strong>{featured[0].name}</strong>
              <small>{featured[0].stoneType} · {featured[0].origin.split(",")[0]}</small>
              <span className="hero__spec__row"><span>{formatUSD(featured[0].price)}</span><ArrowIcon /></span>
            </Link>
          ) : null}
        </div>
        <div className="hero__caption" aria-hidden="true">RENDI VIRGO — INDONESIA</div>
      </section>

      <div className="home-promises" aria-label={t.home.trustLabel}>
        <div className="page-container trust-bar" data-home-stagger>
          <div className="trust-item"><LeafIcon /><span>{t.home.trustAuthentic}</span></div>
          <div className="trust-item"><GlobeIcon /><span>{t.home.trustWorldwide}</span></div>
          <div className="trust-item"><SparkleIcon /><span>{t.home.trustSelected}</span></div>
        </div>
      </div>

      <section className="page-container nature-note">
        <div className="nature-note__copy" data-home-reveal>
          <div className="eyebrow">{t.home.introEyebrow}</div>
          <h2>{t.home.introTitle}</h2>
          <p>{t.home.introBody}</p>
          <Link href="/about-us" className="text-button">{t.home.storyLink}<ArrowIcon /></Link>
        </div>
        <div className="nature-note__art" data-home-reveal="visual" aria-hidden="true">
          <span className="nature-note__orbit" />
          <Image src="/images/editorial/moss-agate-fern.webp" alt="" width={1536} height={1024}
            sizes="(max-width: 720px) 90vw, 48vw" />
          <span className="nature-note__annotation">Moss agate · A landscape within</span>
        </div>
      </section>

      {categories.length ? (
        <section className="page-container home-categories home-section">
          <div className="home-section-heading" data-home-reveal>
            <div><div className="eyebrow">{t.home.categoryEyebrow}</div><h2>{t.home.categoriesTitle}</h2><p>{t.home.categoryBody}</p></div>
            <Link href="/shop" className="text-button">{t.home.categoriesAll}<ArrowIcon /></Link>
          </div>
          <div className="category-grid" data-home-stagger>
            {categories.map((category, index) => {
              const categoryImage = category.imageUrl;
              const editorialForm = !categoryImage ? editorialForms[category.slug] : null;
              return (
                <Link className={`category-tile ${categoryImage ? "category-tile--has-image" : editorialForm ? "category-tile--editorial" : ""}`}
                  key={category.slug} href={`/shop/${category.slug}`}>
                  {categoryImage ? <Image className="category-tile__image" src={categoryImage} alt="" fill
                    sizes="(max-width: 720px) 45vw, 20vw" unoptimized /> : editorialForm ? (
                      <span className={`category-tile__stone category-tile__stone--${editorialForm}`} aria-hidden="true" />
                    ) : <span className="category-tile__mineral" aria-hidden="true" />}
                  <span className="category-tile__index" aria-hidden="true">0{index + 1}</span>
                  <div className="category-tile__caption"><span>{category.name}</span><ArrowIcon /></div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {featured.length ? (
        <section className="home-selection">
          <div className="page-container home-section">
            <div className="home-section-heading" data-home-reveal>
              <div><div className="eyebrow">{t.home.selectedEyebrow}</div><h2>{t.home.stonesTitle}</h2><p>{t.home.selectedBody}</p></div>
              <Link href="/shop" className="text-button">{t.common.viewAll}<ArrowIcon /></Link>
            </div>
            <div className="product-grid" data-home-stagger>{featured.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          </div>
        </section>
      ) : null}

      <OwnerStory content={siteContent} />

      {testimonials.length ? (
        <section className="home-collectors">
          <div className="page-container home-section">
            <div className="home-section-heading" data-home-reveal><div><div className="eyebrow">{t.home.collectorsEyebrow}</div><h2>{t.home.collectorsTitle}</h2></div></div>
            <div className="testimonial-grid" data-home-stagger>
              {testimonials.slice(0, 3).map((testimonial) => (
                <figure className="testimonial-card" key={testimonial.id}>
                  <span className="testimonial-card__quote" aria-hidden="true">“</span>
                  <blockquote>{testimonial.quote}</blockquote>
                  <figcaption><strong>{testimonial.customerName}</strong>{testimonial.location ? <span>{testimonial.location}</span> : null}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="page-container home-closing" data-home-stagger>
        <div className="eyebrow">{t.home.closingEyebrow}</div><h2>{t.home.closingTitle}</h2>
        <Link href="/shop" className="button">{t.home.heroCta}<ArrowIcon /></Link>
        <LeafIcon />
      </section>
      <WhatsAppPopup phone={whatsapp} secondaryPhone={whatsappSecondary} />
    </div>
  );
}
