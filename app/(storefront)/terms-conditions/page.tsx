import type { Metadata } from "next";
import { ApiContentPage, contentPageMetadata } from "@/components/api-content-page";

export const dynamic = "force-dynamic";

const fallback = {
  title: "Terms & Conditions | RENDI VIRGO",
  description: "Store terms covering product descriptions, orders and PayPal payment, shipping charges, and the final legal review before launch.",
};

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata("terms-conditions", fallback);
}

export default function TermsPage() {
  return <ApiContentPage slug="terms-conditions" eyebrow="Store terms" />;
}
