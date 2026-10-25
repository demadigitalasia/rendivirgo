import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerLapidaryDashboard, CustomerLapidaryFallback } from "@/components/customer-lapidary";

export const metadata: Metadata = { title: "Lapidary projects | RENDI VIRGO", robots: { index: false, follow: false } };

export default function CustomerLapidaryPage() {
  return <Suspense fallback={<CustomerLapidaryFallback />}><CustomerLapidaryDashboard /></Suspense>;
}
