"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowIcon, GlobeIcon, LeafIcon, SparkleIcon } from "@/components/icons";
import { useLanguage } from "@/components/providers";
import type { SiteContent } from "@/lib/storefront";
import "./owner-story.css";

const portrait = "/images/rendi-virgo-owner-cutout.png";
const copy = {
  en: {
    eyebrow: "The person behind the pieces",
    title: "A personal eye.", titleAccent: "A world of stones.",
    role: "Founder & curator", portrait: "Portrait of Rendi Virgo, owner of RENDI VIRGO",
    location: "Rooted in Indonesia", destination: "Shared with the world",
    story: "A few words from our world", previous: "Previous chapter", next: "Next chapter",
    cta: "Get to know us", collection: "Explore the collection",
    handpicked: "Selected by hand", individual: "Individual character", worldwide: "Shared worldwide",
    chapters: [
      { label: "The beginning", title: "It starts with curiosity.", body: "A pattern that looks like a forest. A colour you can’t quite name. That small moment of looking closer is where the RENDI VIRGO collection begins." },
      { label: "The eye", title: "Character over sameness.", body: "A quiet detail, an unexpected inclusion, a shape with its own presence. Our eye is drawn to the things that make each stone feel individual." },
      { label: "The connection", title: "From here, to your hands.", body: "From Indonesia to the world — a collection for people who see more than a stone. Something to keep, something to create, a story to make your own." },
    ],
  },
  id: {
    eyebrow: "Sosok di balik setiap pilihan",
    title: "Satu sudut pandang.", titleAccent: "Sejuta cerita batu.",
    role: "Pendiri & kurator", portrait: "Potret Rendi Virgo, pemilik RENDI VIRGO",
    location: "Berakar di Indonesia", destination: "Dibagikan kepada dunia",
    story: "Sepenggal cerita kami", previous: "Bab sebelumnya", next: "Bab berikutnya",
    cta: "Kenali kami lebih dekat", collection: "Jelajahi koleksi",
    handpicked: "Dipilih langsung", individual: "Karakter istimewa", worldwide: "Dibagikan ke dunia",
    chapters: [
      { label: "Awal cerita", title: "Berawal dari rasa ingin tahu.", body: "Pola yang menyerupai hutan. Warna yang sulit diberi nama. Momen kecil saat melihat lebih dekat itulah awal dari koleksi RENDI VIRGO." },
      { label: "Sudut pandang", title: "Karakter yang tak berulang.", body: "Detail yang tenang, inklusi tak terduga, bentuk dengan pesonanya sendiri. Mata kami tertuju pada hal-hal kecil yang membuat setiap batu terasa istimewa." },
      { label: "Sebuah koneksi", title: "Dari sini, ke tangan Anda.", body: "Dari Indonesia ke dunia — koleksi untuk Anda yang melihat lebih dari sekadar batu. Untuk disimpan, dikreasikan, dan menjadi bagian dari cerita Anda." },
    ],
  },
};

export function OwnerStory({ content }: { content: SiteContent }) {
  const { language } = useLanguage();
  const t = copy[language];
  const section = useRef<HTMLElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const [visible, setVisible] = useState(false);
  const [source, setSource] = useState(content.ownerImage?.endsWith(".png")
    && content.ownerImage.includes("owner-cutout") ? content.ownerImage : portrait);

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
    }, { threshold: .15 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const select = (index: number) => {
    setDirection(index > active ? 1 : -1);
    setActive((index + t.chapters.length) % t.chapters.length);
  };
  const startSwipe = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") touch.current = { x: event.clientX, y: event.clientY };
  };
  const endSwipe = (event: PointerEvent<HTMLDivElement>) => {
    if (!touch.current) return;
    const dx = event.clientX - touch.current.x;
    const dy = event.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) select(active + (dx < 0 ? 1 : -1));
  };

  return (
    <section ref={section} id="owner-note" className="owner-story" aria-labelledby="owner-story-title"
      data-visible={visible}>
      <div className="page-container owner-story__inner">
        <div className="owner-story__visual" data-home-reveal="visual">
          <div className="owner-story__stage">
            <span className="owner-story__atmosphere" aria-hidden="true">
              <span className="owner-story__wash owner-story__wash--sage" />
              <span className="owner-story__wash owner-story__wash--sand" />
              <span className="owner-story__wash owner-story__wash--light" />
            </span>
            <span className="owner-story__cutout">
              <span className="owner-story__sprite">
                <Image src={source} alt={t.portrait} fill unoptimized
                  sizes="(max-width: 720px) 85vw, 450px"
                  onError={() => { if (source !== portrait) setSource(portrait); }} />
              </span>
            </span>
          </div>
          <div className="owner-story__identity">
            <span className="owner-story__name">{content.ownerName || "RENDI VIRGO"}</span>
            <span className="owner-story__role">{t.role}</span>
          </div>
        </div>

        <div className="owner-story__copy" data-home-reveal>
          <div className="eyebrow">{t.eyebrow}</div>
          <h2 id="owner-story-title">{t.title}<em>{t.titleAccent}</em></h2>
          <div className="owner-story__chapter-viewport" aria-live="polite" aria-atomic="true"
            onPointerDown={startSwipe} onPointerUp={endSwipe} onPointerCancel={() => { touch.current = null; }}>
            <div key={`${language}-${active}`} id="owner-story-chapter"
              className={`owner-story__chapter ${direction < 0 ? "owner-story__chapter--previous" : ""}`}>
              <h3>{t.chapters[active].title}</h3>
              <p>{t.chapters[active].body}</p>
            </div>
          </div>
          <div className="owner-story__navigation">
            <div className="owner-story__chapter-nav" aria-label={t.story}>
              {t.chapters.map((chapter, index) => (
                <button key={chapter.label} type="button" aria-pressed={active === index}
                  onClick={() => select(index)} aria-controls="owner-story-chapter"
                  aria-label={`0${index + 1} — ${chapter.label}`}><span>0{index + 1}</span></button>
              ))}
            </div>
            <div className="owner-story__arrows">
              <button type="button" onClick={() => select(active - 1)} aria-label={t.previous}><ArrowIcon /></button>
              <button type="button" onClick={() => select(active + 1)} aria-label={t.next}><ArrowIcon /></button>
            </div>
          </div>
          <ul className="owner-story__values">
            <li><LeafIcon /><span>{t.handpicked}</span></li>
            <li><SparkleIcon /><span>{t.individual}</span></li>
            <li><GlobeIcon /><span>{t.worldwide}</span></li>
          </ul>
          <Link href={content.ownerCtaHref || "/about-us"} className="button owner-story__link">{t.cta}<ArrowIcon /></Link>
        </div>
      </div>
    </section>
  );
}
