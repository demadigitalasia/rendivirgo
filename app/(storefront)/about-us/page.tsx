import { socialMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { AboutContent } from "@/components/about-content";
import { getPage, getPublicSettings, getSiteContent } from "@/lib/storefront";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates, localizedPath } from "@/lib/locale";
import { dictionaries } from "@/lib/i18n";

export const revalidate = 60;

const fallback = {
  title: "About Us — Sourcing Indonesian Stones | RENDI VIRGO",
  description:
    "RENDI VIRGO is an independent stone collection built around curiosity, provenance, and sharing authentic Indonesian material with collectors and makers worldwide.",
};

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();
  const page = await getPage("about-us", language);
  const copy = dictionaries[language].metadata;
  const useLocalizedFallback = language === "id" && (!page || page.contentLocale === "en");
  return {
    title: useLocalizedFallback ? copy.aboutTitle : page?.metaTitle ?? page?.title ?? copy.aboutTitle,
    description: useLocalizedFallback ? copy.aboutDescription : page?.metaDescription ?? copy.aboutDescription,
    alternates: localizedAlternates("/about-us", language),
    ...socialMetadata(useLocalizedFallback ? copy.aboutTitle : page?.metaTitle || page?.title || copy.aboutTitle, useLocalizedFallback ? copy.aboutDescription : page?.metaDescription || copy.aboutDescription, localizedPath("/about-us", language)),
  };
}

const fallbackStory = [
  "RENDI VIRGO began with a simple conviction: Indonesia's natural stones deserve a place on the world stage.",
  "We work directly with cutters, miners, and small workshops across the archipelago — from West Java to Kalimantan — to bring one-of-a-kind pieces to collectors, jewellers, and makers.",
  "Every stone is photographed as it is. Every order is packed by hand. Nothing is mass produced, because nature never repeats itself.",
];

export default async function AboutPage() {
  const language = await getRequestLanguage();
  const [siteContent, store, page] = await Promise.all([getSiteContent(language), getPublicSettings(), getPage("about-us", language)]);

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
      ownerBioLanguage={siteContent.contentLocale}
      aboutRendiImage={siteContent.aboutRendiImage}
      aboutPajarImage={siteContent.aboutPajarImage}
      heroImage={siteContent.heroImage}
      email={store.store.email || "cs@rendivirgo.com"}
      storyParagraphs={storyParagraphs.length ? storyParagraphs : fallbackStory}
      contentLanguage={page?.contentLocale ?? "en"}
    />
  );
}
