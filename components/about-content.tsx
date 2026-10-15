"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowIcon, BagIcon, GlobeIcon, HeartIcon, LeafIcon, SearchIcon, SparkleIcon } from "@/components/icons";

export type AboutContentProps = {
  ownerName: string;
  ownerRole: string;
  ownerBio: string;
  ownerImage: string;
  heroImage: string;
  email: string;
  storyParagraphs: string[];
};

const values = [
  {
    icon: LeafIcon,
    title: "Authentic Indonesian material",
    body: "Sourced from miners, cutters, and small workshops across the archipelago — never mass produced.",
  },
  {
    icon: SearchIcon,
    title: "Photographed as it is",
    body: "Natural light, true scale, and close-ups of every crack, inclusion, and character mark.",
  },
  {
    icon: HeartIcon,
    title: "One of a kind, truly",
    body: "Most pieces exist exactly once. When a unique stone finds a home, it is gone forever.",
  },
  {
    icon: BagIcon,
    title: "Packed by hand",
    body: "Every order is wrapped with care in Indonesia and shipped worldwide with tracking.",
  },
];

const steps = [
  {
    index: "01",
    title: "Source",
    body: "We travel and trade directly with trusted cutters and workshops from West Java to Kalimantan.",
  },
  {
    index: "02",
    title: "Select",
    body: "Only stones with honest colour, stable structure, and a story worth telling make the collection.",
  },
  {
    index: "03",
    title: "Document",
    body: "Weight, dimensions, origin, and condition are measured and disclosed — including the flaws.",
  },
  {
    index: "04",
    title: "Deliver",
    body: "Hand-packed in 1–3 business days, shipped worldwide as one parcel calculated by total weight.",
  },
];

export function AboutContent({ ownerName, ownerRole, ownerBio, ownerImage, heroImage, email, storyParagraphs }: AboutContentProps) {

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
            <div className="eyebrow eyebrow--light">The story behind the stones</div>
            <h1>
              Indonesia&apos;s stones,
              <br />
              on the world stage.
            </h1>
            <p>
              RENDI VIRGO is an independent collection built around curiosity, provenance, and respect for
              natural material — from rough and slab to finished cabochons for collectors and makers.
            </p>
            <div className="about-hero__actions">
              <Link href="/shop" className="button button--light">
                Explore the collection <ArrowIcon />
              </Link>
              <Link href="/contact" className="button about-hero__ghost">
                Talk to us
              </Link>
            </div>
          </div>
          <dl className="about-hero__facts">
            <div>
              <dt>Pieces</dt>
              <dd>One of a kind</dd>
            </div>
            <div>
              <dt>Origin</dt>
              <dd>Indonesian archipelago</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>Worldwide, tracked</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="page-container about-story">
        <div className="about-story__head reveal">
          <div className="eyebrow">Our story</div>
          <h2>A simple conviction, kept honestly.</h2>
          <div className="about-chips" aria-label="Sourcing regions">
            <span>West Java</span>
            <span>Kalimantan</span>
            <span>Archipelago workshops</span>
          </div>
        </div>
        <div className="about-story__body">
          {storyParagraphs.map((paragraph, index) => (
            <p key={index} className={index === 0 ? "about-lede reveal" : "reveal"}>
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section className="page-container about-values">
        <div className="section-heading reveal">
          <h2>What we stand by</h2>
        </div>
        <div className="about-values__grid">
          {values.map((value) => (
            <article key={value.title} className="about-value reveal">
              <span className="about-value__icon" aria-hidden="true">
                <value.icon />
              </span>
              <h3>{value.title}</h3>
              <p>{value.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-process">
        <div className="page-container">
          <div className="eyebrow eyebrow--light reveal">How a stone reaches you</div>
          <h2 className="reveal">From the ground to your door.</h2>
          <ol className="about-steps">
            {steps.map((step) => (
              <li key={step.index} className="reveal">
                <span className="about-steps__index" aria-hidden="true">
                  {step.index}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="page-container about-owner">
        <div className="about-owner__card reveal">
          <div className="about-owner__portrait">
            {ownerImage.startsWith("/") ? (
              <Image src={ownerImage} alt={ownerName} fill sizes="(max-width: 720px) 100vw, 320px" />
            ) : (
              <img src={ownerImage} alt={ownerName} />
            )}
          </div>
          <div className="about-owner__copy">
            <div className="eyebrow">The curator</div>
            <h2>{ownerName}</h2>
            {ownerRole ? <p className="about-owner__role">{ownerRole}</p> : null}
            <p>{ownerBio}</p>
            <div className="about-owner__actions">
              <Link href="/shop" className="button">
                Shop the collection <ArrowIcon />
              </Link>
              <a href={`mailto:${email}`} className="text-button">
                {email}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="page-container about-promise">
        <div className="about-promise__grid">
          <article className="reveal">
            <GlobeIcon />
            <h3>Worldwide shipping</h3>
            <p>One parcel, calculated by total weight at checkout. Tracked from our hands to yours.</p>
            <Link href="/shipping-returns" className="text-button">
              Shipping &amp; returns
            </Link>
          </article>
          <article className="reveal">
            <SparkleIcon />
            <h3>Honest listings</h3>
            <p>Treatments disclosed, flaws photographed, scale always shown. What you see is what travels.</p>
            <Link href="/shop" className="text-button">
              Browse unique pieces
            </Link>
          </article>
          <article className="reveal">
            <LeafIcon />
            <h3>Natural character</h3>
            <p>Inclusions and colour variation are nature&apos;s signature — never a defect to hide.</p>
            <Link href="/blog" className="text-button">
              Read the journal
            </Link>
          </article>
        </div>
      </section>

      <section className="page-container about-cta">
        <div className="about-cta__panel reveal">
          <div className="eyebrow eyebrow--light">Begin anywhere</div>
          <h2>Find the stone that finds you.</h2>
          <p>New pieces land regularly — and one-of-a-kind stones move fast.</p>
          <div className="about-cta__actions">
            <Link href="/shop" className="button button--light">
              Explore the collection <ArrowIcon />
            </Link>
            <Link href="/contact" className="button about-hero__ghost">
              Ask about a stone
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
