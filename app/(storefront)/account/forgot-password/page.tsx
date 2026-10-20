import type { Metadata } from "next";
import { CustomerAccess } from "@/components/customer-account";

export const metadata: Metadata = { title: "Reset password | RENDI VIRGO", robots: { index: false, follow: false } };
export default function ForgotPasswordPage() { return <CustomerAccess mode="forgot" />; }

