export type ProductWatermarkSettings = {
  enabled: boolean;
  logo: string;
  opacity: number;
  size: number;
  x: number;
  y: number;
};

export const defaultProductWatermark: ProductWatermarkSettings = {
  enabled: true,
  logo: "/brand/rendi-virgo-logo-white.webp",
  opacity: 0.35,
  size: 18,
  x: 69,
  y: 86,
};
