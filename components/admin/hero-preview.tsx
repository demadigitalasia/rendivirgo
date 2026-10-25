"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HomeHero } from "@/components/home-hero";
import type { HeroDocument } from "@/lib/hero-slides";
import "@/app/(storefront)/storefront.css";

/** An isolated viewport keeps the preview's media queries and image crops accurate. */
export function HeroPreview({ document, language, mobile }: { document: HeroDocument; language: "en" | "id"; mobile: boolean }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [frame, setFrame] = useState<Document | null>(null);
  const viewport = mobile ? 390 : 1280;
  const height = mobile ? 660 : 627.2;
  const scale = Math.min(1, width / viewport);
  useEffect(() => {
    if (!wrapper.current) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={wrapper} className="rv-hero-preview" style={{ height: height * scale }}>
    <iframe title={`${mobile ? "Mobile" : "Desktop"} hero preview (${language.toUpperCase()})`} width={viewport} height={height}
      style={{ transform: `scale(${scale})`, marginLeft: Math.max(0, (width - viewport * scale) / 2) }}
      srcDoc={'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;overflow:hidden}</style></head><body></body></html>'}
      onLoad={event => {
        const target = event.currentTarget.contentDocument;
        if (!target) return;
        window.document.querySelectorAll('link[rel="stylesheet"],style').forEach(style => target.head.append(style.cloneNode(true)));
        target.documentElement.className = window.document.documentElement.className;
        target.body.className = window.document.body.className;
        target.documentElement.lang = language;
        setFrame(target);
      }} />
    {frame ? createPortal(<div className="storefront"><HomeHero key={`${document.slides.map(slide => slide.id).join()}:${mobile}`} document={document} language={language} preview /></div>, frame.body) : null}
  </div>;
}
