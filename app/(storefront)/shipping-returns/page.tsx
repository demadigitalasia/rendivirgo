import type { Metadata } from "next";
import { ApiContentPage, contentPageMetadata } from "@/components/api-content-page";

export const dynamic = "force-dynamic";

const fallback = {
  title: "Shipping & Returns | RENDI VIRGO",
  description: "Worldwide shipping calculated as one parcel by total order weight, with admin rate control for special cases. Return policy details for launch.",
};

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata("shipping-returns", fallback);
}

export default function ShippingPage() {
  return <ApiContentPage slug="shipping-returns" eyebrow="Delivery" />;
}
