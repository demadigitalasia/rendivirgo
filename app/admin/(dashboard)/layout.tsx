import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";

const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:4000";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const session = cookieStore.get("rv_admin_session")?.value;

  if (!session) {
    redirect("/admin/login");
  }

  const response = await fetch(`${apiOrigin}/api/auth/me`, {
    headers: { cookie: `rv_admin_session=${session}` },
    cache: "no-store",
  });

  if (!response.ok) {
    redirect("/admin/login");
  }

  const payload = (await response.json()) as { admin: { name: string; email: string } };

  return <AdminShell admin={payload.admin}>{children}</AdminShell>;
}
