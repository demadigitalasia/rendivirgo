import type { Metadata } from "next";
import { WishlistView } from "@/components/wishlist-view";
import { storefrontMetadata } from "@/lib/storefront-metadata";

export const generateMetadata = (): Promise<Metadata> => storefrontMetadata("wishlist", "/wishlist", { robots: { index: false, follow: true } });

export default function WishlistPage() {
  return <WishlistView />;
}
