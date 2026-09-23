import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";

export const metadata: Metadata = {
  title: "Shopping Cart | RENDI VIRGO",
  description: "Review your selected Indonesian stones before continuing to worldwide shipping and PayPal checkout.",
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return <CartView />;
}
