import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout-view";

export const metadata: Metadata = {
  title: "Checkout | RENDI VIRGO",
  description: "International checkout preview with PayPal simulation, USD pricing, and one-package shipping calculated from total order weight.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutView />;
}
