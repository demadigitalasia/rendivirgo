import type { Metadata } from "next";
import { LapidaryLanding } from "@/components/lapidary/pages";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();
  return {
    title: language === "id" ? "Layanan Lapidary — RENDI VIRGO" : "Lapidary Services — RENDI VIRGO",
    description: language === "id" ? "Layanan pemotongan dan pembentukan batu alam dengan peninjauan studio dan penawaran sebelum pengerjaan." : "Custom stone cutting and shaping services, with a studio assessment and written quote before work begins.",
    alternates: localizedAlternates("/lapidary", language),
  };
}

export default async function LapidaryPage() {
  return <LapidaryLanding language={await getRequestLanguage()} />;
}
