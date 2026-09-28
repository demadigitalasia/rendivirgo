import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderHistory } from "@/components/order-history";

export const metadata: Metadata = {
  title: "My Orders | RENDI VIRGO",
  description: "View every order placed with your email using a secure one-time link.",
  alternates: { canonical: "/orders" },
  robots: { index: false, follow: true },
};

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="page-container section" style={{ minHeight: 320 }} />}>
      <OrderHistory />
    </Suspense>
  );
}
