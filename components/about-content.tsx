"use client";

import Image from "next/image";
import Link from "@/components/localized-link";
import { ArrowIcon, BagIcon, GlobeIcon, HeartIcon, LeafIcon, SparkleIcon } from "@/components/icons";
import { useCopy, useLanguage } from "@/components/providers";
import type { Language } from "@/lib/i18n";

export type AboutContentProps = {
  ownerName: string;
  ownerRole: string;
  ownerBio: string;
  ownerImage: string;
  heroImage: string;
  email: string;
  storyParagraphs: string[];
  contentLanguage?: Language;
  ownerBioLanguage?: Language;
};

export function AboutContent({
  ownerName,
  ownerRole,
  ownerBio,
  ownerImage,
  heroImage,
  email,
  storyParagraphs,
  contentLanguage = "en",
  ownerBioLanguage = "en",
}: AboutContentProps) {
  const t = useCopy();
  const { language } = useLanguage();
  const copy = t.about;
  const valueIcons = [LeafIcon, SparkleIcon, HeartIcon, BagIcon];
  const promiseIcons = [GlobeIcon, SparkleIcon, LeafIcon];
  const owners = [
    {
      key: "rendi",
      name: ownerName,
      image: ownerImage,
      role: ownerRole,
      alt: `${ownerName}, ${ownerRole}`,
    },
    {
      key: "pajar",
      name: "PAJAR AGUNG",
      image: "/images/pajar-agung-owner-cutout.png",
      role: ownerRole,
      alt: copy.pajarPortrait,
    },
  ];
  const localizedOwnerRole = (role: string) =>
    language === "id" && role === "Founder & Curator" ? "Pendiri & kurator" : role;
  return (
    <div>
      <section className="about-hero">
        {heroImage.startsWith("/") ? (
          <Image className="about-hero__image" src={heroImage} alt="" fill sizes="100vw" preload />
        ) : (
          <img className="about-hero__image" src={heroImage} alt="" />
        )}
        <div className="about-hero__overlay" aria-hidden="true" />
        <div className="page-container about-hero__inner">
          <div className="about-hero__copy">
            <div className="eyebrow eyebrow--light">{copy.heroEyebrow}</div>
            <h1>{copy.title.split("\n").map((line, index) => <span key={line}>{index ? <br /> : null}{line}</span>)}</h1>
            <p>{copy.intro}</p>
            <div className="about-hero__actions">
              <Link href="/shop" className="button button--light">
                {copy.explore} <ArrowIcon />
              </Link>
              <Link href="/contact" className="button about-hero__ghost">
                {copy.talk}
              </Link>
            </div>
          </div>
          <dl className="about-hero__facts">
            <div>
              <dt>{copy.pieces}</dt>
              <dd>{copy.oneOfAKind}</dd>
            </div>
            <div>
              <dt>{copy.origin}</dt>
              <dd>{copy.archipelago}</dd>
            </div>
            <div>
              <dt>{copy.shipping}</dt>
              <dd>{copy.worldwideTracked}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="page-container about-story">
        <div className="about-story__head reveal">
          <div className="eyebrow">{copy.story}</div>
          <h2>{copy.storyTitle}</h2>
          <div className="about-chips" aria-label={copy.sourcingRegions}>
            <span>West Java</span>
            <span>Kalimantan</span>
            <span>Indonesia</span>
          </div>
        </div>
        <div className="about-story__body" lang={contentLanguage}>
          {language === "id" && contentLanguage === "en" ? <p className="muted" role="note">{t.draft.fallback}</p> : null}
          {storyParagraphs.map((paragraph, index) => (
            <p key={index} className={index === 0 ? "about-lede reveal" : "reveal"}>
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section className="page-container about-values">
        <div className="section-heading reveal">
          <h2>{copy.valuesTitle}</h2>
        </div>
        <div className="about-values__grid">
          {copy.values.map((value, index) => {
            const Icon = valueIcons[index];
            return (
            <article key={value.title} className="about-value reveal">
              <span className="about-value__icon" aria-hidden="true">
                <Icon />
              </span>
              <h3>{value.title}</h3>
              <p>{value.body}</p>
            </article>
            );
          })}
        </div>
      </section>

      <section className="about-process">
        <div className="page-container">
          <div className="eyebrow eyebrow--light reveal">{copy.processEyebrow}</div>
          <h2 className="reveal">{copy.processTitle}</h2>
          <ol className="about-steps">
            {copy.steps.map((step, index) => (
              <li key={step.title} className="reveal">
                <span className="about-steps__index" aria-hidden="true">
                  0{index + 1}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="page-container about-owner">
        <div className="about-owner__heading reveal">
          <div>
            <div className="eyebrow">{copy.curator}</div>
            <h2>{copy.ownersTitle}</h2>
          </div>
          <div className="about-owner__intro">
            {language === "id" && ownerBioLanguage === "en" && ownerBio ? <p className="muted" role="note">{t.draft.fallback}</p> : null}
            {ownerBio ? <p lang={ownerBioLanguage}>{ownerBio}</p> : null}
          </div>
        </div>
        <div className="about-owner__grid">
          {owners.map((owner) => (
            <article className="about-owner__card reveal" key={owner.key}>
              <div className="about-owner__portrait">
                {owner.image.startsWith("/") ? (
                  <Image src={owner.image} alt={owner.alt} fill sizes="(max-width: 720px) 100vw, (max-width: 980px) 46vw, 560px" />
                ) : (
                  <img src={owner.image} alt={owner.alt} />
                )}
              </div>
              <div className="about-owner__copy">
                <h3>{owner.name}</h3>
                {owner.role ? <p className="about-owner__role">{localizedOwnerRole(owner.role)}</p> : null}
              </div>
            </article>
          ))}
        </div>
        <div className="about-owner__actions reveal">
          <Link href="/shop" className="button">
            {copy.browse} <ArrowIcon />
          </Link>
          <a href={`mailto:${email}`} className="text-button">{email}</a>
        </div>
      </section>

      <section className="page-container about-promise">
        <div className="about-promise__grid">
          {copy.promises.map((promise, index) => {
            const Icon = promiseIcons[index];
            const href = index === 0 ? "/shipping-returns" : index === 1 ? "/shop" : "/blog";
            const linkLabel = index === 0 ? t.footer.shipping : index === 1 ? copy.browse : t.nav.blog;
            return <article className="reveal" key={promise.title}>
              <Icon />
              <h3>{promise.title}</h3>
              <p>{promise.body}</p>
              <Link href={href} className="text-button">{linkLabel}</Link>
            </article>;
          })}
        </div>
      </section>

      <section className="page-container about-cta">
        <div className="about-cta__panel reveal">
          <div className="eyebrow eyebrow--light">{copy.begin}</div>
          <h2>{copy.closingTitle}</h2>
          <p>{copy.closingBody}</p>
          <div className="about-cta__actions">
            <Link href="/shop" className="button button--light">
              {copy.explore} <ArrowIcon />
            </Link>
            <Link href="/contact" className="button about-hero__ghost">
              {copy.talk}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
