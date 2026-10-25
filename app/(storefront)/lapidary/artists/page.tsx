import type { Metadata } from "next";
import { LapidaryArtists } from "@/components/lapidary/pages";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates } from "@/lib/locale";
import { getLapidaryContent } from "@/lib/storefront";
import { getLapidaryArtistSamples } from "@/lib/lapidary-artist-samples";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();
  const { artistsPresentation } = await getLapidaryContent(language);
  const title = language === "id" ? artistsPresentation.metaTitleId : artistsPresentation.metaTitleEn;
  const description = language === "id" ? artistsPresentation.metaDescriptionId : artistsPresentation.metaDescriptionEn;
  return {
    title,
    description,
    openGraph: { title, description, images: [artistsPresentation.heroImage] },
    twitter: { card: "summary_large_image", title, description, images: [artistsPresentation.heroImage] },
    alternates: localizedAlternates("/lapidary/artists", language),
  };
}

export default async function LapidaryArtistsPage() {
  const language = await getRequestLanguage();
  const content = await getLapidaryContent(language);
  const showSamples = process.env.NODE_ENV !== "production" && content.artists.length === 0;
  const artists = showSamples ? getLapidaryArtistSamples(language) : content.artists;
  return <LapidaryArtists language={language} artists={artists} presentation={content.artistsPresentation} samplePreview={showSamples} />;
}
