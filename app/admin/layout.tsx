import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin | RENDI VIRGO",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
