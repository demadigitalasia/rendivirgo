import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type OrderStatus } from "../../generated/prisma";
import type { Customer, OrderItem } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { signMagicToken, verifyMagicToken } from "../common/utils/magic-token";
import { EmailService } from "../email/email.service";
import {
  renderNewOrderAdminEmail,
  renderOrderCancelledEmail,
  renderOrderCompletedEmail,
  renderOrderReceivedEmail,
  renderOrderShippedEmail,
  renderOrdersLinkEmail,
} from "../email/email.templates";
import { buildOrderEmailData } from "../email/order-email-data";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { ShippingService } from "../settings/shipping.service";
import {
  CreateOrderDto,
  CreateOrderEventDto,
  OrderQueryDto,
  RefundOrderDto,
  UpdateOrderDto,
} from "./dto/order.dto";

export const orderInclude = {
  items: true,
  customer: true,
  discount: true,
  events: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.OrderInclude;

export const orderListInclude = {
  items: true,
  customer: true,
} satisfies Prisma.OrderInclude;

const checkoutProductInclude = {
  variants: true,
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
} satisfies Prisma.ProductInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type OrderListRow = Prisma.OrderGetPayload<{ include: typeof orderListInclude }>;
type OrderScalars = Prisma.OrderGetPayload<Record<never, never>>;
type CheckoutProduct = Prisma.ProductGetPayload<{ include: typeof checkoutProductInclude }>;

type CheckoutLine = {
  product: CheckoutProduct;
  variant: CheckoutProduct["variants"][number] | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
  weightGram: number;
  sku: string;
  name: string;
  imageUrl: string | null;
  fragile: boolean;
  oversized: boolean;
};

type ResolvedShipping = {
  name: string;
  carrier: string | null;
  shippingCost: Prisma.Decimal;
};

type ResolvedDiscount = {
  discount: Prisma.DiscountGetPayload<Record<never, never>>;
  discountTotal: Prisma.Decimal;
  shippingCost: Prisma.Decimal;
};

const SELLER_FALLBACK = {
  name: "RENDI VIRGO",
  address: "",
  email: "hello@rendivirgo.com",
  phone: "",
};

// Orders may only move forward through the fulfilment pipeline.
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  New: ["Processing", "Cancelled"],
  Processing: ["Packed", "Cancelled"],
  Packed: ["Shipped", "Cancelled"],
  Shipped: ["Completed", "Returned"],
  Completed: ["Returned"],
  Cancelled: [],
  Returned: [],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly magicSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipping: ShippingService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    this.magicSecret =
      this.config.get<string>("SESSION_SECRET") ??
      this.config.get<string>("ADMIN_PASSWORD") ??
      "rv-insecure-development-secret";
  }

  // ------------------------------------------------------------ mapping

  private orderBase(order: OrderScalars) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      email: order.email,
      customerName: order.customerName,
      phone: order.phone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentRef: order.paymentRef,
      currency: order.currency,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      discountTotal: order.discountTotal,
      taxTotal: order.taxTotal,
      total: order.total,
      refundedAmount: order.refundedAmount,
      discountId: order.discountId,
      discountCode: order.discountCode,
      shippingName: order.shippingName,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      totalWeightGram: order.totalWeightGram,
      shippingAddress: {
        line1: order.shippingLine1,
        line2: order.shippingLine2,
        city: order.shippingCity,
        state: order.shippingState,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry,
        countryCode: order.shippingCountryCode,
      },
      customerNote: order.customerNote,
      internalNote: order.internalNote,
      placedAt: order.placedAt,
      paidAt: order.paidAt,
      packedAt: order.packedAt,
      shippedAt: order.shippedAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toApiCustomerRef(customer: Customer) {
    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      tags: customer.tags,
      acceptsMarketing: customer.acceptsMarketing,
    };
  }

  private toApiOrderItem(item: OrderItem) {
    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      sku: item.sku,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      weightGram: item.weightGram,
      lineTotal: item.lineTotal,
      imageUrl: item.imageUrl,
    };
  }

  private toApiEvent(event: { id: string; type: string; message: string; adminId: string | null; createdAt: Date }) {
    return { id: event.id, type: event.type, message: event.message, adminId: event.adminId, createdAt: event.createdAt };
  }

  toApiOrder(order: OrderWithRelations) {
    return {
      ...this.orderBase(order),
      discount: order.discount
        ? {
            id: order.discount.id,
            code: order.discount.code,
            type: order.discount.type,
            value: order.discount.value,
          }
        : null,
      customer: order.customer ? this.toApiCustomerRef(order.customer) : null,
      items: order.items.map((item) => this.toApiOrderItem(item)),
      events: order.events.map((event) => this.toApiEvent(event)),
    };
  }

  private toApiOrderSummary(order: OrderListRow) {
    return {
      ...this.orderBase(order),
      customer: order.customer ? this.toApiCustomerRef(order.customer) : null,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      items: order.items.map((item) => this.toApiOrderItem(item)),
    };
  }

  // ------------------------------------------------------------ helpers

  private async nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const sequence = await tx.sequence.upsert({
      where: { key: `order:${dateKey}` },
      create: { key: `order:${dateKey}`, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `RV-${dateKey}-${String(sequence.value).padStart(4, "0")}`;
  }

  private parseDate(value: string, endOfDay = false): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid date "${value}"`);
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date;
  }

  private async resolveShipping(
    shippingRateId: string | undefined,
    subtotal: Prisma.Decimal,
    totalWeightGram: number,
    countryCode: string | undefined,
    fragile: boolean,
    oversized: boolean,
  ): Promise<ResolvedShipping> {
    return this.shipping.resolveOrderShipping({
      shippingRateId,
      subtotal,
      weightGram: totalWeightGram,
      countryCode,
      fragile,
      oversized,
    });
  }

  private async resolveDiscount(
    code: string | undefined,
    lines: CheckoutLine[],
    subtotal: Prisma.Decimal,
    shippingCost: Prisma.Decimal,
    email: string,
  ): Promise<ResolvedDiscount | null> {
    const normalized = code?.trim();
    if (!normalized) return null;

    const discount = await this.prisma.discount.findFirst({
      where: { code: { equals: normalized, mode: "insensitive" } },
    });
    if (!discount) throw new BadRequestException("Discount code is not valid");
    if (!discount.isActive) throw new BadRequestException("Discount code is no longer active");

    const now = new Date();
    if (discount.startsAt && discount.startsAt > now) throw new BadRequestException("Discount code is not active yet");
    if (discount.endsAt && discount.endsAt < now) throw new BadRequestException("Discount code has expired");
    if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
      throw new BadRequestException("Discount code has reached its usage limit");
    }

    // Category-scoped discounts only apply to eligible line items, and the
    // minimum subtotal is checked against that eligible base — matching the
    // public validation endpoint so the cart total and the order agree.
    let base = subtotal;
    if (discount.categoryId) {
      base = lines
        .filter((line) => line.product.categoryId === discount.categoryId)
        .reduce((sum, line) => sum.plus(line.unitPrice.mul(line.quantity)), new Prisma.Decimal(0))
        .toDecimalPlaces(2);
      if (base.lessThanOrEqualTo(0)) {
        throw new BadRequestException("This discount does not apply to any item in your cart");
      }
    }

    if (base.lessThan(discount.minSubtotal)) {
      throw new BadRequestException(`A minimum subtotal of ${discount.minSubtotal.toFixed(2)} is required for this discount`);
    }

    if (discount.perCustomerLimit !== null) {
      const previousUses = await this.prisma.order.count({
        where: {
          email,
          discountId: discount.id,
          paymentStatus: { not: "Failed" },
          status: { not: "Cancelled" },
        },
      });
      if (previousUses >= discount.perCustomerLimit) {
        throw new BadRequestException("This discount code has already been used the maximum number of times for this customer");
      }
    }

    let discountTotal = new Prisma.Decimal(0);
    let nextShippingCost = shippingCost;

    switch (discount.type) {
      case "Percentage":
        discountTotal = base.mul(discount.value).div(100).toDecimalPlaces(2);
        break;
      case "Fixed":
        discountTotal = discount.value;
        break;
      case "FreeShipping":
        nextShippingCost = new Prisma.Decimal(0);
        break;
    }

    if (discountTotal.greaterThan(base)) discountTotal = base;

    return { discount, discountTotal, shippingCost: nextShippingCost };
  }

  // ------------------------------------------------------------ inventory

  // Shared by admin cancellation and the unpaid-order expiry job.
  async releaseOrderInventory(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      include: { product: { select: { id: true, stockModel: true, stockQuantity: true } } },
    });

    for (const item of items) {
      if (!item.productId || !item.product) continue;
      if (item.product.stockModel === "Quantity") {
        if (item.variantId) {
          await tx.productVariant.updateMany({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        } else if (item.product.stockQuantity !== null) {
          await tx.product.updateMany({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }
      } else {
        await tx.product.updateMany({
          where: { id: item.productId, status: { in: ["Reserved", "Sold"] } },
          data: { status: "Published" },
        });
      }
    }
  }

  async markUniqueProductsSold(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const items = await tx.orderItem.findMany({ where: { orderId }, select: { productId: true } });
    const productIds = [
      ...new Set(items.map((item) => item.productId).filter((value): value is string => Boolean(value))),
    ];
    if (!productIds.length) return;
    await tx.product.updateMany({
      where: { id: { in: productIds }, stockModel: "Unique" },
      data: { status: "Sold" },
    });
  }

  // Returns a discount usage slot when an unpaid order is cancelled or expires,
  // so abandoned checkouts do not burn limited-use codes.
  async releaseDiscountUsage(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { discountId: true } });
    if (!order?.discountId) return;
    await tx.$executeRaw`
      UPDATE "Discount"
      SET "usedCount" = GREATEST("usedCount" - 1, 0)
      WHERE "id" = ${order.discountId}
    `;
  }

  // ------------------------------------------------------------ checkout

  async create(dto: CreateOrderDto) {
    const email = dto.email.trim().toLowerCase();
    const productIds = [...new Set(dto.items.map((item) => item.productId))];

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: checkoutProductInclude,
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    const lines: CheckoutLine[] = [];
    for (const item of dto.items) {
      const product = productById.get(item.productId);
      if (!product) throw new BadRequestException(`Product "${item.productId}" was not found`);
      if (product.status !== "Published") throw new BadRequestException(`"${product.name}" is not available`);

      const variant = item.variantId ? (product.variants.find((entry) => entry.id === item.variantId) ?? null) : null;
      if (item.variantId && !variant) throw new BadRequestException(`The selected variant of "${product.name}" was not found`);

      const shippingClass = variant?.shippingClass ?? product.shippingClass;

      lines.push({
        product,
        variant,
        quantity: item.quantity,
        unitPrice: variant ? variant.price : product.price,
        weightGram: variant ? variant.weightGram : product.weightGram,
        sku: variant ? variant.sku : product.sku,
        name: variant ? `${product.name} — ${variant.name}` : product.name,
        imageUrl: product.images[0]?.url ?? null,
        fragile: product.fragile,
        oversized: shippingClass === "Oversized",
      });
    }

    const quantityByProduct = new Map<string, number>();
    for (const line of lines) {
      quantityByProduct.set(line.product.id, (quantityByProduct.get(line.product.id) ?? 0) + line.quantity);
    }
    for (const [productId, quantity] of quantityByProduct) {
      const product = productById.get(productId);
      if (product && product.stockModel === "Unique" && quantity > 1) {
        throw new BadRequestException(`"${product.name}" is a unique piece and can only be ordered once`);
      }
    }

    const quantityByStockKey = new Map<string, { line: CheckoutLine; quantity: number }>();
    for (const line of lines) {
      if (line.product.stockModel !== "Quantity") continue;
      const key = `${line.product.id}:${line.variant?.id ?? ""}`;
      const entry = quantityByStockKey.get(key);
      if (entry) entry.quantity += line.quantity;
      else quantityByStockKey.set(key, { line, quantity: line.quantity });
    }
    for (const { line, quantity } of quantityByStockKey.values()) {
      const available = line.variant ? line.variant.stockQuantity : (line.product.stockQuantity ?? 0);
      if (available < quantity) throw new BadRequestException(`"${line.product.name}" does not have enough stock`);
    }

    let subtotal = new Prisma.Decimal(0);
    let totalWeightGram = 0;
    for (const line of lines) {
      subtotal = subtotal.plus(line.unitPrice.mul(line.quantity));
      totalWeightGram += line.weightGram * line.quantity;
    }
    subtotal = subtotal.toDecimalPlaces(2);

    const fragile = lines.some((line) => line.fragile);
    const oversized = lines.some((line) => line.oversized);
    const shippingResult = await this.resolveShipping(
      dto.shippingRateId,
      subtotal,
      totalWeightGram,
      dto.shippingAddress.countryCode,
      fragile,
      oversized,
    );
    const baseShippingCost = shippingResult.shippingCost;
    const discountResult = await this.resolveDiscount(dto.discountCode, lines, subtotal, baseShippingCost, email);

    const shippingCost = discountResult?.shippingCost ?? baseShippingCost;
    const discountTotal = discountResult?.discountTotal ?? new Prisma.Decimal(0);
    const total = subtotal.minus(discountTotal).plus(shippingCost).toDecimalPlaces(2);
    const currency = lines[0]?.product.currency ?? "USD";

    const order = await this.prisma.$transaction(async (tx) => {
      for (const { line, quantity } of quantityByStockKey.values()) {
        if (line.variant) {
          const result = await tx.productVariant.updateMany({
            where: { id: line.variant.id, stockQuantity: { gte: quantity } },
            data: { stockQuantity: { decrement: quantity } },
          });
          if (result.count === 0) throw new BadRequestException(`"${line.product.name}" does not have enough stock`);
        } else {
          const result = await tx.product.updateMany({
            where: { id: line.product.id, stockQuantity: { gte: quantity } },
            data: { stockQuantity: { decrement: quantity } },
          });
          if (result.count === 0) throw new BadRequestException(`"${line.product.name}" does not have enough stock`);
        }
      }

      const uniqueProductIds = [...new Set(lines.filter((line) => line.product.stockModel === "Unique").map((line) => line.product.id))];
      if (uniqueProductIds.length) {
        const result = await tx.product.updateMany({
          where: { id: { in: uniqueProductIds }, status: "Published" },
          data: { status: "Reserved" },
        });
        if (result.count !== uniqueProductIds.length) {
          throw new BadRequestException("One or more items are no longer available");
        }
      }

      const existingCustomer = await tx.customer.findUnique({ where: { email } });
      const customer = existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              name: dto.customerName,
              ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
              addressLine1: dto.shippingAddress.line1,
              addressLine2: dto.shippingAddress.line2 ?? existingCustomer.addressLine2,
              city: dto.shippingAddress.city,
              state: dto.shippingAddress.state ?? existingCustomer.state,
              postalCode: dto.shippingAddress.postalCode ?? existingCustomer.postalCode,
              country: dto.shippingAddress.country,
              countryCode: dto.shippingAddress.countryCode ?? existingCustomer.countryCode,
            },
          })
        : await tx.customer.create({
            data: {
              email,
              name: dto.customerName,
              phone: dto.phone ?? null,
              addressLine1: dto.shippingAddress.line1,
              addressLine2: dto.shippingAddress.line2 ?? null,
              city: dto.shippingAddress.city,
              state: dto.shippingAddress.state ?? null,
              postalCode: dto.shippingAddress.postalCode ?? null,
              country: dto.shippingAddress.country,
              countryCode: dto.shippingAddress.countryCode ?? null,
            },
          });

      const orderNumber = await this.nextOrderNumber(tx);

      const created = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          email,
          customerName: dto.customerName,
          phone: dto.phone ?? null,
          status: "New",
          paymentStatus: "Pending",
          currency,
          subtotal,
          shippingCost,
          discountTotal,
          total,
          discountId: discountResult?.discount.id ?? null,
          discountCode: discountResult?.discount.code ?? null,
          shippingName: shippingResult.name,
          carrier: shippingResult.carrier,
          totalWeightGram,
          shippingLine1: dto.shippingAddress.line1,
          shippingLine2: dto.shippingAddress.line2 ?? null,
          shippingCity: dto.shippingAddress.city,
          shippingState: dto.shippingAddress.state ?? null,
          shippingPostalCode: dto.shippingAddress.postalCode ?? null,
          shippingCountry: dto.shippingAddress.country,
          shippingCountryCode: dto.shippingAddress.countryCode ?? null,
          customerNote: dto.customerNote ?? null,
          items: {
            create: lines.map((line) => ({
              productId: line.product.id,
              variantId: line.variant?.id ?? null,
              name: line.name,
              sku: line.sku,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              weightGram: line.weightGram,
              lineTotal: line.unitPrice.mul(line.quantity).toDecimalPlaces(2),
              imageUrl: line.imageUrl,
            })),
          },
          events: {
            create: {
              type: "created",
              message: `Order ${orderNumber} was placed by ${dto.customerName}`,
            },
          },
        },
        include: orderInclude,
      });

      if (discountResult) {
        // Atomic usage claim: the update only succeeds while the code still has
        // capacity, so concurrent checkouts cannot exceed maxUses.
        const claimed = await tx.$executeRaw`
          UPDATE "Discount"
          SET "usedCount" = "usedCount" + 1
          WHERE "id" = ${discountResult.discount.id}
            AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
        `;
        if (claimed === 0) {
          throw new BadRequestException("Discount code has reached its usage limit");
        }
      }

      return created;
    });

    await this.prisma.notification.create({
      data: {
        type: "Order",
        title: `New order ${order.orderNumber}`,
        body: `${order.customerName} placed an order for ${order.currency} ${Number(order.total).toFixed(2)}`,
        href: `/admin/orders/${order.id}`,
        entityType: "Order",
        entityId: order.id,
      },
    });

    await this.sendOrderEmails(order);

    return this.toApiOrder(order);
  }

  private async sendOrderEmails(order: OrderWithRelations): Promise<void> {
    const emailData = buildOrderEmailData(order);
    const [notificationSettings, paymentSettings, storeEmail] = await Promise.all([
      this.settings.getNotificationSettings(),
      this.settings.getPaymentSettings(),
      this.settings.getStoreEmail(),
    ]);

    if (notificationSettings.orderConfirmation) {
      await this.email.send({
        to: order.email,
        subject: `Order ${order.orderNumber} received — payment pending`,
        html: renderOrderReceivedEmail({ ...emailData, paypalEnabled: paymentSettings.paypalEnabled }),
      });
    }

    await this.email.send({
      to: storeEmail,
      subject: `New order ${order.orderNumber} — ${order.currency} ${Number(order.total).toFixed(2)}`,
      html: renderNewOrderAdminEmail({ ...emailData, email: order.email }),
    });
  }

  // ------------------------------------------------------------ order history (magic link)

  async requestHistoryLink(email: string): Promise<{ ok: true }> {
    const normalized = email.trim().toLowerCase();
    const orderCount = await this.prisma.order.count({ where: { email: normalized } });

    // Always answer the same way so the endpoint cannot be used to probe emails.
    if (orderCount === 0) {
      this.logger.log(`Order history link requested for unknown email ${normalized}`);
      return { ok: true };
    }

    const ttlMinutes = 30;
    const token = signMagicToken({ email: normalized, exp: Date.now() + ttlMinutes * 60_000 }, this.magicSecret);
    const origin = (this.config.get<string>("APP_ORIGIN") ?? "http://localhost:3000")
      .split(",")[0]
      .trim()
      .replace(/\/+$/, "");
    const link = `${origin}/orders?token=${encodeURIComponent(token)}`;

    await this.email.send({
      to: normalized,
      subject: "Your RENDI VIRGO order history link",
      html: renderOrdersLinkEmail({ link, expiresMinutes: ttlMinutes }),
    });

    return { ok: true };
  }

  async history(token: string) {
    const payload = verifyMagicToken(token.trim(), this.magicSecret);
    if (!payload) throw new BadRequestException("This link is invalid or has expired");

    const orders = await this.prisma.order.findMany({
      where: { email: payload.email },
      orderBy: { placedAt: "desc" },
      take: 50,
      include: { items: { select: { name: true, quantity: true, lineTotal: true, imageUrl: true } } },
    });

    return {
      email: payload.email,
      expiresAt: new Date(payload.exp).toISOString(),
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        currency: order.currency,
        total: order.total,
        placedAt: order.placedAt,
        shippingName: order.shippingName,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          imageUrl: item.imageUrl,
        })),
      })),
    };
  }

  async track(orderNumber: string, email?: string) {    const normalized = email?.trim().toLowerCase();
    const order = await this.prisma.order.findUnique({ where: { orderNumber }, include: { items: true } });
    if (!order || !normalized || order.email.toLowerCase() !== normalized) {
      throw new NotFoundException("Order not found");
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      shippingCost: order.shippingCost,
      total: order.total,
      customerName: order.customerName,
      shippingName: order.shippingName,
      items: order.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        imageUrl: item.imageUrl,
      })),
      tracking: {
        carrier: order.carrier,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
      },
      shippingAddress: {
        city: order.shippingCity,
        state: order.shippingState,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry,
      },
      placedAt: order.placedAt,
      paidAt: order.paidAt,
      packedAt: order.packedAt,
      shippedAt: order.shippedAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
    };
  }

  // ------------------------------------------------------------ admin queries

  private buildAdminWhere(query: OrderQueryDto): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (query.from || query.to) {
      where.placedAt = {
        ...(query.from ? { gte: this.parseDate(query.from) } : {}),
        ...(query.to ? { lte: this.parseDate(query.to, true) } : {}),
      };
    }

    return where;
  }

  async listAdmin(query: OrderQueryDto) {
    const where = this.buildAdminWhere(query);
    const orderBy: Prisma.OrderOrderByWithRelationInput = { placedAt: query.order === "asc" ? "asc" : "desc" };
    const paidWhere: Prisma.OrderWhereInput = { AND: [where, { paymentStatus: { in: ["Paid", "PartiallyRefunded"] } }] };
    const pendingWhere: Prisma.OrderWhereInput = { AND: [where, { paymentStatus: "Pending" }] };

    const [total, orders, paidAggregate, pending, paid] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({ where, orderBy, include: orderListInclude, ...skipTake(query.page, query.pageSize) }),
      this.prisma.order.aggregate({ where: paidWhere, _sum: { total: true, refundedAmount: true } }),
      this.prisma.order.count({ where: pendingWhere }),
      this.prisma.order.count({ where: paidWhere }),
    ]);

    const revenue = Number(paidAggregate._sum.total ?? 0) - Number(paidAggregate._sum.refundedAmount ?? 0);

    return {
      ...paginated(orders.map((order) => this.toApiOrderSummary(order)), total, query.page, query.pageSize),
      summary: { count: total, revenue, pending, paid },
    };
  }

  async getAdminById(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException("Order not found");
    return this.toApiOrder(order);
  }

  // ------------------------------------------------------------ admin mutations

  async update(id: string, dto: UpdateOrderDto, context: AuditContext) {
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Order not found");

    const now = new Date();
    const data: Prisma.OrderUpdateInput = {};
    const events: { type: string; message: string }[] = [];

    const statusChanged = dto.status !== undefined && dto.status !== existing.status;
    const paymentChanged = dto.paymentStatus !== undefined && dto.paymentStatus !== existing.paymentStatus;

    if (statusChanged && dto.status && !canTransitionOrderStatus(existing.status, dto.status)) {
      throw new BadRequestException(`Cannot change order status from ${existing.status} to ${dto.status}`);
    }

    if (dto.status !== undefined) data.status = dto.status;
    if (dto.paymentStatus !== undefined) data.paymentStatus = dto.paymentStatus;
    if (dto.carrier !== undefined) data.carrier = dto.carrier;
    if (dto.trackingNumber !== undefined) data.trackingNumber = dto.trackingNumber;
    if (dto.trackingUrl !== undefined) data.trackingUrl = dto.trackingUrl;
    if (dto.internalNote !== undefined) data.internalNote = dto.internalNote;
    if (dto.customerNote !== undefined) data.customerNote = dto.customerNote;

    if (statusChanged && dto.status) {
      switch (dto.status) {
        case "Packed":
          if (!existing.packedAt) data.packedAt = now;
          break;
        case "Shipped":
          if (!existing.shippedAt) data.shippedAt = now;
          break;
        case "Completed":
          if (!existing.completedAt) data.completedAt = now;
          break;
        case "Cancelled":
          if (!existing.cancelledAt) data.cancelledAt = now;
          break;
        default:
          break;
      }
      events.push({ type: "status", message: `Status changed from ${existing.status} to ${dto.status}` });
    }

    if (paymentChanged && dto.paymentStatus) {
      if (dto.paymentStatus === "Paid" && !existing.paidAt) data.paidAt = now;
      events.push({ type: "payment", message: `Payment status changed from ${existing.paymentStatus} to ${dto.paymentStatus}` });
    }

    const effectiveStatus = dto.status ?? existing.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (events.length) {
        await tx.orderEvent.createMany({
          data: events.map((event) => ({ orderId: id, adminId: context.adminId ?? null, type: event.type, message: event.message })),
        });
      }

      if (statusChanged && (dto.status === "Cancelled" || dto.status === "Returned")) {
        await this.releaseOrderInventory(tx, id);
      }

      if (statusChanged && dto.status === "Cancelled") {
        await this.releaseDiscountUsage(tx, id);
      }

      if (paymentChanged && dto.paymentStatus === "Paid" && effectiveStatus !== "Cancelled" && effectiveStatus !== "Returned") {
        await this.markUniqueProductsSold(tx, id);
      }

      return tx.order.update({ where: { id }, data, include: orderInclude });
    });

    if (statusChanged && dto.status) {
      await this.prisma.notification.create({
        data: {
          type: "Order",
          title: `Order ${updated.orderNumber} is now ${dto.status}`,
          body: `Status changed from ${existing.status} to ${dto.status}.`,
          href: `/admin/orders/${updated.id}`,
          entityType: "Order",
          entityId: updated.id,
        },
      });
      await this.sendStatusEmail(updated, dto.status);
    }

    await this.audit.log({
      adminId: context.adminId,
      action: "order.update",
      entityType: "Order",
      entityId: updated.id,
      summary: `Updated order ${updated.orderNumber}`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiOrder(updated);
  }

  private async sendStatusEmail(order: OrderWithRelations, status: OrderStatus): Promise<void> {
    const notificationSettings = await this.settings.getNotificationSettings();
    if (!notificationSettings.orderConfirmation) return;

    const data = buildOrderEmailData(order);
    if (status === "Shipped") {
      await this.email.send({
        to: order.email,
        subject: `Order ${order.orderNumber} has shipped`,
        html: renderOrderShippedEmail({
          ...data,
          carrier: order.carrier,
          trackingNumber: order.trackingNumber,
          trackingUrl: order.trackingUrl,
        }),
      });
    } else if (status === "Completed") {
      await this.email.send({
        to: order.email,
        subject: `Order ${order.orderNumber} is complete`,
        html: renderOrderCompletedEmail(data),
      });
    } else if (status === "Cancelled") {
      await this.email.send({
        to: order.email,
        subject: `Order ${order.orderNumber} was cancelled`,
        html: renderOrderCancelledEmail({ ...data, reason: order.internalNote }),
      });
    }
  }

  async addEvent(id: string, dto: CreateOrderEventDto, context: AuditContext) {    const order = await this.prisma.order.findUnique({ where: { id }, select: { id: true, orderNumber: true } });
    if (!order) throw new NotFoundException("Order not found");

    const event = await this.prisma.orderEvent.create({
      data: {
        orderId: id,
        adminId: context.adminId ?? null,
        type: dto.type?.trim() || "note",
        message: dto.message,
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "order.event.create",
      entityType: "Order",
      entityId: id,
      summary: `Added event to order ${order.orderNumber}`,
      metadata: { type: event.type, message: event.message },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiEvent(event);
  }

  async invoice(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException("Order not found");

    const store = await this.settings.getPublicSettings();
    const text = (key: string, fallback: string): string => {
      const value = store[key];
      return typeof value === "string" && value.trim() ? value.trim() : fallback;
    };

    return {
      invoiceNumber: `INV-${order.orderNumber}`,
      orderNumber: order.orderNumber,
      issuedAt: new Date(),
      placedAt: order.placedAt,
      currency: order.currency,
      seller: {
        name: text("store.name", SELLER_FALLBACK.name),
        address: text("store.address", SELLER_FALLBACK.address),
        email: text("store.email", SELLER_FALLBACK.email),
        phone: text("store.whatsapp", SELLER_FALLBACK.phone),
      },
      buyer: {
        name: order.customerName,
        email: order.email,
        phone: order.phone,
        address: {
          line1: order.shippingLine1,
          line2: order.shippingLine2,
          city: order.shippingCity,
          state: order.shippingState,
          postalCode: order.shippingPostalCode,
          country: order.shippingCountry,
          countryCode: order.shippingCountryCode,
        },
      },
      items: order.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subtotal: order.subtotal,
      discountCode: order.discountCode,
      discountTotal: order.discountTotal,
      shippingName: order.shippingName,
      shippingCost: order.shippingCost,
      taxTotal: order.taxTotal,
      total: order.total,
      refundedAmount: order.refundedAmount,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paidAt: order.paidAt,
    };
  }

  async refund(id: string, dto: RefundOrderDto, context: AuditContext) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Order not found");

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) throw new BadRequestException("Refund amount must be greater than zero");

    const refundable = order.total.minus(order.refundedAmount);
    if (amount.greaterThan(refundable)) {
      throw new BadRequestException(`Refund exceeds the remaining refundable amount of ${refundable.toFixed(2)}`);
    }

    // The conditional increment makes concurrent refunds safe: only the request
    // that can still fit within the order total is allowed to add its amount.
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id, refundedAmount: { lte: order.total.minus(amount) } },
        data: { refundedAmount: { increment: amount } },
      });
      if (claimed.count === 0) {
        throw new BadRequestException("Refund exceeds the remaining refundable amount");
      }

      const fresh = await tx.order.findUniqueOrThrow({ where: { id } });
      const paymentStatus = fresh.refundedAmount.greaterThanOrEqualTo(fresh.total) ? "Refunded" : "PartiallyRefunded";

      await tx.orderEvent.create({
        data: {
          orderId: id,
          adminId: context.adminId ?? null,
          type: "refund",
          message: `Refunded ${order.currency} ${amount.toFixed(2)}${dto.reason ? ` — ${dto.reason}` : ""}`,
        },
      });

      return tx.order.update({
        where: { id },
        data: { paymentStatus },
        include: orderInclude,
      });
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "order.refund",
      entityType: "Order",
      entityId: id,
      summary: `Refunded ${order.currency} ${amount.toFixed(2)} on order ${order.orderNumber}`,
      metadata: { amount: amount.toNumber(), reason: dto.reason ?? null, paymentStatus: updated.paymentStatus },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiOrder(updated);
  }
}
