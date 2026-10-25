import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { EmailService } from "../email/email.service";
import { renderNewMessageAdminEmail, renderReplyToCustomerEmail } from "../email/email.templates";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { ContactEmailOutboxService } from "./contact-email-outbox.service";
import { CreateMessageDto, MessageQueryDto, UpdateMessageDto } from "./dto/inbox.dto";

const adminMessageDetail = {
  emailOutbox: {
    select: {
      id: true,
      kind: true,
      status: true,
      attempts: true,
      lastError: true,
      sentAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
};

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    private readonly emailOutbox: ContactEmailOutboxService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ public

  async create(dto: CreateMessageDto) {
    let adminEmail: { to: string; replyTo: string; subject: string; html: string } | null = null;
    let emailPreparationFailed = false;
    try {
      const notificationSettings = await this.settings.getNotificationSettings();
      if (notificationSettings.newMessage) {
        const storeEmail = await this.settings.getStoreEmail();
        adminEmail = {
          to: storeEmail,
          replyTo: dto.email.trim().toLowerCase(),
          subject: `New contact message — ${dto.subject.trim()}`,
          html: renderNewMessageAdminEmail({
            name: dto.name.trim(),
            email: dto.email.trim().toLowerCase(),
            subject: dto.subject.trim(),
            body: dto.body.trim(),
          }),
        };
      }
    } catch (error) {
      emailPreparationFailed = true;
      this.logger.warn(`Could not prepare the contact email notification: ${error instanceof Error ? error.message : String(error)}`);
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone?.trim() || null,
          subject: dto.subject.trim(),
          body: dto.body.trim(),
          status: "New",
        },
      });

      await tx.notification.create({
        data: {
          type: "Message",
          title: `New message from ${created.name}`,
          body: created.subject,
          href: `/admin/messages?open=${created.id}`,
          entityType: "Message",
          entityId: created.id,
        },
      });

      if (emailPreparationFailed) {
        await tx.notification.create({
          data: {
            type: "System",
            title: "Contact email alert could not be prepared",
            body: "A contact message was saved, but its email alert could not be prepared. Check the store notification settings.",
            href: `/admin/messages?open=${created.id}`,
            entityType: "Message",
            entityId: created.id,
          },
        });
      }

      if (adminEmail) {
        try {
          await this.emailOutbox.enqueue(tx, created.id, "AdminNotification", `contact:${created.id}:admin-notification`, adminEmail);
        } catch (error) {
          if (!(error instanceof ServiceUnavailableException)) throw error;
          this.logger.error(`Contact email notification for message ${created.id} was not queued: ${error.message}`);
          await tx.notification.create({
            data: {
              type: "System",
              title: "Contact email configuration needs attention",
              body: "A contact message was saved, but its admin email could not be queued. Review email encryption configuration.",
              href: `/admin/messages?open=${created.id}`,
              entityType: "Message",
              entityId: created.id,
            },
          });
        }
      }

      return created;
    });

    return { ok: true, id: message.id };
  }

  // ------------------------------------------------------------ admin queries

  async listAdmin(query: MessageQueryDto) {
    const where: Prisma.MessageWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, messages, unreadCount] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...skipTake(query.page, query.pageSize),
      }),
      this.prisma.message.count({ where: { status: "New" } }),
    ]);

    return {
      ...paginated(messages, total, query.page, query.pageSize),
      unreadCount,
      emailReadiness: this.email.readiness(),
    };
  }

  async getAdminById(id: string, context: AuditContext) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.message.findUnique({ where: { id } });
      if (!existing) return null;

      const markedRead = existing.status === "New";
      if (markedRead) {
        await tx.message.update({ where: { id }, data: { status: "Read" } });
      }
      await tx.notification.updateMany({
        where: { entityType: "Message", entityId: id },
        data: { isRead: true },
      });

      const message = await tx.message.findUnique({ where: { id }, include: adminMessageDetail });
      return { message, markedRead };
    });

    if (!result?.message) throw new NotFoundException("Message not found");
    if (result.markedRead) {
      await this.audit.log({
        adminId: context.adminId,
        action: "message.mark_read",
        entityType: "Message",
        entityId: result.message.id,
        summary: `Marked message from "${result.message.name}" as read`,
        ip: context.ip,
        userAgent: context.userAgent,
      });
    }
    return result.message;
  }

  // ------------------------------------------------------------ admin mutations

  async update(id: string, dto: UpdateMessageDto, context: AuditContext) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.message.findUnique({ where: { id } });
      if (!existing) return null;

      const message = await tx.message.update({
        where: { id },
        data: dto.status === undefined ? {} : { status: dto.status },
      });
      if (dto.status !== undefined) {
        await tx.notification.updateMany({
          where: { entityType: "Message", entityId: id },
          data: { isRead: dto.status !== "New" },
        });
      }
      return message;
    });
    if (!result) throw new NotFoundException("Message not found");

    await this.audit.log({
      adminId: context.adminId,
      action: "message.update",
      entityType: "Message",
      entityId: result.id,
      summary: `Updated message from "${result.name}"`,
      metadata: { status: result.status },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return result;
  }

  async reply(id: string, adminReply: string, context: AuditContext) {
    const reply = adminReply.trim();
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.message.findUnique({ where: { id } });
      if (!existing) return null;

      const message = await tx.message.update({
        where: { id },
        data: { adminReply: reply, status: "Replied", repliedAt: new Date() },
      });
      await this.emailOutbox.enqueue(tx, id, "CustomerReply", `contact:${id}:reply:${randomUUID()}`, {
        to: message.email,
        subject: `Re: ${message.subject} — RENDI VIRGO`,
        html: renderReplyToCustomerEmail({
          name: message.name,
          subject: message.subject,
          reply: message.adminReply ?? reply,
          original: message.body,
        }),
      });
      await tx.notification.updateMany({
        where: { entityType: "Message", entityId: id },
        data: { isRead: true },
      });
      return message;
    });
    if (!result) throw new NotFoundException("Message not found");

    await this.audit.log({
      adminId: context.adminId,
      action: "message.reply",
      entityType: "Message",
      entityId: result.id,
      summary: `Queued a reply to message from "${result.name}"`,
      metadata: { status: result.status },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return result;
  }

  async retryEmail(id: string, emailId: string, context: AuditContext) {
    const retried = await this.emailOutbox.retry(id, emailId);
    if (!retried.ok) {
      if (retried.reason === "not-found") throw new NotFoundException("Email delivery not found");
      throw new BadRequestException("Only failed email deliveries with a retained payload can be retried");
    }

    await this.audit.log({
      adminId: context.adminId,
      action: "message.email_retry",
      entityType: "Message",
      entityId: id,
      summary: "Retried a contact email delivery",
      metadata: { emailId },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return { ok: true };
  }

  async remove(id: string, context: AuditContext) {
    const existing = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.findUnique({ where: { id } });
      if (!message) return null;
      await tx.notification.deleteMany({ where: { entityType: "Message", entityId: id } });
      await tx.message.delete({ where: { id } });
      return message;
    });
    if (!existing) throw new NotFoundException("Message not found");

    await this.audit.log({
      adminId: context.adminId,
      action: "message.delete",
      entityType: "Message",
      entityId: id,
      summary: `Deleted message from "${existing.name}" (${existing.subject})`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }
}
