import type { Metadata } from "next";
import { CustomerDashboard } from "@/components/customer-account";

export const metadata: Metadata = { title: "My orders | RENDI VIRGO", robots: { index: false, follow: false } };
export default function CustomerOrdersPage() { return <CustomerDashboard ordersOnly />; }

