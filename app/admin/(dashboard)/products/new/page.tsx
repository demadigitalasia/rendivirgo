"use client";

import { useRouter } from "next/navigation";
import { ProductForm, type ApiProduct } from "@/components/admin/product-form";
import { toast } from "@/components/admin/toast";
import { PageHeader } from "@/components/admin/ui";

export default function NewProductPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader title="New product" subtitle="Create a catalog listing" />
      <div className="rv-content">
        <ProductForm
          mode="create"
          onSaved={(created: ApiProduct) => {
            toast.success(`Created "${created.name}"`);
            router.push(`/admin/products/${created.id}`);
          }}
          onCancel={() => router.push("/admin/products")}
        />
      </div>
    </>
  );
}
