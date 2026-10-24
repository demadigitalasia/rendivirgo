import type { Metadata } from "next";
import { CustomerAccess } from "@/components/customer-account";

export const metadata: Metadata = { title: "Finish setting up your account | RENDI VIRGO", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <CustomerAccess mode="verify" token={token ?? ""} />;
}

