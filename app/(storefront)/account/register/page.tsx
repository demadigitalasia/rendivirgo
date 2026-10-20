import type { Metadata } from "next";
import { CustomerAccess } from "@/components/customer-account";

export const metadata: Metadata = { title: "Create account | RENDI VIRGO", robots: { index: false, follow: false } };
export default function RegisterPage() { return <CustomerAccess mode="register" />; }

