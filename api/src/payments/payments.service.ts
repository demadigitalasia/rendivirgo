import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../email/email.service";
import { renderOrderPaidEmail } from "../email/email.templates";
import { buildOrderEmailData } from "../email/order-email-data";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { PayPalService, type PayPalCapture, type PayPalOrder } from "./paypal.service";

const SWEEP_INTERVAL_MS = 5 * 60_000;

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly reservationMinutes: number;
  private readonly sweepIntervalMs: number;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PayPalService,
    private readonly orders: OrdersService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {
    const configured = Number(this.config.get("ORDER_RESERVATION_MINUTES") ?? 60);
    this.reservationMinutes = Number.isFinite(configured) && configured > 0 ? Math.max(10, configured) : 60;
    const sweep = Number(this.config.get("PAYMENT_SWEEP_INTERVAL_MS") ?? SWEEP_INTERVAL_MS);
    this.sweepIntervalMs = Number.isFinite(sweep) && sweep >= 10_000 ? sweep : SWEEP_INTERVAL_MS;
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.releaseExpiredOrders().catch((error) =>
        this.logger.error(`Expiry sweep failed: ${error instanceof Error ? error.message : String(error)}`),
      );
    }, this.sweepIntervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ------------------------------------------------------------ config

  async methods() {
    const settings = await this.settings.getPaymentSettings();
    return { paypal: { enabled: settings.paypalEnabled && this.paypal.isConfigured() } };
  }

  private appOrigin(): string {
    const configured = (this.config.get<string>("APP_ORIGIN") ?? "http://localhost:3000").split(",")[0];
    return configured.trim().replace(/\/+$/, "");
  }

  // ------------------------------------------------------------ PayPal checkout

  async createPaypalOrder(orderId: string) {
    const paymentSettings = await this.settings.getPaymentSettings();
    if (!paymentSettings.paypalEnabled) throw new ServiceUnavailableException("PayPal payments are disabled");
    if (!this.paypal.isConfigured()) throw new ServiceUnavailableException("PayPal is not configured on the server");

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus !== "Pending") throw new BadRequestException("This order is not awaiting payment");
    if (!order.total.greaterThan(0)) throw new BadRequestException("This order has nothing to pay");

    const origin = this.appOrigin();
    const created = await this.paypal.createOrder({
      amount: order.total.toFixed(2),
      currency: order.currency,
      referenceId: order.orderNumber,
      returnUrl: `${origin}/checkout?paypal=return`,
      cancelUrl: `${origin}/checkout?paypal=cancel`,
    });

    if (!created.approveUrl) throw new BadGatewayException("PayPal did not return an approval link");

    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod: "PayPal", paymentRef: created.id },
    });
    await this.prisma.orderEvent.create({
      data: { orderId: order.id, type: "payment", message: `PayPal order ${created.id} created — awaiting payer approval` },
    });

    return { orderNumber: order.orderNumber, paypalOrderId: created.id, approveUrl: created.approveUrl };
  }

  async capturePaypalOrder(paypalOrderId: string) {
    const order = await this.prisma.order.findFirst({ where: { paymentRef: paypalOrderId } });
    if (!order) throw new NotFoundException("Order not found for this PayPal payment");

    return this.captureForOrder(order.id, paypalOrderId);
  }

  private async captureForOrder(orderId: string, paypalOrderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");

    if (order.paymentStatus === "Paid") {
      return {
        status: "Paid" as const,
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.total.toNumber(),
        currency: order.currency,
        paidAt: order.paidAt,
      };
    }
    if (order.paymentStatus !== "Pending") throw new BadRequestException("This order can no longer be paid");

    const paypalOrder = await this.paypal.getOrder(paypalOrderId);
    let capture = this.paypal.extractCapture(paypalOrder);

    if (!capture) {
      if (paypalOrder.status !== "APPROVED") {
        throw new BadRequestException("PayPal payment was not approved");
      }
      this.assertAmount(order.total.toFixed(2), order.currency, paypalOrder, "PayPal order amount does not match this order");
      const captured = await this.paypal.captureOrder(paypalOrderId);
      capture = this.paypal.extractCapture(captured);
      if (!capture) {
        if (captured.status === "PENDING") {
          await this.prisma.orderEvent.create({
            data: { orderId: order.id, type: "payment", message: "PayPal capture is pending review" },
          });
          return {
            status: "Pending" as const,
            orderId: order.id,
            orderNumber: order.orderNumber,
            total: order.total.toNumber(),
            currency: order.currency,
            paidAt: null,
          };
        }
        throw new BadRequestException("PayPal payment could not be captured");
      }
      this.assertAmount(
        order.total.toFixed(2),
        order.currency,
        { purchase_units: [{ amount: capture.amount }] },
        "PayPal capture amount does not match this order",
      );
    }

    const updated = await this.markOrderPaid(order.id, capture, "PayPal checkout");
    return {
      status: "Paid" as const,
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      total: updated.total.toNumber(),
      currency: updated.currency,
      paidAt: updated.paidAt,
    };
  }

  private assertAmount(
    expectedValue: string,
    expectedCurrency: string,
    order: Pick<PayPalOrder, "purchase_units">,
    message: string,
  ): void {
    const amount = order.purchase_units?.[0]?.amount;
    if (!amount) throw new BadRequestException(message);
    const matchesValue = Number(amount.value).toFixed(2) === Number(expectedValue).toFixed(2);
    const matchesCurrency = amount.currency_code.toUpperCase() === expectedCurrency.toUpperCase();
    if (!matchesValue || !matchesCurrency) {
      this.logger.error(`PayPal amount mismatch: expected ${expectedCurrency} ${expectedValue}, got ${amount.currency_code} ${amount.value}`);
      throw new BadRequestException(message);
    }
  }

  // ------------------------------------------------------------ payment state

  private async markOrderPaid(orderId: string, capture: PayPalCapture, source: string) {
    const claim = await this.prisma.$transaction(async (tx) => {
      const pending = await tx.order.updateMany({
        where: { id: orderId, paymentStatus: "Pending" },
        data: { paymentStatus: "Paid", paidAt: new Date(), paymentRef: capture.id },
      });
      if (pending.count > 0) {
        await this.orders.markUniqueProductsSold(tx, orderId);
        await tx.orderEvent.create({
          data: { orderId, type: "payment", message: `${source}: payment captured (PayPal ${capture.id})` },
        });
        return "claimed" as const;
      }

      const current = await tx.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true } });
      if (current?.paymentStatus === "Failed") {
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: "Paid", paidAt: new Date(), paymentRef: capture.id },
        });
        await tx.orderEvent.create({
          data: {
            orderId,
            type: "payment",
            message: `${source}: payment captured AFTER reservation expiry — stock was released, manual review required (PayPal ${capture.id})`,
          },
        });
        return "late" as const;
      }
      return "duplicate" as const;
    });

    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (claim === "duplicate") return order;

    if (claim === "late") {
      this.logger.error(
        `PayPal ${capture.id} captured after reservation expiry for ${order.orderNumber} — stock already released, admin review required`,
      );
      await this.prisma.notification.create({
        data: {
          type: "Order",
          title: `Payment captured after expiry — ${order.orderNumber}`,
          body: "Stock was released when the payment window expired — review this order before shipping.",
          href: `/admin/orders/${order.id}`,
          entityType: "Order",
          entityId: order.id,
        },
      });
      return order;
    }

    await this.prisma.notification.create({
      data: {
        type: "Order",
        title: `Payment received for ${order.orderNumber}`,
        body: `${order.customerName} paid ${order.currency} ${order.total.toFixed(2)} via PayPal`,
        href: `/admin/orders/${order.id}`,
        entityType: "Order",
        entityId: order.id,
      },
    });

    const notificationSettings = await this.settings.getNotificationSettings();
    if (notificationSettings.orderConfirmation) {
      await this.email.send({
        to: order.email,
        subject: `Payment received — order ${order.orderNumber} confirmed`,
        html: renderOrderPaidEmail(buildOrderEmailData(order)),
      });
    }

    return order;
  }

  // ------------------------------------------------------------ webhook

  async handleWebhook(event: { event_type?: string; resource?: Record<string, unknown> }): Promise<{ received: boolean; handled: boolean }> {
    const type = event.event_type ?? "";
    if (type !== "PAYMENT.CAPTURE.COMPLETED") {
      this.logger.log(`Ignoring PayPal webhook event "${type}"`);
      return { received: true, handled: false };
    }

    const resource = (event.resource ?? {}) as {
      id?: string;
      status?: string;
      custom_id?: string;
      amount?: { currency_code?: string; value?: string };
      supplementary_data?: { related_ids?: { order_id?: string } };
    };

    const paypalOrderId = resource.supplementary_data?.related_ids?.order_id;
    let order = paypalOrderId ? await this.prisma.order.findFirst({ where: { paymentRef: paypalOrderId } }) : null;
    if (!order && resource.custom_id) {
      order = await this.prisma.order.findUnique({ where: { orderNumber: resource.custom_id } });
    }
    if (!order) {
      this.logger.warn(`PayPal webhook ${type}: no matching order (order ${paypalOrderId ?? "unknown"})`);
      return { received: true, handled: false };
    }
    if (order.paymentStatus === "Paid") return { received: true, handled: true };

    if (!resource.id || resource.status !== "COMPLETED") {
      this.logger.warn(`PayPal webhook ${type}: capture not completed (${resource.status ?? "unknown"})`);
      return { received: true, handled: false };
    }

    if (resource.amount?.value && resource.amount.currency_code) {
      const matchesValue = Number(resource.amount.value).toFixed(2) === order.total.toFixed(2);
      const matchesCurrency = resource.amount.currency_code.toUpperCase() === order.currency.toUpperCase();
      if (!matchesValue || !matchesCurrency) {
        this.logger.error(
          `PayPal webhook amount mismatch for ${order.orderNumber}: expected ${order.currency} ${order.total.toFixed(2)}, got ${resource.amount.currency_code} ${resource.amount.value}`,
        );
        return { received: true, handled: false };
      }
    }

    await this.markOrderPaid(
      order.id,
      {
        id: resource.id,
        status: "COMPLETED",
        amount: { currency_code: resource.amount?.currency_code ?? order.currency, value: resource.amount?.value ?? "" },
      },
      "PayPal webhook",
    );

    return { received: true, handled: true };
  }

  // ------------------------------------------------------------ reservation expiry

  async releaseExpiredOrders(): Promise<number> {
    const cutoff = new Date(Date.now() - this.reservationMinutes * 60_000);
    const expired = await this.prisma.order.findMany({
      where: { paymentStatus: "Pending", status: { in: ["New", "Processing"] }, placedAt: { lt: cutoff } },
      select: { id: true },
    });
    if (expired.length > 0) {
      this.logger.log(`Expiry sweep found ${expired.length} unpaid order(s) older than ${this.reservationMinutes} minutes`);
    }

    let released = 0;
    for (const order of expired) {
      const done = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: order.id, paymentStatus: "Pending", status: { in: ["New", "Processing"] } },
          data: { status: "Cancelled", cancelledAt: new Date(), paymentStatus: "Failed" },
        });
        if (claimed.count === 0) return false;
        await this.orders.releaseOrderInventory(tx, order.id);
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "payment",
            message: `Payment window expired after ${this.reservationMinutes} minutes — reserved items released`,
          },
        });
        return true;
      });
      if (done) released += 1;
    }

    if (released > 0) this.logger.warn(`Released ${released} expired unpaid order(s)`);
    return released;
  }
}
