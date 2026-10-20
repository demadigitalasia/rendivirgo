import type { Metadata } from "next";
import { CustomerDashboard } from "@/components/customer-account";

export const metadata: Metadata = { title: "My account | RENDI VIRGO", robots: { index: false, follow: false } };

export default function CustomerAccountPage() {
  return <CustomerDashboard />;
}
