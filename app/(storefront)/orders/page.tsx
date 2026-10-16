import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderHistory } from "@/components/order-history";
import { storefrontMetadata } from "@/lib/storefront-metadata";

export const generateMetadata = (): Promise<Metadata> => storefrontMetadata("orders", "/orders", { robots: { index: false, follow: true } });

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="page-container section" style={{ minHeight: 320 }} />}>
      <OrderHistory />
    </Suspense>
  );
}
