"use client";

import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { ArrowIcon, GlobeIcon, LeafIcon, SparkleIcon } from "@/components/icons";

export type ContactContentProps = {
  email: string;
  whatsapp: string;
  whatsappHref: string | null;
  address: string;
  hours: string;
  socials: Array<{ network: string; url: string }>;
};

export function ContactContent({ email, whatsapp, whatsappHref, address, hours, socials }: ContactContentProps) {

  return (
    <div>
      <section className="contact-hero">
        <div className="page-container contact-hero__inner">
          <div className="contact-hero__copy">
            <div className="eyebrow eyebrow--light">Get in touch</div>
            <h1>
              Let us look
              <br />
              closer together.
            </h1>
            <p>
              Questions about a stone, a parcel, or a future sourcing request? Choose the fastest
              channel — we reply with care, usually within one business day.
            </p>
            <div className="contact-hero__actions">
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer noopener" className="button button--light">
                  Chat on WhatsApp <ArrowIcon />
                </a>
              ) : null}
              <a href={`mailto:${email}`} className="button contact-hero__ghost">
                {email}
              </a>
            </div>
          </div>
          <div className="contact-hero__note">
            <span className="contact-hero__pulse" aria-hidden="true" />
            <div>
              <strong>Replies within 1 business day</strong>
              <span>{hours || "Monday – Saturday (GMT+7)"}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="page-container contact-channels">
        <article className="contact-channel reveal">
          <span className="contact-channel__icon" aria-hidden="true">
            <ArrowIcon />
          </span>
          <div className="eyebrow">Email</div>
          <h2>For details &amp; photos</h2>
          <p>Order numbers, stone links, and close-up photos are easiest by email.</p>
          <a href={`mailto:${email}`} className="text-button">
            {email}
          </a>
        </article>
        <article className="contact-channel contact-channel--dark reveal">
          <span className="contact-channel__icon" aria-hidden="true">
            <GlobeIcon />
          </span>
          <div className="eyebrow eyebrow--light">WhatsApp</div>
          <h2>For fast questions</h2>
          <p>{whatsapp || "Chat with the studio directly."}</p>
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer noopener" className="text-button text-button--light">
              Open WhatsApp chat
            </a>
          ) : null}
        </article>
        <article className="contact-channel reveal">
          <span className="contact-channel__icon" aria-hidden="true">
            <LeafIcon />
          </span>
          <div className="eyebrow">Studio</div>
          <h2>From Indonesia</h2>
          <p>{address || "Bandung, West Java, Indonesia"}</p>
          <span className="muted">{hours}</span>
        </article>
      </section>

      <section className="page-container contact-main">
        <div className="contact-formpanel reveal">
          <div className="eyebrow">Send a message</div>
          <h2>Tell us what you&apos;re looking for.</h2>
          <p className="muted">Include a stone name or order number (e.g. RV-20260101-0001) so we can answer in one reply.</p>
          <ContactForm />
        </div>
        <aside className="contact-side">
          <div className="contact-side__card reveal">
            <span className="contact-side__icon" aria-hidden="true">
              <SparkleIcon />
            </span>
            <h3>Before you write</h3>
            <ul>
              <li>
                <Link href="/track">Track your parcel</Link> — live status with your order number &amp; email.
              </li>
              <li>
                <Link href="/shipping-returns">Shipping &amp; returns</Link> — timelines, handling, and damage claims.
              </li>
              <li>
                <Link href="/faq">FAQ</Link> — natural vs. treated stones, uniqueness, and care.
              </li>
              <li>
                <Link href="/orders">Order history</Link> — resend your secure magic link anytime.
              </li>
            </ul>
          </div>
          {socials.length ? (
            <div className="contact-side__card reveal">
              <h3>Follow the finds</h3>
              <div className="contact-socialgrid">
                {socials.map((social) => (
                  <a key={social.network} href={social.url} target="_blank" rel="noreferrer noopener">
                    {social.network.charAt(0).toUpperCase() + social.network.slice(1)}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
