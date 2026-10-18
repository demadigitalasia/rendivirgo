"use client";

import Image from "next/image";
import Link from "@/components/localized-link";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFacebook,
  faInstagram,
  faTiktok,
  faXTwitter,
  faYoutube,
  faPaypal,
  faCcMastercard,
  faCcVisa,
} from "@fortawesome/free-brands-svg-icons";
import { useCopy, useLanguage } from "@/components/providers";

const socialLabels: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  twitter: "X",
};

const socialIcons: Record<string, typeof faInstagram> = {
  instagram: faInstagram,
  facebook: faFacebook,
  youtube: faYoutube,
  tiktok: faTiktok,
  x: faXTwitter,
  twitter: faXTwitter,
};

export function SiteFooter({ socials, email }: { socials?: Record<string, string>; email?: string }) {
  const t = useCopy();
  const { language } = useLanguage();
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
        body: JSON.stringify({ email: emailInput.trim(), source: "footer", locale: language }),
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
      <section className="page-container footer-newsletter" aria-labelledby="footer-newsletter-heading">
        <div className="footer-newsletter__copy">
          <h2 id="footer-newsletter-heading">{t.footer.newsletterTitle}</h2>
          <p>{t.footer.newsletterBody}</p>
        </div>
        <form onSubmit={subscribe} aria-busy={subscribeState === "loading"}>
          <div className="footer-newsletter__field">
            <label className="sr-only" htmlFor="footer-newsletter-email">{t.footer.newsletterPlaceholder}</label>
            <input id="footer-newsletter-email" type="email" required disabled={subscribeState === "loading"}
              value={emailInput} autoComplete="email" placeholder={t.footer.newsletterPlaceholder}
              aria-describedby="footer-newsletter-status"
              onChange={(event) => { setEmailInput(event.target.value); if (subscribeState !== "idle") setSubscribeState("idle"); }} />
            <button type="submit" className="button button--light" disabled={subscribeState === "loading"}>
              {subscribeState === "loading" ? t.footer.newsletterLoading : t.footer.newsletterCta}
            </button>
          </div>
          <div id="footer-newsletter-status" className={`footer-newsletter__status form-status${subscribeState === "error" ? " form-status--error" : ""}`}
            role={subscribeState === "error" ? "alert" : "status"}>
            {subscribeState === "loading" ? t.footer.newsletterLoading : subscribeState === "success" ? t.footer.newsletterSuccess : subscribeState === "error" ? t.footer.newsletterError : ""}
          </div>
        </form>
      </section>
      <div className="page-container site-footer__grid">
        <div className="site-footer__brand">
          <Link href="/" className="footer-logo-plate" aria-label="RENDI VIRGO">
            <Image src="/brand/rendi-virgo-logo-footer.png" alt="RENDI VIRGO" width={780} height={260} sizes="200px" />
          </Link>
          <p>{t.footer.tagline}</p>
        </div>
        <nav className="footer-nav" aria-labelledby="footer-explore-heading">
          <h2 id="footer-explore-heading" className="footer-label">{t.footer.explore}</h2>
          <Link href="/">{t.footer.home}</Link>
          <Link href="/shop">{t.footer.shop}</Link>
          <Link href="/about-us">{t.footer.about}</Link>
          <Link href="/blog">{t.footer.journal}</Link>
        </nav>
        <nav className="footer-nav" aria-labelledby="footer-care-heading">
          <h2 id="footer-care-heading" className="footer-label">{t.footer.help}</h2>
          <Link href="/shipping-returns">{t.footer.shipping}</Link>
          <Link href="/returns">{t.footer.requestReturn}</Link>
          <Link href="/track">{t.footer.track}</Link>
          <Link href="/orders">{t.footer.orders}</Link>
          <Link href="/faq">{t.footer.faq}</Link>
        </nav>
        <div className="footer-connect">
          <h2 className="footer-label">{t.footer.follow}</h2>
          <Link href="/contact">{t.footer.contact}</Link>
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          {socialEntries.length ? (
            <div className="site-footer__social-icons">
              {socialEntries.map(([network, url]) => {
                const normalized = network.toLowerCase();
                const label = socialLabels[normalized] ?? network;
                const icon = socialIcons[normalized];
                return <a key={network} className="site-footer__social-icon" href={url} target="_blank"
                  rel="noreferrer noopener" aria-label={label} title={label}>
                  {icon ? <FontAwesomeIcon icon={icon} aria-hidden="true" /> : <span aria-hidden="true">{label.slice(0, 1).toUpperCase()}</span>}
                </a>;
              })}
            </div>
          ) : null}
        </div>
      </div>
      <section className="page-container site-footer__payments" aria-labelledby="footer-payments-heading">
        <h2 id="footer-payments-heading">{t.footer.paymentMethods}</h2>
        <div className="site-footer__payment-options">
          <ul className="site-footer__payment-list">
            <li className="site-footer__payment-mark" aria-label="PayPal">
              <FontAwesomeIcon icon={faPaypal} aria-hidden="true" />
              <span>PayPal</span>
            </li>
            <li className="site-footer__payment-mark site-footer__payment-mark--visa" aria-label="Visa, via PayPal">
              <FontAwesomeIcon icon={faCcVisa} aria-hidden="true" />
              <span>Visa</span>
            </li>
            <li className="site-footer__payment-mark" aria-label="Mastercard, via PayPal">
              <FontAwesomeIcon icon={faCcMastercard} aria-hidden="true" />
              <span>Mastercard</span>
            </li>
            <li className="site-footer__payment-mark site-footer__payment-mark--bank" aria-label="Bank transfer">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 9h18M5 9v9m4-9v9m6-9v9m4-9v9M3 21h18M12 3 2 8h20L12 3Z" />
              </svg>
              <span>{t.footer.bankTransfer}</span>
            </li>
          </ul>
          <p className="site-footer__payment-note">{t.footer.cardsViaPaypal}</p>
        </div>
      </section>
      <div className="page-container site-footer__bottom">
        <div className="site-footer__copyright"><span>© {new Date().getFullYear()} RENDI VIRGO</span><span>{t.footer.fromTo}</span></div>
        <nav className="footer-legal" aria-label={t.footer.legal}>
          <Link href="/privacy-policy">{t.footer.privacy}</Link>
          <Link href="/terms-conditions">{t.footer.terms}</Link>
        </nav>
      </div>
    </footer>
  );
}
