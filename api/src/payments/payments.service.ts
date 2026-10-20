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
import type { Order } from "../../generated/prisma";
import { OrderLifecycleService } from "../orders/order-lifecycle.service";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { detectImageType, ALLOWED_IMAGE_MIME } from "../uploads/image-validation";
import { PayPalService, type PayPalOrder, type PayPalShippingAddress } from "./paypal.service";

const SWEEP_INTERVAL_MS = 5 * 60_000;
type OrderWithShippingAddress = Pick<
  Order,
  | "orderNumber"
  | "customerName"
  | "shippingLine1"
  | "shippingLine2"
  | "shippingCity"
  | "shippingState"
  | "shippingPostalCode"
  | "shippingCountryCode"
>;

export type PaymentProofFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly sweepIntervalMs: number;
  private readonly paymentProofRoot: string;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PayPalService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {
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
            status: true,
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
            status: true,
            paymentMethod: true,
            paymentProofUploadedAt: true,
            total: true,
            placedAt: true,
          },
        });

    if (!order || !order.email || order.email.toLowerCase() !== input.email.trim().toLowerCase()) {
      throw new NotFoundException("Order not found");
    }

    if (order.paymentStatus === "Pending" && this.lifecycle.isPaymentWindowExpired(order)) {
      await this.lifecycle.releaseExpiredOrders();
    }

    const current = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        status: true,
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
      orderStatus: current.status,
      total: current.total.toNumber(),
      paymentMethod: current.paymentMethod,
      paymentProofUploadedAt: current.paymentProofUploadedAt,
      canRetry:
        current.paymentStatus === "Pending" &&
        current.status !== "Cancelled" &&
        current.status !== "Returned" &&
        current.paymentMethod === "PayPal" &&
        paymentMethods.paypal.enabled,
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
    if (!order || !order.email || order.email.toLowerCase() !== email.trim().toLowerCase()) throw new NotFoundException("Order not found");
    if (order.paymentMethod !== "BankTransfer") throw new BadRequestException("This order is not using bank transfer");
    if (order.paymentStatus !== "Pending" || order.status === "Cancelled" || order.status === "Returned") {
      throw new BadRequestException("This order is no longer awaiting a bank transfer");
    }
    if (!order.paymentProofUploadedAt && this.lifecycle.isPaymentWindowExpired(order)) {
      await this.lifecycle.releaseExpiredOrders();
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

    let proofResult: { previousPath: string | null; firstUpload: boolean };
    try {
      proofResult = await this.lifecycle.recordBankTransferProof({
        orderId: order.id,
        path: relativePath,
        mimeType: detected.mime,
        uploadedAt: now,
        expectedPreviousPath: order.paymentProofPath,
      });
    } catch (error) {
      const current = await this.prisma.order.findUnique({
        where: { id: order.id },
        select: { paymentProofPath: true },
      });
      if (current?.paymentProofPath !== relativePath) {
        await unlink(absolutePath).catch(() => undefined);
      }
      throw error;
    }

    if (proofResult.previousPath) {
      const previousPath = resolve(this.paymentProofRoot, proofResult.previousPath);
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

  private paypalShippingAddress(order: OrderWithShippingAddress): PayPalShippingAddress {
    const countryCode = order.shippingCountryCode?.trim().toUpperCase();
    if (!order.shippingLine1?.trim() || !order.shippingCity?.trim() || !countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
      throw new BadRequestException("A listed destination with a valid two-letter country code is required for PayPal shipping");
    }

    return {
      fullName: order.customerName,
      line1: order.shippingLine1,
      ...(order.shippingLine2 ? { line2: order.shippingLine2 } : {}),
      city: order.shippingCity,
      ...(order.shippingState ? { state: order.shippingState } : {}),
      ...(order.shippingPostalCode ? { postalCode: order.shippingPostalCode } : {}),
      countryCode,
    };
  }

  private paypalShippingMatchesOrder(order: OrderWithShippingAddress, paypalOrder: PayPalOrder): boolean {
    const purchaseUnit = paypalOrder.purchase_units?.find(
      (unit) => unit.reference_id === order.orderNumber || unit.custom_id === order.orderNumber,
    );
    const address = purchaseUnit?.shipping?.address;
    if (!address) return false;

    const normalize = (value: string | null | undefined) => (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
    const expectedCountryCode = order.shippingCountryCode?.trim().toUpperCase();
    const requiredFieldsMatch =
      normalize(address.address_line_1) === normalize(order.shippingLine1) &&
      normalize(address.admin_area_2) === normalize(order.shippingCity) &&
      address.country_code?.trim().toUpperCase() === expectedCountryCode;
    if (!requiredFieldsMatch) return false;

    const optionalFields = [
      [order.shippingLine2, address.address_line_2],
      [order.shippingPostalCode, address.postal_code],
    ] as const;
    if (optionalFields.some(([expected, actual]) => expected?.trim() && normalize(expected) !== normalize(actual))) return false;

    const paypalName = purchaseUnit?.shipping?.name?.full_name;
    return !paypalName || normalize(paypalName) === normalize(order.customerName);
  }

  async createPaypalOrder(orderId: string, requestOrigin?: string) {
    const paymentSettings = await this.settings.getPaymentSettings();
    if (!paymentSettings.paypalEnabled) throw new ServiceUnavailableException("PayPal payments are disabled");
    if (!this.paypal.isConfigured()) throw new ServiceUnavailableException("PayPal is not configured on the server");

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus !== "Pending") throw new BadRequestException("This order is not awaiting payment");
    if (order.paymentMethod !== "PayPal") throw new BadRequestException("This order was placed with a different payment method");
    if (order.status === "Cancelled" || order.status === "Returned") throw new ConflictException("This order is no longer active for payment");
    if (this.lifecycle.isPaymentWindowExpired(order)) {
      await this.lifecycle.releaseExpiredOrders();
      throw new ConflictException("The payment window has expired. Please contact us before trying to pay.");
    }
    if (!order.total.greaterThan(0)) throw new BadRequestException("This order has nothing to pay");
    const shippingAddress = this.paypalShippingAddress(order);

    const origin = this.appOrigin(requestOrigin);
    const checkoutPath = order.source === "Wholesale" ? "/wholesale/checkout" : "/checkout";
    const existingPaypalOrderId = order.paypalOrderId ?? (order.paymentStatus === "Pending" ? order.paymentRef : null);
    if (existingPaypalOrderId) {
      const existingPaypalOrder = await this.paypal.getOrder(existingPaypalOrderId);
      const existingUnit = existingPaypalOrder.purchase_units?.find(
        (unit) => unit.reference_id === order.orderNumber || unit.custom_id === order.orderNumber,
      );
      if (!existingUnit) throw new BadGatewayException("The existing PayPal session does not match this order");
      this.assertAmount(order.total.toFixed(2), order.currency, existingPaypalOrder, "PayPal order amount does not match this order");

      if (existingPaypalOrder.status === "CREATED" || existingPaypalOrder.status === "PAYER_ACTION_REQUIRED") {
        const approveUrl = this.paypal.approvalUrl(existingPaypalOrder);
        if (!approveUrl) throw new BadGatewayException("PayPal did not return an approval link for the existing session");
        if (this.paypalShippingMatchesOrder(order, existingPaypalOrder)) {
          return { orderNumber: order.orderNumber, paypalOrderId: existingPaypalOrder.id, approveUrl };
        }
        this.logger.warn(`Replacing stale PayPal session without the current shipping address for ${order.orderNumber}`);
      }

      if (existingPaypalOrder.status === "APPROVED" || existingPaypalOrder.status === "COMPLETED") {
        throw new ConflictException("This PayPal session is already approved or complete. Refresh the order status before trying again.");
      }
    }

    const retryKey = existingPaypalOrderId
      ? `rv-${createHash("sha256").update(`${order.orderNumber}:${existingPaypalOrderId}`).digest("hex").slice(0, 32)}`
      : undefined;
    const created = await this.paypal.createOrder({
      amount: order.total.toFixed(2),
      currency: order.currency,
      referenceId: order.orderNumber,
      shippingAddress,
      returnUrl: `${origin}${checkoutPath}?paypal=return&orderId=${encodeURIComponent(order.id)}`,
      cancelUrl: `${origin}${checkoutPath}?paypal=cancel&orderId=${encodeURIComponent(order.id)}`,
      ...(retryKey ? { idempotencyKey: retryKey } : {}),
    });

    if (!created.approveUrl) throw new BadGatewayException("PayPal did not return an approval link");

    const createdOrder = await this.paypal.getOrder(created.id);
    this.assertAmount(order.total.toFixed(2), order.currency, createdOrder, "PayPal order amount does not match this order");
    if (!this.paypalShippingMatchesOrder(order, createdOrder)) {
      throw new BadGatewayException("PayPal did not retain the shipping address for this order");
    }

    await this.lifecycle.attachPaypalOrderSession(order.id, order.paypalOrderId, created.id);

    return { orderNumber: order.orderNumber, paypalOrderId: created.id, approveUrl: created.approveUrl };
  }

  async capturePaypalOrder(paypalOrderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ paypalOrderId }, { paymentRef: paypalOrderId }] },
    });
    if (!order) throw new NotFoundException("Order not found for this PayPal payment");

    return this.captureForOrder(order.id, paypalOrderId);
  }

  private async captureForOrder(orderId: string, paypalOrderId: string) {
    let order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");

    if (order.paymentStatus === "Pending" && this.lifecycle.isPaymentWindowExpired(order)) {
      await this.lifecycle.releaseExpiredOrders();
      order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    }

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
    if (order.status === "Cancelled" || order.status === "Returned") {
      throw new ConflictException("This order is no longer active for payment");
    }
    if (this.lifecycle.isPaymentWindowExpired(order)) {
      await this.lifecycle.releaseExpiredOrders();
      throw new ConflictException("The payment window has expired. Please contact us before trying to pay.");
    }

    const paypalOrder = await this.paypal.getOrder(paypalOrderId);
    if (!this.paypalShippingMatchesOrder(order, paypalOrder)) {
      throw new ConflictException("PayPal shipping details do not match this order. Contact the store before paying.");
    }
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
          await this.lifecycle.recordPaymentEvent(order.id, "PayPal capture is pending review");
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

    const settlement = await this.lifecycle.settlePayment({
      orderId: order.id,
      paymentMethod: "PayPal",
      paymentRef: capture.id,
      source: "PayPal checkout",
    });
    if (settlement.outcome === "review") {
      return {
        status: "Pending" as const,
        orderId: settlement.order.id,
        orderNumber: settlement.order.orderNumber,
        total: settlement.order.total.toNumber(),
        currency: settlement.order.currency,
        paidAt: null,
        manualReview: true,
      };
    }
    return {
      status: "Paid" as const,
      orderId: settlement.order.id,
      orderNumber: settlement.order.orderNumber,
      total: settlement.order.total.toNumber(),
      currency: settlement.order.currency,
      paidAt: settlement.order.paidAt,
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
    let order = paypalOrderId
      ? await this.prisma.order.findFirst({ where: { OR: [{ paypalOrderId }, { paymentRef: paypalOrderId }] } })
      : null;
    if (!order && resource.custom_id) {
      order = await this.prisma.order.findUnique({ where: { orderNumber: resource.custom_id } });
    }
    if (!order) {
      this.logger.warn(`PayPal webhook ${type}: no matching order (order ${paypalOrderId ?? "unknown"})`);
      return { received: true, handled: false };
    }
    if (order.paymentMethod !== "PayPal") return { received: true, handled: false };

    if (paypalOrderId && order.paypalOrderId && order.paypalOrderId !== paypalOrderId) {
      this.logger.warn(`PayPal webhook ${type}: ignoring a superseded PayPal order for ${order.orderNumber}`);
      return { received: true, handled: false };
    }

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

    if (!paypalOrderId) {
      this.logger.error(`PayPal webhook for ${order.orderNumber} did not include the related PayPal order ID`);
      return { received: true, handled: false };
    }
    const paypalOrder = await this.paypal.getOrder(paypalOrderId);
    if (!this.paypalShippingMatchesOrder(order, paypalOrder)) {
      this.logger.error(`PayPal capture shipping address did not match order ${order.orderNumber}; manual review required`);
      return { received: true, handled: false };
    }

    const settlement = await this.lifecycle.settlePayment({
      orderId: order.id,
      paymentMethod: "PayPal",
      paymentRef: resource.id,
      source: "PayPal webhook",
    });
    if (settlement.outcome === "review" || settlement.outcome === "late") {
      this.logger.warn("PayPal capture for " + settlement.order.orderNumber + " requires manual review");
    }

    return { received: true, handled: true };
  }

  // ------------------------------------------------------------ reservation expiry

  async releaseExpiredOrders(): Promise<number> {
    return this.lifecycle.releaseExpiredOrders();
  }

}
