import type { Metadata } from "next";
import { AboutContent } from "@/components/about-content";
import { getPage, getPublicSettings, getSiteContent } from "@/lib/storefront";

export const revalidate = 60;

const fallback = {
  title: "About Us — Sourcing Indonesian Stones | RENDI VIRGO",
  description:
    "RENDI VIRGO is an independent stone collection built around curiosity, provenance, and sharing authentic Indonesian material with collectors and makers worldwide.",
};

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("about-us");
  return {
    title: page?.metaTitle ?? fallback.title,
    description: page?.metaDescription ?? fallback.description,
    alternates: { canonical: "/about-us" },
  };
}

const fallbackStory = [
  "RENDI VIRGO began with a simple conviction: Indonesia's natural stones deserve a place on the world stage.",
  "We work directly with cutters, miners, and small workshops across the archipelago — from West Java to Kalimantan — to bring one-of-a-kind pieces to collectors, jewellers, and makers.",
  "Every stone is photographed as it is. Every order is packed by hand. Nothing is mass produced, because nature never repeats itself.",
];

export default async function AboutPage() {
  const [siteContent, store, page] = await Promise.all([getSiteContent(), getPublicSettings(), getPage("about-us")]);

  const rawBody = page?.body?.trim() ? page.body : fallbackStory.join("\n\n");
  const storyParagraphs = rawBody
    .split(/\n{2,}|\r{2,}/)
    .map((paragraph) => paragraph.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "").replace(/^-\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6);

  return (
    <AboutContent
      ownerName={siteContent.ownerName || "RENDI VIRGO"}
      ownerRole={siteContent.ownerRole || "Founder & Curator"}
      ownerBio={siteContent.ownerBio}
      ownerImage={siteContent.ownerImage}
      heroImage={siteContent.heroImage}
      email={store.store.email || "cs@rendivirgo.com"}
      storyParagraphs={storyParagraphs.length ? storyParagraphs : fallbackStory}
    />
  );
}
