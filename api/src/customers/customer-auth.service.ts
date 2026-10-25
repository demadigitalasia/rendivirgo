import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { publicAppOrigin } from "../common/utils/public-app-origin";
import { createHash, randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import type { Prisma } from "../../generated/prisma";
import { AuthEmailOutboxService } from "../email/auth-email-outbox.service";
import { renderCustomerPasswordResetEmail, renderCustomerVerificationEmail, renderCustomerVerificationEmailText, type CustomerEmailLanguage } from "../email/email.templates";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateCustomerProfileDto } from "./customer-auth.dto";

export const CUSTOMER_SESSION_COOKIE_NAME = "rv_customer_session";
const VERIFY_TTL_MINUTES = 30;
const RESET_TTL_MINUTES = 30;

type SessionContext = { ip?: string | null; userAgent?: string | null };

@Injectable()
export class CustomerAuthService {
  private readonly ttlHours: number;
  private readonly dummyPasswordHash = bcrypt.hash(randomBytes(32).toString("base64url"), 12);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailOutbox: AuthEmailOutboxService,
    private readonly config: ConfigService,
  ) {
    const ttl = Number(this.config.get("CUSTOMER_SESSION_TTL_HOURS") ?? 720);
    this.ttlHours = Number.isFinite(ttl) && ttl > 0 ? Math.min(ttl, 24 * 90) : 720;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async equalizePasswordWork(candidate = "rendi-virgo-auth-check"): Promise<void> {
    await bcrypt.compare(candidate, await this.dummyPasswordHash);
  }

  private appOrigin(): string {
    return publicAppOrigin({ PUBLIC_SITE_URL: this.config.get<string>("PUBLIC_SITE_URL"), APP_ORIGIN: this.config.get<string>("APP_ORIGIN"), NODE_ENV: this.config.get<string>("NODE_ENV") });
  }

  private verificationSentRecently(expiresAt: Date | null, now = new Date()): boolean {
    if (!expiresAt) return false;
    const issuedAt = expiresAt.getTime() - VERIFY_TTL_MINUTES * 60_000;
    return issuedAt <= now.getTime() && now.getTime() - issuedAt < 2 * 60_000;
  }

  private async enqueueVerificationLink(
    tx: Prisma.TransactionClient,
    customer: { id: string; email: string; name: string },
    language: CustomerEmailLanguage = "en",
    next?: string,
  ): Promise<void> {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + VERIFY_TTL_MINUTES * 60_000);
    await tx.customer.update({
      where: { id: customer.id },
      data: { verificationTokenHash: tokenHash, verificationTokenExpiresAt: expiresAt },
    });
    const allowedNext = ["/wholesale/finished", "/wholesale/checkout", "/id/wholesale/finished", "/id/wholesale/checkout"].includes(next ?? "")
      ? next
      : next === "/account/lapidary" || /^\/account\/lapidary\?claim=[A-Za-z0-9_-]{43}$/.test(next ?? "")
        ? next
        : undefined;
    const link = `${this.appOrigin()}/account/verify-email?token=${encodeURIComponent(token)}${allowedNext ? `&next=${encodeURIComponent(allowedNext)}` : ""}`;
    await this.emailOutbox.enqueue(tx, {
      kind: "CustomerVerification",
      targetId: customer.id,
      tokenHash,
      expiresAt,
      email: {
        to: customer.email,
        subject: language === "id" ? "Verifikasi email RENDI VIRGO Anda" : "Verify your RENDI VIRGO email",
        html: renderCustomerVerificationEmail({ link, expiresMinutes: VERIFY_TTL_MINUTES, language }),
        text: renderCustomerVerificationEmailText({ link, expiresMinutes: VERIFY_TTL_MINUTES, language }),
      },
    });
  }

  private async issueVerificationLink(
    customer: { id: string; email: string; name: string },
    language: CustomerEmailLanguage = "en",
    next?: string,
  ): Promise<void> {
    await this.prisma.$transaction((tx) => this.enqueueVerificationLink(tx, customer, language, next));
  }

  async register(input: { email: string; next?: string }, language: CustomerEmailLanguage = "en"): Promise<{ ok: true }> {
    const email = input.email.trim().toLowerCase();
    await this.equalizePasswordWork();
    const existing = await this.prisma.customer.findUnique({ where: { email } });
    if (existing?.emailVerifiedAt) return { ok: true };
    if (existing && this.verificationSentRecently(existing.verificationTokenExpiresAt)) return { ok: true };

    await this.prisma.$transaction(async (tx) => {
      const customer = existing
        ? existing
        : await tx.customer.create({
          data: {
            email,
            name: "Customer",
          },
        });
      await this.enqueueVerificationLink(tx, customer, language, input.next);
    });
    return { ok: true };
  }

  async resendVerification(emailInput: string, language: CustomerEmailLanguage = "en", next?: string): Promise<{ ok: true }> {
    const email = emailInput.trim().toLowerCase();
    await this.equalizePasswordWork();
    const customer = await this.prisma.customer.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        verificationTokenExpiresAt: true,
      },
    });
    if (!customer || customer.emailVerifiedAt) return { ok: true };
    if (this.verificationSentRecently(customer.verificationTokenExpiresAt)) return { ok: true };

    await this.issueVerificationLink(customer, language, next);
    return { ok: true };
  }

  async verifyEmail(token: string, nameInput: string, password: string): Promise<{ ok: true }> {
    const now = new Date();
    const tokenHash = this.hashToken(token.trim());
    const name = nameInput.trim();
    if (!name) throw new BadRequestException("Enter your name to finish setting up your customer account");
    const customer = await this.prisma.customer.findFirst({
      where: { verificationTokenHash: tokenHash, verificationTokenExpiresAt: { gt: now } },
      select: { id: true, email: true },
    });
    if (!customer) throw new BadRequestException("This verification link is invalid or has expired");

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => {
      const activated = await tx.customer.updateMany({
        where: { id: customer.id, verificationTokenHash: tokenHash, verificationTokenExpiresAt: { gt: now } },
        data: { name, passwordHash, emailVerifiedAt: now, verificationTokenHash: null, verificationTokenExpiresAt: null },
      });
      if (activated.count !== 1) throw new BadRequestException("This verification link is invalid or has expired");
      await tx.order.updateMany({ where: { email: customer.email, customerId: null }, data: { customerId: customer.id } });
    });
    return { ok: true };
  }

  async validateCredentials(emailInput: string, password: string) {
    const customer = await this.prisma.customer.findUnique({ where: { email: emailInput.trim().toLowerCase() } });
    if (!customer?.passwordHash || !customer.emailVerifiedAt) {
      await this.equalizePasswordWork(password);
      return null;
    }
    if (!(await bcrypt.compare(password, customer.passwordHash))) return null;
    return { id: customer.id, email: customer.email, name: customer.name, wholesaleAccess: customer.wholesaleAccess, emailVerifiedAt: customer.emailVerifiedAt };
  }

  async createSession(customerId: string, context: SessionContext) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { email: true, emailVerifiedAt: true } });
    if (!customer?.emailVerifiedAt) throw new UnauthorizedException("Verify your email before signing in");
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.ttlHours * 60 * 60_000);
    await this.prisma.$transaction(async (tx) => {
      await tx.customerSession.create({
        data: {
          customerId,
          tokenHash: this.hashToken(token),
          ip: context.ip ?? null,
          userAgent: context.userAgent?.slice(0, 400) ?? null,
          expiresAt,
        },
      });
      await tx.order.updateMany({ where: { email: customer.email, customerId: null }, data: { customerId } });
    });
    return { token, expiresAt };
  }

  async resolveSession(token: string) {
    const session = await this.prisma.customerSession.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { customer: true },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now() || !session.customer.emailVerifiedAt) return null;
    return {
      customer: {
        id: session.customer.id,
        email: session.customer.email,
        name: session.customer.name,
        wholesaleAccess: session.customer.wholesaleAccess,
        emailVerifiedAt: session.customer.emailVerifiedAt,
      },
      session,
    };
  }

  async revokeSession(token: string) {
    await this.prisma.customerSession.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(emailInput: string): Promise<void> {
    const email = emailInput.trim().toLowerCase();
    const customer = await this.prisma.customer.findUnique({ where: { email } });
    await this.equalizePasswordWork();
    if (!customer?.passwordHash || !customer.emailVerifiedAt) return;

    const now = new Date();
    if (customer.resetTokenHash && customer.resetTokenExpiresAt && customer.resetTokenExpiresAt > now) return;

    const token = randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.customer.updateMany({
        where: {
          id: customer.id,
          OR: [
            { resetTokenHash: null },
            { resetTokenExpiresAt: null },
            { resetTokenExpiresAt: { lte: now } },
          ],
        },
        data: { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt },
      });
      if (claimed.count !== 1) return;
      await this.emailOutbox.enqueue(tx, {
        kind: "CustomerPasswordReset",
        targetId: customer.id,
        tokenHash,
        expiresAt,
        email: {
          to: email,
          subject: "Reset your RENDI VIRGO password",
          html: renderCustomerPasswordResetEmail({
            name: customer.name,
            link: `${this.appOrigin()}/account/reset-password?token=${encodeURIComponent(token)}`,
            expiresMinutes: RESET_TTL_MINUTES,
          }),
        },
      });
    });
  }

  async resetPassword(token: string, password: string): Promise<boolean> {
    const now = new Date();
    const tokenHash = this.hashToken(token.trim());
    const customer = await this.prisma.customer.findFirst({
      where: { resetTokenHash: tokenHash, resetTokenExpiresAt: { gt: now }, emailVerifiedAt: { not: null } },
      select: { id: true },
    });
    if (!customer) return false;
    const passwordHash = await bcrypt.hash(password, 12);
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.customer.updateMany({
        where: { id: customer.id, resetTokenHash: tokenHash, resetTokenExpiresAt: { gt: now } },
        data: {
          passwordHash,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
        },
      });
      if (changed.count !== 1) return false;
      await tx.customerSession.updateMany({ where: { customerId: customer.id, revokedAt: null }, data: { revokedAt: new Date() } });
      return true;
    });
  }

  async profile(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new UnauthorizedException("Customer account is unavailable");
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      emailVerifiedAt: customer.emailVerifiedAt,
      phone: customer.phone,
      acceptsMarketing: customer.acceptsMarketing,
      wholesaleAccess: customer.wholesaleAccess,
      wholesaleRequestedAt: customer.wholesaleRequestedAt,
      wholesaleStatus: customer.wholesaleStatus,
      wholesaleReviewReason: customer.wholesaleReviewReason,
      wholesaleReviewedAt: customer.wholesaleReviewedAt,
      wholesaleBusinessName: customer.wholesaleBusinessName,
      wholesaleBuyerType: customer.wholesaleBuyerType,
      wholesaleBusinessCountry: customer.wholesaleBusinessCountry,
      wholesaleBusinessWebsite: customer.wholesaleBusinessWebsite,
      wholesaleBusinessNeeds: customer.wholesaleBusinessNeeds,
      address: {
        line1: customer.addressLine1,
        line2: customer.addressLine2,
        city: customer.city,
        state: customer.state,
        postalCode: customer.postalCode,
        country: customer.country,
        countryCode: customer.countryCode,
      },
    };
  }

  async updateProfile(customerId: string, dto: UpdateCustomerProfileDto) {
    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(dto.name !== undefined ? { name: (dto.name as string).trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone as string | null } : {}),
        ...(dto.addressLine1 !== undefined ? { addressLine1: dto.addressLine1 as string | null } : {}),
        ...(dto.addressLine2 !== undefined ? { addressLine2: dto.addressLine2 as string | null } : {}),
        ...(dto.city !== undefined ? { city: dto.city as string | null } : {}),
        ...(dto.state !== undefined ? { state: dto.state as string | null } : {}),
        ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode as string | null } : {}),
        ...(dto.country !== undefined ? { country: dto.country as string | null } : {}),
        ...(dto.countryCode !== undefined ? { countryCode: dto.countryCode as string | null } : {}),
        ...(dto.acceptsMarketing !== undefined ? { acceptsMarketing: dto.acceptsMarketing as boolean } : {}),
      },
    });
    return this.profile(updated.id);
  }

  async listOrders(customerId: string, page = 1) {
    const pageSize = 20;
    const [total, pendingPayment, activeOrders, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where: { customerId } }),
      this.prisma.order.count({ where: { customerId, paymentStatus: "Pending" } }),
      this.prisma.order.count({ where: { customerId, status: { in: ["New", "Processing", "Packed", "Shipped"] } } }),
      this.prisma.order.findMany({
        where: { customerId },
        orderBy: { placedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { items: true } } },
      }),
    ]);
    return {
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
      summary: { total, pendingPayment, activeOrders },
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        source: order.source,
        status: order.status,
        paymentStatus: order.paymentStatus,
        currency: order.currency,
        total: order.total,
        itemCount: order._count.items,
        placedAt: order.placedAt,
      })),
    };
  }

  async orderDetail(customerId: string, orderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: { customerId, orderNumber },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    return {
      orderNumber: order.orderNumber,
      source: order.source,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      currency: order.currency,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      shippingCost: order.shippingCost,
      taxTotal: order.taxTotal,
      total: order.total,
      placedAt: order.placedAt,
      shippingName: order.shippingName,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      shippingAddress: {
        name: order.customerName,
        line1: order.shippingLine1,
        line2: order.shippingLine2,
        city: order.shippingCity,
        state: order.shippingState,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry,
        countryCode: order.shippingCountryCode,
      },
      items: order.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        imageUrl: item.imageUrl,
      })),
    };
  }
}
