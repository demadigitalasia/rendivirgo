import type { Metadata } from "next";
import { ApiContentPage, contentPageMetadata } from "@/components/api-content-page";

export const dynamic = "force-dynamic";

const fallback = {
  title: "FAQ — Payment, Shipping & Stock | RENDI VIRGO",
  description: "Answers about natural stones, PayPal payment in USD, one-package shipping calculation, and when stock is reserved.",
};

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata("faq", fallback);
}

export default function FaqPage() {
  return <ApiContentPage slug="faq" eyebrow="Helpful details" />;
}
