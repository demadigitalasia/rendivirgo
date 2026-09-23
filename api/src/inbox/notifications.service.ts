import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { paginated, skipTake } from "../common/dto/pagination.dto";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationQueryDto } from "./dto/inbox.dto";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = {};
    if (query.unreadOnly) where.isRead = false;
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, notifications, unreadCount] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...skipTake(query.page, query.pageSize),
      }),
      this.prisma.notification.count({ where: { isRead: false } }),
    ]);

    return { ...paginated(notifications, total, query.page, query.pageSize), unreadCount };
  }

  async unreadCount() {
    const unreadCount = await this.prisma.notification.count({ where: { isRead: false } });
    return { unreadCount };
  }

  async markRead(id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException("Notification not found");
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead() {
    const result = await this.prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }

  async remove(id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException("Notification not found");
    await this.prisma.notification.delete({ where: { id } });
    return { ok: true };
  }
}
