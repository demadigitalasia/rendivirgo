import type { ProductTone } from "@/lib/catalog";

export function ProductArt({ tone, label, large = false }: { tone: ProductTone; label?: string; large?: boolean }) {
  return (
    <div className={`product-art product-art--${tone} ${large ? "product-art--large" : ""}`} aria-label={label ?? "Natural stone preview"} role="img">
      <span className="product-art__glow" />
      <span className="product-art__stone product-art__stone--one" />
      <span className="product-art__stone product-art__stone--two" />
      <span className="product-art__stone product-art__stone--three" />
      {label && <span className="product-art__label">{label}</span>}
    </div>
  );
}
