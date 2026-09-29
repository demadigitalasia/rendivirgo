"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCopy } from "@/components/providers";

const socialLabels: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
};

export function SiteFooter({ socials, email }: { socials?: Record<string, string>; email?: string }) {
  const t = useCopy();
  const [emailInput, setEmailInput] = useState("");
  const [subscribeState, setSubscribeState] = useState<"idle" | "loading" | "success" | "error">("idle");

  const subscribe = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!emailInput.trim() || subscribeState === "loading") return;
    setSubscribeState("loading");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim(), source: "footer" }),
      });
      if (!response.ok) throw new Error("subscribe failed");
      setSubscribeState("success");
      setEmailInput("");
    } catch {
      setSubscribeState("error");
    }
  };

  const socialEntries = Object.entries(socials ?? {}).filter(([, url]) => url.trim());
  const contactEmail = email?.trim() || "cs@rendivirgo.com";

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
          <div className="footer-newsletter">
            <span className="footer-label">{t.footer.newsletterTitle}</span>
            <p className="muted">{t.footer.newsletterBody}</p>
            <form onSubmit={subscribe}>
              <label className="sr-only" htmlFor="footer-newsletter-email">
                {t.footer.newsletterPlaceholder}
              </label>
              <input
                id="footer-newsletter-email"
                type="email"
                required
                value={emailInput}
                onChange={(event) => {
                  setEmailInput(event.target.value);
                  if (subscribeState !== "idle") setSubscribeState("idle");
                }}
                placeholder={t.footer.newsletterPlaceholder}
                autoComplete="email"
              />
              <button type="submit" className="button" disabled={subscribeState === "loading"}>
                {t.footer.newsletterCta}
              </button>
            </form>
            {subscribeState === "success" ? (
              <span className="form-status form-status--success" role="status">
                {t.footer.newsletterSuccess}
              </span>
            ) : null}
            {subscribeState === "error" ? (
              <span className="form-status form-status--error" role="alert">
                {t.footer.newsletterError}
              </span>
            ) : null}
          </div>
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
          <Link href="/track">{t.footer.track}</Link>
          <Link href="/orders">{t.footer.orders}</Link>
          <Link href="/contact">{t.footer.contact}</Link>
        </div>
        <div>
          <span className="footer-label">{t.footer.follow}</span>
          {socialEntries.map(([network, url]) => (
            <a key={network} href={url} target="_blank" rel="noreferrer noopener">
              {socialLabels[network.toLowerCase()] ?? network}
            </a>
          ))}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
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
