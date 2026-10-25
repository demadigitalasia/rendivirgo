import type { Metadata } from "next";
import { LapidaryCustomOrder } from "@/components/lapidary/pages";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();
  return { title: language === "id" ? "Permintaan Custom Lapidary — RENDI VIRGO" : "Custom Lapidary Request — RENDI VIRGO", description: language === "id" ? "Kirim brief pemotongan batu dan dapatkan peninjauan serta penawaran dari studio RENDI VIRGO." : "Share your stone cutting brief and receive an assessment and quote from the RENDI VIRGO studio.", alternates: localizedAlternates("/lapidary/custom-order", language) };
}

export default async function LapidaryCustomOrderPage() {
  return <LapidaryCustomOrder language={await getRequestLanguage()} />;
}
