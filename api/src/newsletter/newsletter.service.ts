import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { paginated, skipTake, type Paginated } from "../common/dto/pagination.dto";
import { PrismaService } from "../prisma/prisma.service";
import { SubscribeNewsletterDto } from "./dto/newsletter.dto";

export type NewsletterQuery = {
  search?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: SubscribeNewsletterDto) {
    const email = dto.email.trim().toLowerCase();
    const subscriber = await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        locale: dto.locale?.trim().toLowerCase() || null,
        source: dto.source?.trim() || "footer",
      },
      update: {
        isActive: true,
        ...(dto.locale ? { locale: dto.locale.trim().toLowerCase() } : {}),
        ...(dto.source ? { source: dto.source.trim() } : {}),
      },
    });

    return { ok: true, email: subscriber.email };
  }

  private buildWhere(query: NewsletterQuery): Prisma.NewsletterSubscriberWhereInput {
    const where: Prisma.NewsletterSubscriberWhereInput = {};
    if (!query.includeInactive) where.isActive = true;
    if (query.search?.trim()) {
      where.email = { contains: query.search.trim(), mode: "insensitive" };
    }
    return where;
  }

  async listAdmin(query: NewsletterQuery): Promise<Paginated<{ id: string; email: string; locale: string | null; source: string | null; isActive: boolean; createdAt: Date }>> {
    const where = this.buildWhere(query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [total, subscribers] = await this.prisma.$transaction([
      this.prisma.newsletterSubscriber.count({ where }),
      this.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, locale: true, source: true, isActive: true, createdAt: true },
        ...skipTake(page, pageSize),
      }),
    ]);

    return paginated(subscribers, total, page, pageSize);
  }

  async exportCsv(query: NewsletterQuery): Promise<string> {
    const subscribers = await this.prisma.newsletterSubscriber.findMany({
      where: this.buildWhere(query),
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });

    const lines = ["email,locale,source,active,subscribedAt"];
    for (const subscriber of subscribers) {
      lines.push(
        [
          subscriber.email,
          subscriber.locale ?? "",
          subscriber.source ?? "",
          subscriber.isActive ? "true" : "false",
          subscriber.createdAt.toISOString(),
        ].join(","),
      );
    }
    return lines.join("\n");
  }

  async unsubscribe(id: string) {
    await this.prisma.newsletterSubscriber.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }
}
