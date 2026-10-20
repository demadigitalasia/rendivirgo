import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/admin/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password | RENDI VIRGO", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function AdminResetPasswordPage() {
  return (
    <Suspense fallback={<div className="rv-login" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
