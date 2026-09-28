import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/admin/reset-password-form";

export default function AdminResetPasswordPage() {
  return (
    <Suspense fallback={<div className="rv-login" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
