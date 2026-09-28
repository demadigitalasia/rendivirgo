import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutView } from "@/components/checkout-view";

export const metadata: Metadata = {
  title: "Checkout | RENDI VIRGO",
  description: "Secure checkout with worldwide shipping calculated from total order weight and PayPal payment in USD.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutView />
    </Suspense>
  );
}
