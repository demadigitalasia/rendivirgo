import type { Metadata } from "next";
import { CustomerOrderPage } from "@/components/customer-account";

export const metadata: Metadata = { title: "Order details | RENDI VIRGO", robots: { index: false, follow: false } };
export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  return <CustomerOrderPage orderNumber={orderNumber} />;
}

