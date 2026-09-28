import type { OrderEmailData } from "./email.templates";

type DecimalLike = { toNumber(): number };

export type OrderEmailSource = {
  orderNumber: string;
  customerName: string;
  currency: string;
  subtotal: DecimalLike;
  discountTotal: DecimalLike;
  shippingCost: DecimalLike;
  total: DecimalLike;
  shippingName: string | null;
  customerNote?: string | null;
  items: Array<{ name: string; quantity: number; lineTotal: DecimalLike }>;
};

export const buildOrderEmailData = (order: OrderEmailSource): OrderEmailData => ({
  orderNumber: order.orderNumber,
  customerName: order.customerName,
  currency: order.currency,
  subtotal: order.subtotal.toNumber(),
  discountTotal: order.discountTotal.toNumber(),
  shippingCost: order.shippingCost.toNumber(),
  total: order.total.toNumber(),
  shippingName: order.shippingName,
  customerNote: order.customerNote ?? null,
  items: order.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    lineTotal: item.lineTotal.toNumber(),
  })),
});
