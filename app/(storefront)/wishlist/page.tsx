import type { Metadata } from "next";
import { WishlistView } from "@/components/wishlist-view";

export const metadata: Metadata = {
  title: "Your Wishlist | RENDI VIRGO",
  description: "Pieces you saved on this device — revisit one-of-a-kind Indonesian stones before they find a new home.",
  alternates: { canonical: "/wishlist" },
  robots: { index: false, follow: true },
};

export default function WishlistPage() {
  return <WishlistView />;
}
