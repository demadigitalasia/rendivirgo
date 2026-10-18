import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type OrderStatus, type PaymentMethod } from "../../generated/prisma";
import { EmailService } from "../email/email.service";
import {
  renderOrderCancelledEmail,
  renderOrderCompletedEmail,
  renderOrderPaidEmail,
  renderNewOrderAdminEmail,
  renderOrderReceivedEmail,
  renderOrderShippedEmail,
} from "../email/email.templates";
import { buildOrderEmailData } from "../email/order-email-data";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import type { CreateOrderDto } from "./dto/order.dto";
import { orderInclude, type OrderWithRelations } from "./orders.types";

const BANK_TRANSFER_RESERVATION_HOURS = 72;

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
  return from === to || (ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false);
}

export type PreparedOrderItem = {
  productId: string;
  variantId: string | null;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  weightGram: number;
  imageUrl: string | null;
  stockModel: "Quantity" | "Unique";
};

export type PreparedOrder = {
  checkoutKey?: string;
  checkoutFingerprint?: string | null;
  email: string;
  customerName: string;
  phone?: string | null;
  shippingAddress: CreateOrderDto["shippingAddress"];
  customerNote?: string | null;
  paymentMethod: PaymentMethod;
  currency: string;
  subtotal: Prisma.Decimal;
  shippingCost: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  discountId?: string | null;
  discountCode?: string | null;
  shippingName: string;
  carrier: string | null;
  totalWeightGram: number;
  items: PreparedOrderItem[];
};

export type SettlementOutcome = "settled" | "late" | "duplicate" | "review";

export type SettlementResult = {
  order: OrderWithRelations;
  outcome: SettlementOutcome;
};

type SettlementInput = {
  orderId: string;
  paymentMethod: "PayPal" | "BankTransfer" | "Manual";
  paymentRef?: string;
  source: string;
  adminId?: string;
};

type TransitionResult = {
  order: OrderWithRelations;
  changed: boolean;
  previousStatus: OrderStatus;
  nextStatus: OrderStatus;
};

@Injectable()
export class OrderLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderLifecycleService.name);
  private readonly reservationMinutes: number;
  private readonly bankTransferReservationHours: number;
  private outboxTimer?: NodeJS.Timeout;
  private outboxDispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    config: ConfigService,
  ) {
    const configured = Number(config.get("ORDER_RESERVATION_MINUTES") ?? 60);
    this.reservationMinutes = Number.isFinite(configured) && configured > 0 ? Math.max(10, configured) : 60;
    const bankHours = Number(config.get("BANK_TRANSFER_RESERVATION_HOURS") ?? BANK_TRANSFER_RESERVATION_HOURS);
    this.bankTransferReservationHours =
      Number.isFinite(bankHours) && bankHours > 0 ? Math.max(24, bankHours) : BANK_TRANSFER_RESERVATION_HOURS;
  }

  onModuleInit() {
    void this.dispatchOutbox();
    this.outboxTimer = setInterval(() => void this.dispatchOutbox(), 15_000);
    this.outboxTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.outboxTimer) clearInterval(this.outboxTimer);
  }

  isPaymentWindowExpired(order: {
    paymentMethod: PaymentMethod;
    placedAt: Date;
    paymentProofUploadedAt: Date | null;
  }): boolean {
    if (order.paymentMethod === "BankTransfer") {
      return (
        !order.paymentProofUploadedAt &&
        Date.now() - order.placedAt.getTime() > this.bankTransferReservationHours * 60 * 60_000
      );
    }
    return Date.now() - order.placedAt.getTime() > this.reservationMinutes * 60_000;
  }

  async createReservedOrder(input: PreparedOrder): Promise<OrderWithRelations> {
    const order = await this.prisma.$transaction(async (tx) => {
      const quantityReservations = new Map<string, { productId: string; variantId: string | null; name: string; quantity: number }>();
      for (const item of input.items) {
        if (item.stockModel !== "Quantity") continue;
        const key = item.productId + ":" + (item.variantId ?? "");
        const existing = quantityReservations.get(key);
        if (existing) existing.quantity += item.quantity;
        else {
          quantityReservations.set(key, {
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            quantity: item.quantity,
          });
        }
      }

      for (const reservation of quantityReservations.values()) {
        if (reservation.variantId) {
          const result = await tx.productVariant.updateMany({
            where: {
              id: reservation.variantId,
              productId: reservation.productId,
              product: { is: { status: "Published", sellOnWeb: true } },
              stockQuantity: { gte: reservation.quantity },
            },
            data: { stockQuantity: { decrement: reservation.quantity } },
          });
          if (result.count === 0) {
            throw new BadRequestException('"' + reservation.name + '" does not have enough stock');
          }
        } else {
          const result = await tx.product.updateMany({
            where: {
              id: reservation.productId,
              stockModel: "Quantity",
              status: "Published",
              sellOnWeb: true,
              stockQuantity: { gte: reservation.quantity },
            },
            data: { stockQuantity: { decrement: reservation.quantity } },
          });
          if (result.count === 0) {
            throw new BadRequestException('"' + reservation.name + '" does not have enough stock');
          }
        }
      }

      const uniqueProductIds = [...new Set(input.items.filter((item) => item.stockModel === "Unique").map((item) => item.productId))];
      if (uniqueProductIds.length) {
        const reserved = await tx.product.updateMany({
          where: { id: { in: uniqueProductIds }, stockModel: "Unique", status: "Published", sellOnWeb: true, workshopStockQuantity: 0 },
          data: { status: "Reserved" },
        });
        if (reserved.count !== uniqueProductIds.length) {
          throw new BadRequestException("One or more items are no longer available");
        }
      }

      const email = input.email.trim().toLowerCase();
      const existingCustomer = await tx.customer.findUnique({ where: { email } });
      const customer = existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              name: input.customerName,
              ...(input.phone !== undefined ? { phone: input.phone } : {}),
              addressLine1: input.shippingAddress.line1,
              addressLine2: input.shippingAddress.line2 ?? existingCustomer.addressLine2,
              city: input.shippingAddress.city,
              state: input.shippingAddress.state ?? existingCustomer.state,
              postalCode: input.shippingAddress.postalCode ?? existingCustomer.postalCode,
              country: input.shippingAddress.country,
              countryCode: input.shippingAddress.countryCode ?? existingCustomer.countryCode,
            },
          })
        : await tx.customer.create({
            data: {
              email,
              name: input.customerName,
              phone: input.phone ?? null,
              addressLine1: input.shippingAddress.line1,
              addressLine2: input.shippingAddress.line2 ?? null,
              city: input.shippingAddress.city,
              state: input.shippingAddress.state ?? null,
              postalCode: input.shippingAddress.postalCode ?? null,
              country: input.shippingAddress.country,
              countryCode: input.shippingAddress.countryCode ?? null,
            },
          });

      const now = new Date();
      const dateKey =
        String(now.getFullYear()) +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0");
      const sequence = await tx.sequence.upsert({
        where: { key: "order:" + dateKey },
        create: { key: "order:" + dateKey, value: 1 },
        update: { value: { increment: 1 } },
      });
      const orderNumber = "RV-" + dateKey + "-" + String(sequence.value).padStart(4, "0");

      const created = await tx.order.create({
        data: {
          orderNumber,
          ...(input.checkoutKey && input.checkoutFingerprint
            ? { checkoutKey: input.checkoutKey, checkoutFingerprint: input.checkoutFingerprint }
            : {}),
          customerId: customer.id,
          email,
          customerName: input.customerName,
          phone: input.phone ?? null,
          status: "New",
          paymentStatus: "Pending",
          paymentMethod: input.paymentMethod,
          currency: input.currency,
          subtotal: input.subtotal,
          shippingCost: input.shippingCost,
          discountTotal: input.discountTotal,
          total: input.total,
          discountId: input.discountId ?? null,
          discountCode: input.discountCode ?? null,
          shippingName: input.shippingName,
          carrier: input.carrier,
          totalWeightGram: input.totalWeightGram,
          shippingLine1: input.shippingAddress.line1,
          shippingLine2: input.shippingAddress.line2 ?? null,
          shippingCity: input.shippingAddress.city,
          shippingState: input.shippingAddress.state ?? null,
          shippingPostalCode: input.shippingAddress.postalCode ?? null,
          shippingCountry: input.shippingAddress.country,
          shippingCountryCode: input.shippingAddress.countryCode ?? null,
          customerNote: input.customerNote ?? null,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              name: item.name,
              sku: item.sku,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              weightGram: item.weightGram,
              lineTotal: item.lineTotal,
              imageUrl: item.imageUrl,
            })),
          },
          events: {
            create: {
              type: "created",
              message: "Order " + orderNumber + " was placed by " + input.customerName,
            },
          },
        },
        include: orderInclude,
      });

      await tx.notification.create({
        data: {
          type: "Order",
          title: `New order ${created.orderNumber}`,
          body: `${created.customerName} placed an order for ${created.currency} ${created.total.toFixed(2)}`,
          href: `/admin/orders/${created.id}`,
          entityType: "Order",
          entityId: created.id,
        },
      });
      await tx.orderOutbox.createMany({
        data: [
          {
            orderId: created.id,
            kind: "OrderReceivedCustomer",
            dedupeKey: `order:${created.id}:received:customer`,
          },
          {
            orderId: created.id,
            kind: "OrderReceivedAdmin",
            dedupeKey: `order:${created.id}:received:admin`,
          },
        ],
      });

      if (input.discountId) {
        const claimed = await tx.$executeRawUnsafe(
          'UPDATE "Discount" SET "usedCount" = "usedCount" + 1 WHERE "id" = $1 AND "isActive" = TRUE AND ("startsAt" IS NULL OR "startsAt" <= $2) AND ("endsAt" IS NULL OR "endsAt" >= $2) AND ("maxUses" IS NULL OR "usedCount" < "maxUses")',
          input.discountId,
          now,
        );
        if (claimed === 0) {
          throw new BadRequestException("Discount code is no longer available");
        }
      }

      return created;
    });
    await this.dispatchOutbox();
    return order;
  }

  async advanceFulfillment(orderId: string, status: OrderStatus, adminId?: string): Promise<OrderWithRelations> {
    if (status === "Cancelled" || status === "Returned" || status === "New") {
      throw new BadRequestException("Use the matching order lifecycle operation for this status");
    }
    return this.transitionStatus(orderId, status, adminId);
  }

  async cancelOrder(orderId: string, adminId?: string): Promise<OrderWithRelations> {
    return this.transitionStatus(orderId, "Cancelled", adminId);
  }

  async returnOrder(orderId: string, adminId?: string): Promise<OrderWithRelations> {
    return this.transitionStatus(orderId, "Returned", adminId);
  }

  private async transitionStatus(orderId: string, nextStatus: OrderStatus, adminId?: string): Promise<OrderWithRelations> {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw new NotFoundException("Order not found");
    if (existing.status === nextStatus) {
      return this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
    }
    if (!canTransitionOrderStatus(existing.status, nextStatus)) {
      throw new BadRequestException("Cannot change order status from " + existing.status + " to " + nextStatus);
    }

    const result = await this.prisma.$transaction(async (tx): Promise<TransitionResult> => {
      const now = new Date();
      const data: Prisma.OrderUpdateManyMutationInput = { status: nextStatus };
      if (nextStatus === "Packed" && !existing.packedAt) data.packedAt = now;
      if (nextStatus === "Shipped" && !existing.shippedAt) data.shippedAt = now;
      if (nextStatus === "Completed" && !existing.completedAt) data.completedAt = now;
      if (nextStatus === "Cancelled" && !existing.cancelledAt) data.cancelledAt = now;

      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: existing.status },
        data,
      });
      if (claimed.count === 0) {
        const current = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
        if (current.status === nextStatus) {
          return { order: current, changed: false, previousStatus: existing.status, nextStatus };
        }
        throw new ConflictException("The order changed while its status was being updated");
      }

      if (nextStatus === "Cancelled" || nextStatus === "Returned") {
        await this.releaseOrderInventory(tx, orderId);
      }
      if (nextStatus === "Cancelled") await this.releaseDiscountUsage(tx, orderId);

      await tx.orderEvent.create({
        data: {
          orderId,
          adminId: adminId ?? null,
          type: "status",
          message: "Status changed from " + existing.status + " to " + nextStatus,
        },
      });
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
      return { order, changed: true, previousStatus: existing.status, nextStatus };
    });

    if (result.changed) await this.notifyStatusChange(result.order, result.previousStatus, result.nextStatus);
    return result.order;
  }

  async settlePayment(input: SettlementInput): Promise<SettlementResult> {
    const initial = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, paymentMethod: true, paymentStatus: true, placedAt: true, paymentProofUploadedAt: true },
    });
    if (!initial) throw new NotFoundException("Order not found");

    if (input.paymentMethod === "PayPal" && initial.paymentMethod !== "PayPal") {
      throw new BadRequestException("This order is not using PayPal");
    }
    if (input.paymentMethod !== "PayPal" && initial.paymentMethod !== "BankTransfer" && initial.paymentMethod !== "Manual") {
      throw new BadRequestException("This order cannot be confirmed as a manual payment");
    }
    if (initial.paymentStatus === "Pending" && this.isPaymentWindowExpired(initial)) {
      await this.releaseExpiredOrders();
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize settlement attempts for one order so duplicate webhooks cannot
      // race through the review-event deduplication check.
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
      let order = await tx.order.findUnique({ where: { id: input.orderId } });
      if (!order) throw new NotFoundException("Order not found");

      const isPaidState =
        order.paymentStatus === "Paid" ||
        order.paymentStatus === "PartiallyRefunded" ||
        order.paymentStatus === "Refunded";
      if (isPaidState) {
        const samePayment =
          input.paymentRef
            ? order.paymentRef === input.paymentRef
            : input.paymentMethod !== "PayPal" && order.paymentRef === null;
        if (samePayment) {
          return {
            order: await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude }),
            outcome: "duplicate" as const,
            reviewEventCreated: false,
          };
        }
        const message =
          "Different payment reference received after settlement; manual review required (" +
          (input.paymentRef ?? "no reference") +
          ")";
        const created = await this.createReviewEvent(tx, order.id, input.adminId, message);
        if (created) await this.createManualReviewNotification(tx, order.id, order.orderNumber);
        return {
          order: await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude }),
          outcome: "review" as const,
          reviewEventCreated: created,
        };
      }

      if (order.status === "Cancelled" && order.paymentStatus === "Failed") {
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: "Cancelled", paymentStatus: "Failed" },
          data: {
            paymentStatus: "Paid",
            paidAt: new Date(),
            ...(input.paymentRef ? { paymentRef: input.paymentRef } : {}),
          },
        });
        if (updated.count === 1) {
          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              adminId: input.adminId ?? null,
              type: "payment",
              message:
                input.source +
                ": payment received after reservation expiry — stock was released, manual review required" +
                (input.paymentRef ? " (" + input.paymentRef + ")" : ""),
            },
          });
          await this.createManualReviewNotification(tx, order.id, order.orderNumber);
          return {
            order: await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude }),
            outcome: "late" as const,
            reviewEventCreated: true,
          };
        }
        order = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      }

      if (order.status === "Cancelled" || order.status === "Returned" || order.paymentStatus !== "Pending") {
        const message =
          "Payment received for a terminal or non-pending order; automatic settlement skipped, manual review required" +
          (input.paymentRef ? " (" + input.paymentRef + ")" : "");
        const created = await this.createReviewEvent(tx, order.id, input.adminId, message);
        if (created) await this.createManualReviewNotification(tx, order.id, order.orderNumber);
        return {
          order: await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude }),
          outcome: "review" as const,
          reviewEventCreated: created,
        };
      }

      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          status: order.status,
          paymentStatus: "Pending",
          paymentMethod: order.paymentMethod,
        },
        data: {
          paymentStatus: "Paid",
          paidAt: new Date(),
          ...(input.paymentRef ? { paymentRef: input.paymentRef } : {}),
        },
      });
      if (updated.count === 0) {
        order = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
        const nowPaid = order.paymentStatus === "Paid" || order.paymentStatus === "PartiallyRefunded" || order.paymentStatus === "Refunded";
        const samePayment =
          input.paymentRef
            ? order.paymentRef === input.paymentRef
            : input.paymentMethod !== "PayPal" && order.paymentRef === null;
        if (nowPaid && samePayment) {
          return {
            order: await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude }),
            outcome: "duplicate" as const,
            reviewEventCreated: false,
          };
        }
        const message =
          "Payment state changed during settlement; manual review required" +
          (input.paymentRef ? " (" + input.paymentRef + ")" : "");
        const created = await this.createReviewEvent(tx, order.id, input.adminId, message);
        if (created) await this.createManualReviewNotification(tx, order.id, order.orderNumber);
        return {
          order: await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude }),
          outcome: "review" as const,
          reviewEventCreated: created,
        };
      }

      await this.markUniqueProductsSold(tx, order.id);
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          adminId: input.adminId ?? null,
          type: "payment",
          message:
            input.source +
            ": payment settled" +
            (input.paymentRef ? " (" + input.paymentRef + ")" : ""),
        },
      });
      await tx.notification.create({
        data: {
          type: "Order",
          title: "Payment received for " + order.orderNumber,
          body: order.customerName + " paid " + order.currency + " " + order.total.toFixed(2) + " via " + order.paymentMethod + ".",
          href: "/admin/orders/" + order.id,
          entityType: "Order",
          entityId: order.id,
        },
      });
      await tx.orderOutbox.create({
        data: {
          orderId: order.id,
          kind: "PaymentReceivedCustomer",
          dedupeKey: `order:${order.id}:payment-received:customer`,
        },
      });
      return {
        order: await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude }),
        outcome: "settled" as const,
        reviewEventCreated: false,
      };
    });

    if (result.outcome === "settled") await this.dispatchOutbox();
    if ((result.outcome === "late" || result.outcome === "review") && result.reviewEventCreated) {
      await this.notifyManualReview(result.order);
    }
    return { order: result.order, outcome: result.outcome };
  }

  async confirmManualPayment(orderId: string, adminId?: string): Promise<SettlementResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, paymentMethod: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentMethod === "PayPal") {
      throw new BadRequestException("PayPal payments must be confirmed by PayPal");
    }
    if (order.paymentMethod !== "BankTransfer" && order.paymentMethod !== "Manual") {
      throw new BadRequestException("This payment method is not eligible for manual settlement");
    }
    return this.settlePayment({
      orderId,
      paymentMethod: order.paymentMethod,
      source: order.paymentMethod === "BankTransfer" ? "Bank transfer confirmed by admin" : "Manual payment confirmed by admin",
      adminId,
    });
  }

  private async createReviewEvent(
    tx: Prisma.TransactionClient,
    orderId: string,
    adminId: string | undefined,
    message: string,
  ): Promise<boolean> {
    const existing = await tx.orderEvent.findFirst({
      where: { orderId, type: "payment", message },
      select: { id: true },
    });
    if (existing) return false;
    await tx.orderEvent.create({ data: { orderId, adminId: adminId ?? null, type: "payment", message } });
    return true;
  }

  async attachPaypalOrderSession(orderId: string, expectedPaypalOrderId: string | null, paypalOrderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: {
          id: orderId,
          paymentStatus: "Pending",
          paymentMethod: "PayPal",
          status: { notIn: ["Cancelled", "Returned"] },
          paypalOrderId: expectedPaypalOrderId,
        },
        data: { paypalOrderId },
      });
      if (claimed.count === 1) {
        await tx.orderEvent.create({
          data: { orderId, type: "payment", message: "PayPal order " + paypalOrderId + " created — awaiting payer approval" },
        });
        return;
      }

      const current = await tx.order.findUnique({ where: { id: orderId } });
      if (
        current?.paymentStatus === "Pending" &&
        current.paymentMethod === "PayPal" &&
        current.paypalOrderId === paypalOrderId &&
        current.status !== "Cancelled" &&
        current.status !== "Returned"
      ) {
        return;
      }
      throw new ConflictException("The order changed while PayPal checkout was starting. Refresh and try again.");
    });
  }

  async recordPaymentEvent(orderId: string, message: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!exists) throw new NotFoundException("Order not found");
      await tx.orderEvent.create({ data: { orderId, type: "payment", message } });
    });
  }

  async recordBankTransferProof(input: {
    orderId: string;
    path: string;
    mimeType: string;
    uploadedAt: Date;
    expectedPreviousPath: string | null;
  }): Promise<{ previousPath: string | null; firstUpload: boolean }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: input.orderId } });
      if (!current) throw new NotFoundException("Order not found");
      if (
        current.paymentMethod !== "BankTransfer" ||
        current.paymentStatus !== "Pending" ||
        current.status === "Cancelled" ||
        current.status === "Returned"
      ) {
        throw new BadRequestException("This order is no longer awaiting a bank transfer");
      }
      if (!current.paymentProofUploadedAt && this.isPaymentWindowExpired(current)) {
        throw new BadRequestException("The payment window has expired. Please contact us before sending a transfer.");
      }
      if (current.paymentProofPath !== input.expectedPreviousPath) {
        throw new ConflictException("The bank transfer receipt changed while a new one was being uploaded");
      }

      await tx.order.update({
        where: { id: input.orderId },
        data: {
          paymentProofPath: input.path,
          paymentProofMime: input.mimeType,
          paymentProofUploadedAt: input.uploadedAt,
        },
      });
      const firstUpload = current.paymentProofUploadedAt === null;
      await tx.orderEvent.create({
        data: {
          orderId: input.orderId,
          type: "payment",
          message: firstUpload
            ? "Customer uploaded a bank transfer receipt — awaiting verification"
            : "Customer replaced the bank transfer receipt",
        },
      });
      return { previousPath: current.paymentProofPath, firstUpload, orderNumber: current.orderNumber };
    });

    if (result.firstUpload) {
      await this.prisma.notification.create({
        data: {
          type: "Order",
          title: "Transfer receipt received for " + result.orderNumber,
          body: "A customer uploaded a bank transfer receipt for verification.",
          href: "/admin/orders/" + input.orderId,
          entityType: "Order",
          entityId: input.orderId,
        },
      });
    }
    return { previousPath: result.previousPath, firstUpload: result.firstUpload };
  }

  async recordRefund(input: {
    orderId: string;
    amount: number;
    reason?: string;
    externalReference?: string;
    adminId?: string;
  }): Promise<OrderWithRelations> {
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lessThanOrEqualTo(0)) throw new BadRequestException("Refund amount must be greater than zero");

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: input.orderId } });
      if (!order) throw new NotFoundException("Order not found");
      const refundable = order.total.minus(order.refundedAmount);
      if (amount.greaterThan(refundable)) {
        throw new BadRequestException("Refund exceeds the remaining refundable amount of " + refundable.toFixed(2));
      }

      const claimed = await tx.order.updateMany({
        where: { id: input.orderId, refundedAmount: { lte: order.total.minus(amount) } },
        data: { refundedAmount: { increment: amount } },
      });
      if (claimed.count === 0) throw new BadRequestException("Refund exceeds the remaining refundable amount");

      const fresh = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
      const paymentStatus = fresh.refundedAmount.greaterThanOrEqualTo(fresh.total) ? "Refunded" : "PartiallyRefunded";
      await tx.orderEvent.create({
        data: {
          orderId: input.orderId,
          adminId: input.adminId ?? null,
          type: "refund",
          message:
            "Refunded " +
            order.currency +
            " " +
            amount.toFixed(2) +
            (input.reason ? " — " + input.reason : "") +
            (input.externalReference ? " — external transfer ref: " + input.externalReference.trim() : ""),
        },
      });
      return tx.order.update({
        where: { id: input.orderId },
        data: { paymentStatus },
        include: orderInclude,
      });
    });
  }

  async releaseExpiredOrders(): Promise<number> {
    const now = Date.now();
    const paypalCutoff = new Date(now - this.reservationMinutes * 60_000);
    const bankTransferCutoff = new Date(now - this.bankTransferReservationHours * 60 * 60_000);
    const expired = await this.prisma.order.findMany({
      where: {
        paymentStatus: "Pending",
        status: { in: ["New", "Processing"] },
        OR: [
          { paymentMethod: { not: "BankTransfer" }, placedAt: { lt: paypalCutoff } },
          { paymentMethod: "BankTransfer", paymentProofUploadedAt: null, placedAt: { lt: bankTransferCutoff } },
        ],
      },
      select: { id: true, orderNumber: true, paymentMethod: true },
    });
    if (expired.length > 0) {
      this.logger.log("Expiry sweep found " + expired.length + " unpaid order(s) past their payment windows");
    }

    let released = 0;
    for (const order of expired) {
      const done = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: {
            id: order.id,
            paymentStatus: "Pending",
            status: { in: ["New", "Processing"] },
            OR: [
              { paymentMethod: { not: "BankTransfer" }, placedAt: { lt: paypalCutoff } },
              { paymentMethod: "BankTransfer", paymentProofUploadedAt: null, placedAt: { lt: bankTransferCutoff } },
            ],
          },
          data: { status: "Cancelled", cancelledAt: new Date(), paymentStatus: "Failed" },
        });
        if (claimed.count === 0) return false;
        await this.releaseOrderInventory(tx, order.id);
        await this.releaseDiscountUsage(tx, order.id);
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "payment",
            message:
              order.paymentMethod === "BankTransfer"
                ? "Bank transfer window expired after " + this.bankTransferReservationHours + " hours — reserved items released"
                : "Payment window expired after " + this.reservationMinutes + " minutes — reserved items released",
          },
        });
        return true;
      });
      if (done) released += 1;
    }

    if (released > 0) this.logger.warn("Released " + released + " expired unpaid order(s)");
    return released;
  }

  private async releaseOrderInventory(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      include: { product: { select: { id: true, stockModel: true, stockQuantity: true } } },
    });

    for (const item of items) {
      if (!item.productId || !item.product) continue;
      if (item.variantId) {
        const sharedQuantity = item.quantity - item.workshopAllocatedQuantity;
        await tx.productVariant.updateMany({
          where: { id: item.variantId },
          data: {
            ...(sharedQuantity > 0 ? { stockQuantity: { increment: sharedQuantity } } : {}),
            ...(item.workshopAllocatedQuantity > 0 ? { workshopStockQuantity: { increment: item.workshopAllocatedQuantity } } : {}),
          },
        });
      } else if (item.product.stockModel === "Quantity") {
        if (item.product.stockQuantity !== null) {
          const sharedQuantity = item.quantity - item.workshopAllocatedQuantity;
          await tx.product.updateMany({
            where: { id: item.productId },
            data: {
              ...(sharedQuantity > 0 ? { stockQuantity: { increment: sharedQuantity } } : {}),
              ...(item.workshopAllocatedQuantity > 0 ? { workshopStockQuantity: { increment: item.workshopAllocatedQuantity } } : {}),
            },
          });
        }
      } else {
        await tx.product.updateMany({
          where: { id: item.productId, status: { in: ["Reserved", "Sold"] } },
          data: {
            status: "Published",
            ...(item.workshopAllocatedQuantity > 0 ? { workshopStockQuantity: { increment: item.workshopAllocatedQuantity } } : {}),
          },
        });
      }
    }
  }

  private async markUniqueProductsSold(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const items = await tx.orderItem.findMany({ where: { orderId }, select: { productId: true } });
    const productIds = [...new Set(items.map((item) => item.productId).filter((value): value is string => Boolean(value)))];
    if (!productIds.length) return;
    await tx.product.updateMany({
      where: { id: { in: productIds }, stockModel: "Unique" },
      data: { status: "Sold" },
    });
  }

  private async releaseDiscountUsage(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { discountId: true } });
    if (!order?.discountId) return;
    await tx.$executeRawUnsafe(
      'UPDATE "Discount" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "id" = $1',
      order.discountId,
    );
  }

  private async notifyStatusChange(order: OrderWithRelations, previousStatus: OrderStatus, status: OrderStatus): Promise<void> {
    await this.prisma.notification.create({
      data: {
        type: "Order",
        title: "Order " + order.orderNumber + " is now " + status,
        body: "Status changed from " + previousStatus + " to " + status + ".",
        href: "/admin/orders/" + order.id,
        entityType: "Order",
        entityId: order.id,
      },
    });

    if (!order.email) return;

    const settings = await this.settings.getNotificationSettings();
    if (!settings.orderConfirmation) return;
    const data = buildOrderEmailData(order);
    if (status === "Shipped") {
      await this.email.send({
        to: order.email ?? "",
        subject: "Order " + order.orderNumber + " has shipped",
        html: renderOrderShippedEmail({
          ...data,
          carrier: order.carrier,
          trackingNumber: order.trackingNumber,
          trackingUrl: order.trackingUrl,
        }),
      });
    } else if (status === "Completed") {
      await this.email.send({
        to: order.email ?? "",
        subject: "Order " + order.orderNumber + " is complete",
        html: renderOrderCompletedEmail(data),
      });
    } else if (status === "Cancelled") {
      await this.email.send({
        to: order.email ?? "",
        subject: "Order " + order.orderNumber + " was cancelled",
        html: renderOrderCancelledEmail({ ...data, reason: order.internalNote }),
      });
    }
  }

  private async dispatchOutbox(): Promise<void> {
    if (this.outboxDispatching) return;
    this.outboxDispatching = true;
    try {
      const now = new Date();
      const staleLock = new Date(now.getTime() - 5 * 60_000);
      const jobs = await this.prisma.orderOutbox.findMany({
        where: {
          OR: [
            { status: "Pending", availableAt: { lte: now } },
            { status: "Processing", lockedAt: { lte: staleLock } },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true, status: true, lockedAt: true, attempts: true },
      });

      for (const job of jobs) {
        const claim = await this.prisma.orderOutbox.updateMany({
          where: job.status === "Pending"
            ? { id: job.id, status: "Pending", availableAt: { lte: now } }
            : { id: job.id, status: "Processing", lockedAt: job.lockedAt },
          data: { status: "Processing", lockedAt: now, attempts: { increment: 1 } },
        });
        if (claim.count !== 1) continue;

        try {
          await this.deliverOutboxJob(job.id);
          await this.prisma.orderOutbox.updateMany({
            where: { id: job.id, status: "Processing", lockedAt: now },
            data: { status: "Sent", sentAt: new Date(), lockedAt: null, lastError: null },
          });
        } catch (error) {
          const delayMinutes = Math.min(60, 2 ** Math.min(job.attempts, 6));
          await this.prisma.orderOutbox.updateMany({
            where: { id: job.id, status: "Processing", lockedAt: now },
            data: {
              status: "Pending",
              availableAt: new Date(Date.now() + delayMinutes * 60_000),
              lockedAt: null,
              lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
            },
          });
          this.logger.error(`Order outbox job ${job.id} failed; retrying in ${delayMinutes} minute(s)`);
        }
      }
    } catch (error) {
      this.logger.error(`Order outbox dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.outboxDispatching = false;
    }
  }

  private async deliverOutboxJob(jobId: string): Promise<void> {
    const job = await this.prisma.orderOutbox.findUnique({ where: { id: jobId }, include: { order: { include: orderInclude } } });
    if (!job) return;
    const order = job.order;
    if (job.kind !== "OrderReceivedAdmin" && !order.email) return;
    const data = buildOrderEmailData(order);

    if (job.kind === "OrderReceivedCustomer") {
      const settings = await this.settings.getNotificationSettings();
      if (!settings.orderConfirmation) return;
      const paymentSettings = await this.settings.getPaymentSettings();
      await this.email.send({
        to: order.email ?? "",
        subject: `Order ${order.orderNumber} received — payment pending`,
        html: renderOrderReceivedEmail({
          ...data,
          paypalEnabled: paymentSettings.paypalEnabled,
          paymentMethod: order.paymentMethod,
          bankTransfer: {
            bankName: paymentSettings.bankName,
            accountName: paymentSettings.bankAccountName,
            accountNumber: paymentSettings.bankAccountNumber,
            swiftCode: paymentSettings.bankSwiftCode,
          },
        }),
      });
      return;
    }

    if (job.kind === "OrderReceivedAdmin") {
      const storeEmail = await this.settings.getStoreEmail();
      await this.email.send({
        to: storeEmail,
        subject: `New order ${order.orderNumber} — ${order.currency} ${order.total.toFixed(2)}`,
        html: renderNewOrderAdminEmail({ ...data, email: order.email ?? "" }),
      });
      return;
    }

    const settings = await this.settings.getNotificationSettings();
    if (!settings.orderConfirmation) return;
    await this.email.send({
      to: order.email ?? "",
      subject: "Payment received — order " + order.orderNumber + " confirmed",
      html: renderOrderPaidEmail(data),
    });
  }

  private async notifyManualReview(order: OrderWithRelations): Promise<void> {
    this.logger.error("Payment for " + order.orderNumber + " requires manual review");
  }

  private async createManualReviewNotification(tx: Prisma.TransactionClient, orderId: string, orderNumber: string): Promise<void> {
    await tx.notification.create({
      data: {
        type: "Order",
        title: "Payment requires manual review — " + orderNumber,
        body: "The payment needs review before this order can be fulfilled.",
        href: "/admin/orders/" + orderId,
        entityType: "Order",
        entityId: orderId,
      },
    });
  }
}
