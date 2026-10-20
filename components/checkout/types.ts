export type ShippingOption = {
  id: string;
  name: string;
  carrier: string | null;
  price: number;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  breakdown: Record<string, number>;
};

export type ShippingQuote = {
  options: ShippingOption[];
  source: "CarrierAPI" | "AdminOverride" | "FreeShipping";
  overrideApplied: boolean;
};

export type Discount = {
  valid: boolean;
  code: string;
  type: string;
  discountAmount: number;
  freeShipping: boolean;
  message: string;
};

export type PaymentNotice = "cancelled" | "unavailable" | "failed" | "review" | "recovered" | "expired" | "terminal";
export type ShippingQuoteStatus = "loading" | "ready" | "unavailable" | "error";
export type PaymentAvailability = "loading" | "available" | "unavailable" | "error";

export type PaymentResult = {
  orderId: string;
  orderNumber: string;
  total: number;
  paymentStatus: "Paid" | "Pending";
  paymentMethod?: "PayPal" | "BankTransfer";
  paymentProofUploadedAt?: string | null;
  orderStatus?: string;
  retryAllowed?: boolean;
  notice?: PaymentNotice;
};

export type BankTransferDetails = {
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  swiftCode: string;
  currency: string;
};

export type PaymentMethods = {
  paypal: { enabled: boolean };
  bankTransfer: BankTransferDetails;
};

export type CheckoutPriceQuote = {
  quoteToken: string;
  expiresAt: string;
  currency: string;
  subtotal: number;
  shippingCost: number;
  discountTotal: number;
  total: number;
  shippingName: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
};
