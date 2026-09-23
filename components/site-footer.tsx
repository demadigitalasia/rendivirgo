"use client";

import Image from "next/image";
import Link from "next/link";
import { useCopy } from "@/components/providers";

export function SiteFooter() {
  const t = useCopy();

  return (
    <footer className="site-footer">
      <div className="page-container site-footer__grid">
        <div className="site-footer__brand">
          <div className="footer-logo-plate">
            <Image
              src="/brand/rendi-virgo-logo-black-silver.webp"
              alt="RENDI VIRGO"
              width={780}
              height={260}
              sizes="220px"
            />
          </div>
          <p>{t.footer.tagline}</p>
        </div>
        <div>
          <span className="footer-label">{t.footer.explore}</span>
          <Link href="/">{t.footer.home}</Link>
          <Link href="/shop">{t.footer.shop}</Link>
          <Link href="/about-us">{t.footer.about}</Link>
          <Link href="/blog">{t.footer.journal}</Link>
        </div>
        <div>
          <span className="footer-label">{t.footer.help}</span>
          <Link href="/faq">{t.footer.faq}</Link>
          <Link href="/shipping-returns">{t.footer.shipping}</Link>
          <Link href="/contact">{t.footer.contact}</Link>
        </div>
        <div>
          <span className="footer-label">{t.footer.follow}</span>
          <a href="https://www.instagram.com" target="_blank" rel="noreferrer noopener">
            Instagram
          </a>
          <a href="https://www.pinterest.com" target="_blank" rel="noreferrer noopener">
            Pinterest
          </a>
          <a href="mailto:hello@rendivirgo.com">hello@rendivirgo.com</a>
        </div>
      </div>
      <div className="page-container site-footer__bottom">
        <span>© 2026 RENDI VIRGO</span>
        <span>{t.footer.fromTo}</span>
        <span>
          <Link href="/privacy-policy">{t.footer.privacy}</Link> · <Link href="/terms-conditions">{t.footer.terms}</Link>
        </span>
      </div>
    </footer>
  );
}
