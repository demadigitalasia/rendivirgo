export type ProductStatus = "Available" | "Sold" | "Reserved";
export type ProductTone = "moss" | "jade" | "amber" | "ocean" | "earth";
export type StockModel = "Unique" | "Quantity";
export type Unit = "piece" | "pair" | "gram" | "carat" | "strand" | "bag";
export type ShippingClass = "Standard" | "Fragile" | "Oversized" | "Custom";
export type DimensionsMm = { length: number; width: number; height: number };

export type ProductVariant = {
  id: string;
  sku: string;
  name: string;
  price: number;
  stockQuantity: number;
  weightGram: number;
  dimensionsMm: DimensionsMm;
  shippingProfileId: string;
};

export type ShippingProfile = {
  packageWeightGram: number;
  packageDimensionsMm: DimensionsMm;
  shippingProfileId: string;
  shippingClass: ShippingClass;
  calculationMethod: "CarrierAPI" | "AdminOverride";
  packageModel: "SinglePackageTotalWeight";
};

export type ProductSeo = {
  metaTitle: string;
  metaDescription: string;
};

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: string;
  categorySlug: string;
  stoneType: string;
  origin: string;
  mohsHardness?: number | null;
  price: number;
  currency: "USD";
  unit: Unit;
  stockModel: StockModel;
  stockQuantity?: number;
  weightGram: number;
  weightCarat: number;
  dimensionsMm: DimensionsMm;
  condition: string;
  conditionNote?: string | null;
  status: ProductStatus;
  tone: ProductTone;
  description: string;
  images: string[];
  seo: ProductSeo;
  shipping: ShippingProfile;
  featured?: boolean;
  fragile?: boolean;
  variants?: ProductVariant[];
  createdAt: string;
  updatedAt: string;
};

export const formatUSD = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

export const formatDimensions = ({ length, width, height }: DimensionsMm) => `${length} × ${width} × ${height} mm`;

export const maxQuantityFor = (product: Product, variantId?: string) => {
  const variant = product.variants?.find((item) => item.id === variantId);
  if (variant) return Math.max(1, variant.stockQuantity);
  if (product.stockModel === "Quantity") return Math.max(1, product.stockQuantity ?? 1);
  return 1;
};
