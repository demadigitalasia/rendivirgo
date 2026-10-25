import type { Metadata } from "next";
import { LapidaryStandards } from "@/components/lapidary/pages";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates } from "@/lib/locale";
import { getLapidaryContent } from "@/lib/storefront";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();
  const { processPresentation } = await getLapidaryContent(language);
  return { title: language === "id" ? processPresentation.metaTitleId : processPresentation.metaTitleEn, description: language === "id" ? processPresentation.metaDescriptionId : processPresentation.metaDescriptionEn, alternates: localizedAlternates("/lapidary/process", language) };
}

export default async function LapidaryProcessPage() {
  const language = await getRequestLanguage();
  const { processPresentation } = await getLapidaryContent(language);
  return <LapidaryStandards language={language} presentation={processPresentation} />;
}
