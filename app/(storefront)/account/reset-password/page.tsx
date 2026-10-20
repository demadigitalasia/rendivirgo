import type { Metadata } from "next";
import { CustomerAccess } from "@/components/customer-account";

export const metadata: Metadata = { title: "Choose a new password | RENDI VIRGO", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <CustomerAccess mode="reset" token={token ?? ""} />;
}

