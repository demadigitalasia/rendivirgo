import type { Metadata } from "next";
import { WholesaleRoutes } from "@/components/wholesale-routes";
export const metadata: Metadata = { title: "Wholesale — Finished Products & Rough Materials | RENDI VIRGO", description: "Choose finished wholesale products for approved buyers or explore bulk rough materials without an account." };
export default function WholesalePage() { return <WholesaleRoutes />; }
