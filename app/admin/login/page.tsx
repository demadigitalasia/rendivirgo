import { Suspense } from "react";
import { LoginForm } from "@/components/admin/login-form";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="rv-login" />}>
      <LoginForm />
    </Suspense>
  );
}
