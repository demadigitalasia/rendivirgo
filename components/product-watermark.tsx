"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useProductWatermark } from "@/components/providers";

export function ProductWatermark() {
  const watermark = useProductWatermark();
  if (!watermark.enabled || !watermark.logo) return null;

  const size = Math.min(50, Math.max(8, Number.isFinite(watermark.size) ? watermark.size : 26));
  const opacity = Math.min(1, Math.max(0.1, Number.isFinite(watermark.opacity) ? watermark.opacity : 0.72));
  const x = Math.min(100, Math.max(0, Number.isFinite(watermark.x) ? watermark.x : 69));
  const y = Math.min(100, Math.max(0, Number.isFinite(watermark.y) ? watermark.y : 86));

  return (
    <span
      className="product-watermark"
      style={{
        "--watermark-size": `${size}%`,
        "--watermark-opacity": opacity,
        "--watermark-x": `${x}%`,
        "--watermark-y": `${y}%`,
      } as CSSProperties}
      aria-hidden="true"
    >
      <span className="product-watermark__mark">
        <Image className="product-watermark__logo" src={watermark.logo} alt="" width={600} height={200} unoptimized />
      </span>
    </span>
  );
}
