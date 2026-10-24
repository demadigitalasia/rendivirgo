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
  logo: "/brand/rendi-virgo-primary.webp",
  opacity: 0.35,
  size: 18,
  x: 69,
  y: 86,
};
