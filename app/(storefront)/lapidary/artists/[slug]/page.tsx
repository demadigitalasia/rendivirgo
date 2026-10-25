import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LapidaryArtistDetail } from "@/components/lapidary/pages";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates } from "@/lib/locale";
import { getLapidaryContent } from "@/lib/storefront";
import { getLapidaryArtistSamples } from "@/lib/lapidary-artist-samples";

type Props = { params: Promise<{ slug: string }> };

async function getArtist(slug: string, requestedLanguage?: "en" | "id") {
  const language = requestedLanguage ?? await getRequestLanguage();
  const content = await getLapidaryContent(language);
  const isSamplePreview = process.env.NODE_ENV !== "production" && content.artists.length === 0;
  const artist = content.artists.find((profile) => profile.slug === slug)
    ?? (isSamplePreview ? getLapidaryArtistSamples(language).find((profile) => profile.slug === slug) : undefined);
  return { language, content, artist, isSamplePreview: Boolean(artist && isSamplePreview) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { language, content, artist, isSamplePreview } = await getArtist(slug);
  if (!artist) return { title: language === "id" ? "Profil Pengrajin — RENDI VIRGO" : "Artist Profile — RENDI VIRGO" };
  const translated = language === "en" ? await getArtist(slug, "id") : null;
  const hasIndonesianTranslation = !isSamplePreview &&
    (language === "id" ? artist.contentLocale === "id" : translated?.artist?.contentLocale === "id");
  const path = `/lapidary/artists/${artist.slug}`;
  const description = artist.bio.slice(0, 320);
  return {
    title: `${artist.name} — ${language === "id" ? "Pengrajin Lapidary" : "Lapidary Artist"} | RENDI VIRGO`,
    description,
    openGraph: { title: artist.name, description, images: artist.imageUrl ? [artist.imageUrl] : [content.artistsPresentation.heroImage] },
    alternates: localizedAlternates(path, language, hasIndonesianTranslation),
  };
}

export default async function LapidaryArtistProfilePage({ params }: Props) {
  const { slug } = await params;
  const { language, content, artist, isSamplePreview } = await getArtist(slug);
  if (!artist) notFound();
  return <LapidaryArtistDetail language={language} artist={artist} presentation={content.artistsPresentation} samplePreview={isSamplePreview} />;
}
