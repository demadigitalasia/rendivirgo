import type { Metadata } from "next";
import { CustomerAccess } from "@/components/customer-account";

export const metadata: Metadata = { title: "Sign in | RENDI VIRGO", robots: { index: false, follow: false } };
export default function LoginPage() { return <CustomerAccess mode="login" />; }

