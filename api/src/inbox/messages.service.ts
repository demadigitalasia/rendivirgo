import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMessageDto, MessageQueryDto, UpdateMessageDto } from "./dto/inbox.dto";

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ public

  async create(dto: CreateMessageDto) {
    const message = await this.prisma.message.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        subject: dto.subject.trim(),
        body: dto.body.trim(),
        status: "New",
      },
    });

    await this.prisma.notification.create({
      data: {
        type: "Message",
        title: `New message from ${message.name}`,
        body: message.subject,
        href: `/admin/messages/${message.id}`,
        entityType: "Message",
        entityId: message.id,
      },
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

    return { ...paginated(messages, total, query.page, query.pageSize), unreadCount };
  }

  async getAdminById(id: string, context: AuditContext) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException("Message not found");

    if (message.status === "New") {
      const updated = await this.prisma.message.update({ where: { id }, data: { status: "Read" } });
      await this.audit.log({
        adminId: context.adminId,
        action: "message.mark_read",
        entityType: "Message",
        entityId: updated.id,
        summary: `Marked message from "${updated.name}" as read`,
        ip: context.ip,
        userAgent: context.userAgent,
      });
      return updated;
    }

    return message;
  }

  // ------------------------------------------------------------ admin mutations

  async update(id: string, dto: UpdateMessageDto, context: AuditContext) {
    const existing = await this.prisma.message.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Message not found");

    const data: Prisma.MessageUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;

    if (dto.adminReply !== undefined) {
      const reply = dto.adminReply.trim();
      data.adminReply = reply || null;
      if (reply) {
        data.status = "Replied";
        data.repliedAt = new Date();
      }
    }

    const message = await this.prisma.message.update({ where: { id }, data });

    await this.audit.log({
      adminId: context.adminId,
      action: "message.update",
      entityType: "Message",
      entityId: message.id,
      summary: `Updated message from "${message.name}"`,
      metadata: { status: message.status, replied: Boolean(message.adminReply) },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return message;
  }

  async reply(id: string, adminReply: string, context: AuditContext) {
    return this.update(id, { adminReply }, context);
  }

  async remove(id: string, context: AuditContext) {
    const existing = await this.prisma.message.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Message not found");

    await this.prisma.message.delete({ where: { id } });

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
