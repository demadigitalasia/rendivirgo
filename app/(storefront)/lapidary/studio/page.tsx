import type { Metadata } from "next";
import { LapidaryStudio } from "@/components/lapidary/pages";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates } from "@/lib/locale";
import { getLapidaryContent } from "@/lib/storefront";

export async function generateMetadata(): Promise<Metadata> {
  const [language, content] = await Promise.all([getRequestLanguage(), getLapidaryContent()]);
  const presentation = content.studioPresentation;
  const title = language === "id" ? presentation.metaTitleId : presentation.metaTitleEn;
  const description = language === "id" ? presentation.metaDescriptionId : presentation.metaDescriptionEn;
  return {
    title,
    description,
    openGraph: { title, description, images: [content.studioHeroImage] },
    twitter: { card: "summary_large_image", title, description, images: [content.studioHeroImage] },
    alternates: localizedAlternates("/lapidary/studio", language),
  };
}

export default async function LapidaryStudioPage() {
  const [language, content] = await Promise.all([getRequestLanguage(), getLapidaryContent()]);
  return <LapidaryStudio language={language} heroImage={content.studioHeroImage} images={content.studioImages} presentation={content.studioPresentation} />;
}
