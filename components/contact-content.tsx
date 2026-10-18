"use client";

import Link from "@/components/localized-link";
import { ContactForm } from "@/components/contact-form";
import { ArrowIcon, GlobeIcon, LeafIcon, SparkleIcon } from "@/components/icons";
import { useCopy } from "@/components/providers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFacebook, faInstagram } from "@fortawesome/free-brands-svg-icons";

export type ContactContentProps = {
  email: string;
  whatsapp: string;
  whatsappHref: string | null;
  address: string;
  hours: string;
  socials: Array<{ network: string; url: string }>;
};

export function ContactContent({ email, whatsapp, whatsappHref, address, hours, socials }: ContactContentProps) {
  const t = useCopy().contact;
  return (
    <div>
      <section className="contact-hero">
        <div className="page-container contact-hero__inner">
          <div className="contact-hero__copy">
            <div className="eyebrow eyebrow--light">{t.heroEyebrow}</div>
            <h1>
              {t.title.split("\n")[0]}
              <br />
              {t.title.split("\n")[1]}
            </h1>
            <p>{t.intro}</p>
            <div className="contact-hero__actions">
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer noopener" className="button button--light">
                  {t.chat} <ArrowIcon />
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
              <strong>{t.replyTime}</strong>
              <span>{hours || t.hoursDefault}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="page-container contact-channels">
        <article className="contact-channel reveal">
          <span className="contact-channel__icon" aria-hidden="true">
            <ArrowIcon />
          </span>
          <div className="eyebrow">{t.email}</div>
          <h2>{t.emailHeading}</h2>
          <p>{t.emailBody}</p>
          <a href={`mailto:${email}`} className="text-button">
            {email}
          </a>
        </article>
        <article className="contact-channel contact-channel--dark reveal">
          <span className="contact-channel__icon" aria-hidden="true">
            <GlobeIcon />
          </span>
          <div className="eyebrow eyebrow--light">{t.whatsapp}</div>
          <h2>{t.quickQuestions}</h2>
          <p>{whatsapp || t.chatDirect}</p>
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer noopener" className="text-button text-button--light">
              {t.openWhatsapp}
            </a>
          ) : null}
        </article>
        <article className="contact-channel reveal">
          <span className="contact-channel__icon" aria-hidden="true">
            <LeafIcon />
          </span>
          <div className="eyebrow">{t.studio}</div>
          <h2>{t.fromIndonesia}</h2>
          <p>{address || "Bandung, West Java, Indonesia"}</p>
          <span className="muted">{hours}</span>
        </article>
      </section>

      <section className="page-container contact-main">
        <div className="contact-formpanel reveal">
          <div className="eyebrow">{t.sendMessage}</div>
          <h2>{t.messageHeading}</h2>
          <p className="muted">{t.messageIntro}</p>
          <ContactForm />
        </div>
        <aside className="contact-side">
          <div className="contact-side__card reveal">
            <span className="contact-side__icon" aria-hidden="true">
              <SparkleIcon />
            </span>
            <h3>{t.beforeWriting}</h3>
            <ul>
              <li>
                <Link href="/track">{t.trackParcel}</Link> — {t.trackDescription}
              </li>
              <li>
                <Link href="/shipping-returns">{t.shippingReturns}</Link> — {t.shippingDescription}
              </li>
              <li>
                <Link href="/faq">{t.faq}</Link> — {t.faqDescription}
              </li>
              <li>
                <Link href="/orders">{t.orderHistory}</Link> — {t.orderHistoryDescription}
              </li>
            </ul>
          </div>
          {socials.length ? (
            <div className="contact-side__card reveal">
              <h3>{t.follow}</h3>
              <div className="contact-socialgrid">
                {socials.map((social) => {
                  const network = social.network.toLowerCase();
                  const icon = network.includes("facebook") ? faFacebook : network.includes("instagram") ? faInstagram : null;
                  const label = icon === faFacebook ? "Facebook" : icon === faInstagram ? "Instagram" : social.network;

                  return (
                    <a key={social.network} href={social.url} target="_blank" rel="noreferrer noopener"
                      aria-label={label} title={label}>
                      {icon ? <FontAwesomeIcon icon={icon} aria-hidden="true" /> : social.network}
                    </a>
                  );
                })}
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
