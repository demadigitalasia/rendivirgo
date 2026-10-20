import type { Metadata } from "next";
import { Suspense } from "react";
import { WholesaleStore } from "@/components/wholesale-store";

export const metadata: Metadata = { title: "Wholesale catalog | RENDI VIRGO", robots: { index: false, follow: false } };
export default function WholesalePage() {
  return <Suspense fallback={<div className="page-container section" style={{ minHeight: 520 }} />}><WholesaleStore /></Suspense>;
}

