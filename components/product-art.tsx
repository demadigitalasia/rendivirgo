import type { ProductTone } from "@/lib/catalog";

export function ProductArt({ tone, label }: { tone: ProductTone; label?: string }) {
  return (
    <div className={`product-art product-art--${tone}`} role="img" aria-label={label ?? "Natural stone preview"}>
      {label && <span className="product-art__label">{label}</span>}
    </div>
  );
}
