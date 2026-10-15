import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { EmailService } from "../email/email.service";
import { renderOrderPaidEmail } from "../email/email.templates";
import { buildOrderEmailData } from "../email/order-email-data";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { detectImageType, ALLOWED_IMAGE_MIME } from "../uploads/image-validation";
import { PayPalService, type PayPalCapture, type PayPalOrder } from "./paypal.service";

const SWEEP_INTERVAL_MS = 5 * 60_000;
const BANK_TRANSFER_RESERVATION_HOURS = 72;

export type PaymentProofFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly reservationMinutes: number;
  private readonly bankTransferReservationHours: number;
  private readonly sweepIntervalMs: number;
  private readonly paymentProofRoot: string;
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
    const bankHours = Number(this.config.get("BANK_TRANSFER_RESERVATION_HOURS") ?? BANK_TRANSFER_RESERVATION_HOURS);
    this.bankTransferReservationHours = Number.isFinite(bankHours) && bankHours > 0 ? Math.max(24, bankHours) : BANK_TRANSFER_RESERVATION_HOURS;
    this.paymentProofRoot = resolve(join(process.cwd(), this.config.get<string>("UPLOAD_DIR") ?? "uploads", ".payment-proofs"));
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
    const bankTransferConfigured =
      Boolean(settings.bankName && settings.bankAccountNumber && settings.bankSwiftCode) &&
      settings.currency.trim().toUpperCase() === "USD";
    return {
      paypal: { enabled: settings.paypalEnabled && this.paypal.isConfigured() },
      bankTransfer: {
        enabled: settings.bankTransferEnabled && bankTransferConfigured,
        bankName: settings.bankName,
        accountName: settings.bankAccountName,
        accountNumber: settings.bankAccountNumber,
        swiftCode: settings.bankSwiftCode,
        currency: settings.currency,
      },
    };
  }

  async resumeCheckout(input: { orderId?: string; checkoutKey?: string; email: string }) {
    if (!input.orderId && !input.checkoutKey) throw new BadRequestException("An order reference is required");
    const order = input.checkoutKey
      ? await this.prisma.order.findUnique({
          where: { checkoutKey: input.checkoutKey },
          select: {
            id: true,
            orderNumber: true,
            email: true,
            paymentStatus: true,
            paymentMethod: true,
            paymentProofUploadedAt: true,
            total: true,
            placedAt: true,
          },
        })
      : await this.prisma.order.findUnique({
          where: { id: input.orderId },
          select: {
            id: true,
            orderNumber: true,
            email: true,
            paymentStatus: true,
            paymentMethod: true,
            paymentProofUploadedAt: true,
            total: true,
            placedAt: true,
          },
        });

    if (!order || order.email.toLowerCase() !== input.email.trim().toLowerCase()) {
      throw new NotFoundException("Order not found");
    }

    const expired = order.paymentMethod === "BankTransfer"
      ? !order.paymentProofUploadedAt && Date.now() - order.placedAt.getTime() > this.bankTransferReservationHours * 60 * 60_000
      : Date.now() - order.placedAt.getTime() > this.reservationMinutes * 60_000;
    if (order.paymentStatus === "Pending" && expired) {
      await this.releaseExpiredOrders();
    }

    const current = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        paymentMethod: true,
        paymentProofUploadedAt: true,
        total: true,
      },
    });
    const paymentMethods = await this.methods();
    return {
      orderId: current.id,
      orderNumber: current.orderNumber,
      paymentStatus: current.paymentStatus,
      total: current.total.toNumber(),
      paymentMethod: current.paymentMethod,
      paymentProofUploadedAt: current.paymentProofUploadedAt,
      canRetry: current.paymentStatus === "Pending" && current.paymentMethod === "PayPal" && paymentMethods.paypal.enabled,
    };
  }

  async submitBankTransferProof(orderId: string, email: string, file: PaymentProofFile | undefined) {
    if (!file) throw new BadRequestException("Choose an image of your transfer receipt");
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) throw new BadRequestException("Upload a JPEG, PNG, WebP, GIF, or AVIF image");
    const detected = detectImageType(file.buffer);
    if (!detected || detected.mime !== file.mimetype) throw new BadRequestException("The uploaded file is not a valid image");

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        email: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        paymentProofPath: true,
        paymentProofUploadedAt: true,
        placedAt: true,
      },
    });
    if (!order || order.email.toLowerCase() !== email.trim().toLowerCase()) throw new NotFoundException("Order not found");
    if (order.paymentMethod !== "BankTransfer") throw new BadRequestException("This order is not using bank transfer");
    if (order.paymentStatus !== "Pending" || order.status === "Cancelled" || order.status === "Returned") {
      throw new BadRequestException("This order is no longer awaiting a bank transfer");
    }
    if (!order.paymentProofUploadedAt && Date.now() - order.placedAt.getTime() > this.bankTransferReservationHours * 60 * 60_000) {
      await this.releaseExpiredOrders();
      throw new BadRequestException("The payment window has expired. Please contact us before sending a transfer.");
    }

    const now = new Date();
    const monthFolder = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const folder = join(this.paymentProofRoot, monthFolder);
    await mkdir(folder, { recursive: true });
    const filename = `${randomBytes(18).toString("hex")}${detected.extension}`;
    const absolutePath = join(folder, filename);
    const relativePath = relative(this.paymentProofRoot, absolutePath).split("\\").join("/");
    await writeFile(absolutePath, file.buffer, { flag: "wx" });

    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: {
            id: order.id,
            paymentMethod: "BankTransfer",
            paymentStatus: "Pending",
            status: { notIn: ["Cancelled", "Returned"] },
          },
          data: {
            paymentProofPath: relativePath,
            paymentProofMime: detected.mime,
            paymentProofUploadedAt: now,
          },
        });
        if (updated.count !== 1) throw new BadRequestException("This order is no longer awaiting a bank transfer");

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "payment",
            message: order.paymentProofUploadedAt ? "Customer replaced the bank transfer receipt" : "Customer uploaded a bank transfer receipt — awaiting verification",
          },
        });
        if (!order.paymentProofUploadedAt) {
          await tx.notification.create({
            data: {
              type: "Order",
              title: `Transfer receipt received for ${order.orderNumber}`,
              body: "A customer uploaded a bank transfer receipt for verification.",
              href: `/admin/orders/${order.id}`,
              entityType: "Order",
              entityId: order.id,
            },
          });
        }
      });
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }

    if (order.paymentProofPath) {
      const previousPath = resolve(this.paymentProofRoot, order.paymentProofPath);
      if (previousPath.startsWith(this.paymentProofRoot + sep)) await unlink(previousPath).catch(() => undefined);
    }

    return { uploadedAt: now.toISOString() };
  }

  async getBankTransferProof(orderId: string): Promise<{ path: string; mimeType: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { paymentProofPath: true, paymentProofMime: true },
    });
    if (!order?.paymentProofPath || !order.paymentProofMime) throw new NotFoundException("No bank transfer receipt was uploaded");

    const path = resolve(this.paymentProofRoot, order.paymentProofPath);
    if (!path.startsWith(this.paymentProofRoot + sep)) throw new NotFoundException("Transfer receipt not found");
    return { path, mimeType: order.paymentProofMime };
  }

  private appOrigin(requestOrigin?: string): string {
    const isProduction = this.config.get<string>("NODE_ENV") === "production";
    const configured = (this.config.get<string>("APP_ORIGIN") ?? "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean);
    const allowed = isProduction
      ? configured
      : [...new Set([...configured, "http://localhost:3000", "http://localhost:3001", "http://localhost:3002"])];
    const candidate = requestOrigin?.trim().replace(/\/+$/, "");
    if (candidate && allowed.includes(candidate)) return candidate;
    return configured[0] ?? "http://localhost:3000";
  }

  // ------------------------------------------------------------ PayPal checkout

  async createPaypalOrder(orderId: string, requestOrigin?: string) {
    const paymentSettings = await this.settings.getPaymentSettings();
    if (!paymentSettings.paypalEnabled) throw new ServiceUnavailableException("PayPal payments are disabled");
    if (!this.paypal.isConfigured()) throw new ServiceUnavailableException("PayPal is not configured on the server");

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus !== "Pending") throw new BadRequestException("This order is not awaiting payment");
    if (order.paymentMethod !== "PayPal") throw new BadRequestException("This order was placed with a different payment method");
    if (!order.total.greaterThan(0)) throw new BadRequestException("This order has nothing to pay");

    const origin = this.appOrigin(requestOrigin);
    if (order.paymentRef) {
      const existingPaypalOrder = await this.paypal.getOrder(order.paymentRef);
      const existingUnit = existingPaypalOrder.purchase_units?.find(
        (unit) => unit.reference_id === order.orderNumber || unit.custom_id === order.orderNumber,
      );
      if (!existingUnit) throw new BadGatewayException("The existing PayPal session does not match this order");
      this.assertAmount(order.total.toFixed(2), order.currency, existingPaypalOrder, "PayPal order amount does not match this order");

      if (existingPaypalOrder.status === "CREATED" || existingPaypalOrder.status === "PAYER_ACTION_REQUIRED") {
        const approveUrl = this.paypal.approvalUrl(existingPaypalOrder);
        if (!approveUrl) throw new BadGatewayException("PayPal did not return an approval link for the existing session");
        return { orderNumber: order.orderNumber, paypalOrderId: existingPaypalOrder.id, approveUrl };
      }

      if (existingPaypalOrder.status === "APPROVED" || existingPaypalOrder.status === "COMPLETED") {
        throw new ConflictException("This PayPal session is already approved or complete. Refresh the order status before trying again.");
      }
    }

    const retryKey = order.paymentRef
      ? `rv-${createHash("sha256").update(`${order.orderNumber}:${order.paymentRef}`).digest("hex").slice(0, 32)}`
      : undefined;
    const created = await this.paypal.createOrder({
      amount: order.total.toFixed(2),
      currency: order.currency,
      referenceId: order.orderNumber,
      returnUrl: `${origin}/checkout?paypal=return&orderId=${encodeURIComponent(order.id)}`,
      cancelUrl: `${origin}/checkout?paypal=cancel&orderId=${encodeURIComponent(order.id)}`,
      ...(retryKey ? { idempotencyKey: retryKey } : {}),
    });

    if (!created.approveUrl) throw new BadGatewayException("PayPal did not return an approval link");

    const claimed = await this.prisma.order.updateMany({
      where: {
        id: order.id,
        paymentStatus: "Pending",
        paymentMethod: "PayPal",
        paymentRef: order.paymentRef,
      },
      data: { paymentMethod: "PayPal", paymentRef: created.id },
    });
    if (claimed.count === 0) {
      const current = await this.prisma.order.findUnique({ where: { id: order.id }, select: { paymentStatus: true, paymentRef: true } });
      if (current?.paymentStatus !== "Pending" || current.paymentRef !== created.id) {
        throw new ConflictException("The order changed while PayPal checkout was starting. Refresh and try again.");
      }
    } else {
      await this.prisma.orderEvent.create({
        data: { orderId: order.id, type: "payment", message: `PayPal order ${created.id} created — awaiting payer approval` },
      });
    }

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

    if (!resource.amount?.value || !resource.amount.currency_code) {
      this.logger.error(`PayPal webhook for ${order.orderNumber} did not include a capture amount`);
      return { received: true, handled: false };
    }

    const matchesValue = Number(resource.amount.value).toFixed(2) === order.total.toFixed(2);
    const matchesCurrency = resource.amount.currency_code.toUpperCase() === order.currency.toUpperCase();
    if (!matchesValue || !matchesCurrency) {
      this.logger.error(
        `PayPal webhook amount mismatch for ${order.orderNumber}: expected ${order.currency} ${order.total.toFixed(2)}, got ${resource.amount.currency_code} ${resource.amount.value}`,
      );
      return { received: true, handled: false };
    }

    await this.markOrderPaid(
      order.id,
      {
        id: resource.id,
        status: "COMPLETED",
        amount: { currency_code: resource.amount.currency_code, value: resource.amount.value },
      },
      "PayPal webhook",
    );

    return { received: true, handled: true };
  }

  // ------------------------------------------------------------ reservation expiry

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
      select: { id: true, orderNumber: true, paymentMethod: true, paymentProofUploadedAt: true },
    });
    if (expired.length > 0) {
      this.logger.log(`Expiry sweep found ${expired.length} unpaid order(s) past their payment windows`);
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
              {
                paymentMethod: "BankTransfer",
                paymentProofUploadedAt: null,
                placedAt: { lt: bankTransferCutoff },
              },
            ],
          },
          data: { status: "Cancelled", cancelledAt: new Date(), paymentStatus: "Failed" },
        });
        if (claimed.count === 0) return false;
        await this.orders.releaseOrderInventory(tx, order.id);
        await this.orders.releaseDiscountUsage(tx, order.id);
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "payment",
            message: order.paymentMethod === "BankTransfer"
              ? `Bank transfer window expired after ${this.bankTransferReservationHours} hours — reserved items released`
              : `Payment window expired after ${this.reservationMinutes} minutes — reserved items released`,
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
