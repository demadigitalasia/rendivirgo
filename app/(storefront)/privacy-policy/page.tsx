import type { Metadata } from "next";
import { ApiContentPage, contentPageMetadata } from "@/components/api-content-page";

export const dynamic = "force-dynamic";

const fallback = {
  title: "Privacy Policy | RENDI VIRGO",
  description: "How RENDI VIRGO plans to collect, use, and protect contact, shipping, order, and payment-reference information.",
};

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata("privacy-policy", fallback);
}

export default function PrivacyPage() {
  return <ApiContentPage slug="privacy-policy" eyebrow="Your information" />;
}
