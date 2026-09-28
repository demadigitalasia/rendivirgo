import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderTracking } from "@/components/order-tracking";

export const metadata: Metadata = {
  title: "Track Your Order | RENDI VIRGO",
  description: "Track your RENDI VIRGO order status, payment, and shipping progress with your order number and email.",
  alternates: { canonical: "/track" },
  robots: { index: true, follow: true },
};

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="page-container section" style={{ minHeight: 320 }} />}>
      <OrderTracking />
    </Suspense>
  );
}
