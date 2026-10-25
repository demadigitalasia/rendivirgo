import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderTracking } from "@/components/order-tracking";
import { storefrontMetadata } from "@/lib/storefront-metadata";

export const generateMetadata = (): Promise<Metadata> => storefrontMetadata("track", "/track", { robots: { index: false, follow: true } });

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="page-container section" style={{ minHeight: 320 }} />}>
      <OrderTracking />
    </Suspense>
  );
}
