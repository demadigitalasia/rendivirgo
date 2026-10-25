import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerLapidaryDashboard } from "@/components/customer-lapidary";

export const metadata: Metadata = { title: "Lapidary projects | RENDI VIRGO", robots: { index: false, follow: false } };

export default function CustomerLapidaryPage() {
  return <Suspense fallback={<section className="customer-account customer-lapidary"><p>Loading your lapidary projects…</p></section>}><CustomerLapidaryDashboard /></Suspense>;
}
