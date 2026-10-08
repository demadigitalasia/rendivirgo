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
  logo: "/brand/rendi-virgo-logo-white.png",
  opacity: 0.72,
  size: 26,
  x: 69,
  y: 86,
};
