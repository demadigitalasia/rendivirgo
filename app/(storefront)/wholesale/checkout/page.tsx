import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutView } from "@/components/checkout-view";

export const metadata: Metadata = { title: "Wholesale checkout | RENDI VIRGO", robots: { index: false, follow: false } };
export default function WholesaleCheckoutPage() { return <Suspense fallback={null}><CheckoutView /></Suspense>; }

