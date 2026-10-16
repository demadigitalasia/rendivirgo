import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { storefrontMetadata } from "@/lib/storefront-metadata";

export const generateMetadata = (): Promise<Metadata> => storefrontMetadata("cart", "/cart", { robots: { index: false, follow: true } });

export default function CartPage() {
  return <CartView />;
}
