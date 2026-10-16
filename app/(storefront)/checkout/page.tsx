import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutView } from "@/components/checkout-view";
import { storefrontMetadata } from "@/lib/storefront-metadata";

export const generateMetadata = (): Promise<Metadata> => storefrontMetadata("checkout", "/checkout", { robots: { index: false, follow: false } });

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutView />
    </Suspense>
  );
}
