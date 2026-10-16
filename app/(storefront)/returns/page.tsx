import type { Metadata } from "next";
import { ReturnRequestForm } from "@/components/return-request-form";
import { storefrontMetadata } from "@/lib/storefront-metadata";

export const generateMetadata = (): Promise<Metadata> => storefrontMetadata("returns", "/returns");

export default function ReturnsPage() {
  return (
    <main className="page-container content-page">
      <ReturnRequestForm />
    </main>
  );
}
