import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import type { Customer, Prisma } from "../../generated/prisma";
import { AuthEmailOutboxService, type AuthEmailOutboxKind } from "../email/auth-email-outbox.service";
import { PrismaService } from "../prisma/prisma.service";
import type { WholesaleRequestDto } from "./customer-auth.dto";
import type { UpdateCustomerDto } from "./dto/customer.dto";

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function wholesaleNotificationKey(customerId: string, revision: number, kind: string): string {
  return createHash("sha256").update(`wholesale:${customerId}:${revision}:${kind}`).digest("hex");
}

@Injectable()
export class WholesaleApplicationsService {
  constructor(private readonly prisma: PrismaService, private readonly outbox: AuthEmailOutboxService, private readonly config: ConfigService) {}

  async request(customerId: string, input: WholesaleRequestDto) {
    if (input.businessName.trim().length < 2 || input.country.trim().length < 2 || input.needs.trim().length < 10) {
      throw new BadRequestException("Enter your business name, country and at least 10 characters describing your purchasing needs");
    }
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new UnauthorizedException("Customer account is unavailable");
      if (!customer.emailVerifiedAt) throw new ForbiddenException("Verify your email before requesting Wholesale access");
      if (customer.wholesaleAccess || customer.wholesaleStatus === "Pending") return { wholesaleAccess: customer.wholesaleAccess, wholesaleStatus: customer.wholesaleStatus, wholesaleRequestedAt: customer.wholesaleRequestedAt, requestCreated: false };
      const changed = await tx.customer.updateMany({
        where: { id: customerId, wholesaleRevision: customer.wholesaleRevision, wholesaleAccess: false },
        data: {
          wholesaleStatus: "Pending", wholesaleRequestedAt: new Date(), wholesaleApprovedAt: null,
          wholesaleReviewReason: null, wholesaleReviewedAt: null, wholesaleRevision: { increment: 1 },
          wholesaleBusinessName: input.businessName.trim(), wholesaleBuyerType: input.buyerType,
          wholesaleBusinessCountry: input.country.trim(), wholesaleBusinessWebsite: input.website?.trim() || null,
          wholesaleBusinessNeeds: input.needs.trim(),
        },
      });
      if (changed.count !== 1) throw new ConflictException("Your application changed. Refresh and try again.");
      const updated = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
      await this.notify(tx, updated, true);
      return { wholesaleAccess: updated.wholesaleAccess, wholesaleStatus: updated.wholesaleStatus, wholesaleRequestedAt: updated.wholesaleRequestedAt, requestCreated: true };
    });
  }

  async review(tx: Prisma.TransactionClient, customer: Customer, input: UpdateCustomerDto) {
    if (input.wholesaleStatus && input.wholesaleAccess !== undefined && input.wholesaleAccess !== (input.wholesaleStatus === "Approved")) {
      throw new BadRequestException("Wholesale status and access must agree");
    }
    const decision = input.wholesaleStatus ?? (input.wholesaleAccess === true ? "Approved" : input.wholesaleAccess === false ? "Rejected" : undefined);
    if (!decision) {
      if (input.wholesaleReviewReason !== undefined) throw new BadRequestException("Select a Wholesale decision before entering a reason");
      return;
    }
    if (decision === "Approved" && !customer.emailVerifiedAt) throw new BadRequestException("Verify the customer email before granting Wholesale access");
    const reason = input.wholesaleReviewReason?.trim();
    if (decision === "Rejected" && !reason) throw new BadRequestException("Enter a reason for rejecting or revoking Wholesale access");
    if (customer.wholesaleStatus === decision && customer.wholesaleAccess === (decision === "Approved") && (decision === "Approved" || customer.wholesaleReviewReason === reason)) return;
    const changed = await tx.customer.updateMany({
      where: { id: customer.id, wholesaleRevision: customer.wholesaleRevision },
      data: {
        wholesaleStatus: decision, wholesaleAccess: decision === "Approved", wholesaleReviewedAt: new Date(),
        wholesaleApprovedAt: decision === "Approved" ? new Date() : null,
        wholesaleReviewReason: decision === "Rejected" ? reason : null, wholesaleRevision: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ConflictException("This application changed. Refresh before reviewing it.");
    await this.notify(tx, await tx.customer.findUniqueOrThrow({ where: { id: customer.id } }), false);
  }

  private async notify(tx: Prisma.TransactionClient, customer: Customer, includeAdmin: boolean) {
    const origin = (this.config.get<string>("APP_ORIGIN") ?? "http://localhost:3000").split(",")[0].trim().replace(/\/+$/, "");
    const status = customer.wholesaleStatus;
    const title = status === "Approved" ? "Your Wholesale access is approved" : status === "Rejected" ? "An update on your Wholesale application" : "Your Wholesale request is under review";
    const message = status === "Approved" ? "Your private Wholesale catalog is ready. Sign in to explore products and trade pricing." : status === "Rejected" ? `Your Wholesale access is not approved at this time. Reason: ${customer.wholesaleReviewReason ?? "Please contact our team."} You can update your business details and apply again.` : "We have received your application. Our team will review your business details and email you with a decision.";
    const enqueue = async (kind: AuthEmailOutboxKind, to: string | string[], heading: string, body: string, href: string, label: string) => {
      await this.outbox.enqueue(tx, {
        kind, targetId: customer.id, tokenHash: wholesaleNotificationKey(customer.id, customer.wholesaleRevision, kind), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
        email: {
          to, subject: `${heading} | RENDI VIRGO`, text: `${heading}\n\n${body}\n\n${label}: ${href}`,
          html: `<div style="background:#f7f4ee;padding:32px;font-family:Arial,sans-serif;color:#123c2f"><div style="max-width:560px;margin:auto"><img src="${escape(origin)}/brand/rendi-virgo-primary.png" width="200" alt="RENDI VIRGO"><div style="background:#fffdf8;border:1px solid #ded2bf;border-radius:12px;padding:28px;margin-top:24px"><p style="font-size:11px;letter-spacing:2px;color:#896d41">WHOLESALE PROGRAM</p><h1 style="font:30px Georgia,serif">${escape(heading)}</h1><p style="line-height:1.7;white-space:pre-line">${escape(body)}</p><a href="${escape(href)}" style="display:inline-block;background:#123c2f;color:white;padding:14px 20px;border-radius:6px;text-decoration:none">${escape(label)}</a></div></div></div>`,
        },
      });
    };
    await enqueue("WholesaleCustomerNotification", customer.email, title, message, `${origin}/wholesale/finished`, "View Wholesale status");
    if (includeAdmin) {
      const admins = await tx.admin.findMany({ select: { email: true } });
      const recipients = [...new Set(admins.map((admin) => admin.email))];
      const configured = this.config.get<string>("ADMIN_EMAIL")?.trim();
      if (!recipients.length && configured) recipients.push(configured);
      if (recipients.length) await enqueue("WholesaleAdminNotification", recipients, "New Wholesale application", `${customer.name} (${customer.email}) has requested access.\nBusiness: ${customer.wholesaleBusinessName}\nBuyer type: ${customer.wholesaleBuyerType}\nCountry: ${customer.wholesaleBusinessCountry}\nWebsite: ${customer.wholesaleBusinessWebsite || "Not provided"}\nNeeds: ${customer.wholesaleBusinessNeeds}`, `${origin}/admin/customers/${encodeURIComponent(customer.id)}`, "Review application");
    }
  }
}
