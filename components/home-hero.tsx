"use client";

import { getImageProps } from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "@/components/localized-link";
import { ArrowIcon } from "@/components/icons";
import { formatUSD } from "@/lib/catalog";
import { heroCopy, type HeroDocument } from "@/lib/hero-slides";
import "./home-hero.css";

const FALLBACK_IMAGE = "/images/rendi-virgo-hero-stones.webp";
function imageProps(src: string) {
  return getImageProps({ src, alt: "", fill: true, sizes: "100vw", unoptimized: !src.startsWith("/") }).props;
}

export function HomeHero({ document, language, preview = false }: { document: HeroDocument; language: "en" | "id"; preview?: boolean }) {
  const slides = document.slides.filter(slide => slide.isActive).slice(0, 5);
  const { settings } = document;
  const [active, setActive] = useState(0);
  const [prepared, setPrepared] = useState(() => new Set([0]));
  const [loaded, setLoaded] = useState(() => new Set<number>());
  const [failed, setFailed] = useState(() => new Set<number>());
  const [pending, setPending] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const root = useRef<HTMLElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const index = Math.min(active, Math.max(0, slides.length - 1));
  const next = slides.length ? (index + 1) % slides.length : 0;
  const running = settings.autoplay && !paused && !hovered && !focused && visible && tabVisible && !reducedMotion && slides.length > 1;
  const id = language === "id";

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    const visibility = () => setTabVisible(!window.document.hidden);
    update(); visibility();
    preference.addEventListener("change", update);
    window.document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), { threshold: 0.15 });
    if (root.current) observer.observe(root.current);
    return () => { preference.removeEventListener("change", update); window.document.removeEventListener("visibilitychange", visibility); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!loaded.has(index) || slides.length < 2) return;
    // Only prepare the following image after the current image has loaded.
    setPrepared(current => current.has(next) ? current : new Set([...current, next]));
  }, [index, loaded, next, slides.length]);

  useEffect(() => {
    if (!running || !loaded.has(next)) return;
    const timer = window.setTimeout(() => setActive(next), settings.duration * 1000);
    return () => window.clearTimeout(timer);
  }, [running, index, next, loaded, settings.duration]);

  useEffect(() => {
    if (pending !== null && loaded.has(pending)) { setActive(pending); setPending(null); }
  }, [pending, loaded]);

  const go = (destination: number) => {
    const target = (destination + slides.length) % slides.length;
    setPrepared(current => new Set([...current, target]));
    if (loaded.has(target)) { setActive(target); setPending(null); }
    else setPending(target);
    setPaused(true);
  };
  if (!slides.length) return null;

  return (
    <section ref={root} className={`hero hero-slider${preview ? " hero-slider--preview" : ""}`} aria-label={id ? "Jelajahi RENDI VIRGO" : "Discover RENDI VIRGO"}
      aria-roledescription={id ? "slideshow" : "carousel"} aria-busy={pending !== null} data-animation={settings.textAnimation} data-image-motion={settings.imageMotion && !reducedMotion}
      style={{ "--hero-transition": `${settings.transitionMs}ms` } as CSSProperties}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
      onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
      onTouchEnd={event => { const start = touch.current; touch.current = null; if (!start || slides.length < 2) return; const dx = event.changedTouches[0].clientX - start.x; const dy = event.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) go(index + (dx < 0 ? 1 : -1)); }}>
      {slides.map((slide, position) => {
        const selected = position === index;
        const copy = heroCopy(slide, language);
        const locale = id && slide.translationStatus === "Ready" ? "id" : "en";
        const Heading = position === 0 && !preview ? "h1" : "h2";
        const product = slide.product;
        const image = failed.has(position) ? FALLBACK_IMAGE : slide.imageUrl || FALLBACK_IMAGE;
        const cardHref = slide.cardType === "product" ? product?.href : slide.cardHref;
        const markLoaded = () => setLoaded(current => current.has(position) ? current : new Set([...current, position]));
        return <div key={slide.id} className={`hero-slider__slide${selected ? " is-active" : ""}`} inert={!selected || preview} aria-hidden={!selected} role="group" aria-roledescription={id ? "slide" : "slide"} aria-label={`${position + 1} / ${slides.length}: ${copy.label}`}
          data-align={slide.alignment} style={{ "--hero-focal": `${slide.focalX * 100}% ${slide.focalY * 100}%`, "--hero-mobile-focal": `${slide.mobileFocalX * 100}% ${slide.mobileFocalY * 100}%`, "--hero-shade": slide.overlay } as CSSProperties}>
          {prepared.has(position) ? <div className="hero-slider__visual"><picture>
            {slide.mobileImageUrl && !failed.has(position) ? <source media="(max-width: 720px)" {...(() => { const props = imageProps(slide.mobileImageUrl); return { srcSet: props.srcSet || props.src, sizes: props.sizes }; })()} /> : null}
            <img {...imageProps(image)} className="hero__image" alt={copy.alt} loading="eager" fetchPriority={position === 0 ? "high" : "low"}
              onLoad={markLoaded} onError={() => { setFailed(current => current.has(position) ? current : new Set([...current, position])); markLoaded(); }} />
          </picture></div> : null}
          <div className="hero__overlay" aria-hidden="true" />
          <div className="page-container hero__inner">
            <div className="hero__copy" lang={locale}>
              <div className="eyebrow eyebrow--light hero__eyebrow"><span aria-hidden="true" />{copy.eyebrow}</div>
              <Heading className="hero-slider__heading">{copy.title.split("\n").map((line, lineIndex) => <span key={lineIndex}>{line}</span>)}</Heading>
              <p>{copy.description}</p>
              <div className="hero__actions">
                <Link locale={language} href={slide.ctaHref || "/shop"} className="button button--light">{copy.ctaLabel}<ArrowIcon /></Link>
                {slide.secondaryHref && copy.secondaryLabel ? <Link locale={language} href={slide.secondaryHref} className="hero__story-link">{copy.secondaryLabel}<ArrowIcon /></Link> : null}
              </div>
            </div>
            {slide.cardType !== "none" && cardHref && (slide.cardType === "info" ? copy.cardTitle : product) ? <Link locale={language} href={cardHref} className="hero__spec" lang={slide.cardType === "info" ? locale : language}>
              <span className="eyebrow">{slide.cardType === "product" ? (id ? "DALAM KOLEKSI" : "IN THE COLLECTION") : copy.label}</span>
              <strong>{slide.cardType === "product" ? (id ? product!.nameId : product!.name) : copy.cardTitle}</strong>
              <small>{slide.cardType === "product" ? product!.detail : copy.cardDetail}</small>
              <span className="hero__spec__row"><span>{slide.cardType === "product" ? formatUSD(product!.price, language) : copy.ctaLabel}</span><ArrowIcon /></span>
            </Link> : null}
          </div>
        </div>;
      })}
      {slides.length > 1 ? <div className="page-container hero-slider__footer">
        <span className="hero-slider__mobile-label">{heroCopy(slides[index], language).label}</span>
        <div className="hero-slider__tabs" role="group" aria-label={id ? "Pilih slide" : "Choose a slide"}>
          {slides.map((slide, position) => <button type="button" key={slide.id} aria-label={`${id ? "Tampilkan" : "Show"} ${heroCopy(slide, language).label}`} aria-current={index === position ? "true" : undefined} onClick={() => go(position)}>
            <span className="hero-slider__tab-number">{String(position + 1).padStart(2, "0")}</span><span className="hero-slider__tab-label">{heroCopy(slide, language).label}</span>
          </button>)}
        </div>
        <div className="hero-slider__controls">
          <button type="button" onClick={() => go(index - 1)} aria-label={id ? "Slide sebelumnya" : "Previous slide"}>←</button>
          <span className="hero-slider__counter">{String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
          <button type="button" onClick={() => go(index + 1)} aria-label={id ? "Slide berikutnya" : "Next slide"}>→</button>
          {settings.autoplay && !reducedMotion ? <button type="button" onClick={() => { setPaused(value => !value); setHovered(false); setFocused(false); }} aria-label={paused ? (id ? "Putar slideshow" : "Play slideshow") : (id ? "Jeda slideshow" : "Pause slideshow")}>{paused ? "▷" : "Ⅱ"}</button> : null}
        </div>
      </div> : <div className="hero__caption" aria-hidden="true">RENDI VIRGO — INDONESIA</div>}
      <span className="hero-slider__announcement" aria-live={paused ? "polite" : "off"} aria-atomic="true">{index + 1} / {slides.length}: {heroCopy(slides[index], language).label}</span>
    </section>
  );
}
