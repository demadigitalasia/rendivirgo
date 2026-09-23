import { Controller, Get, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Prisma } from "../../generated/prisma";
import { paginated, skipTake } from "../common/dto/pagination.dto";
import { PrismaService } from "../prisma/prisma.service";

class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  adminId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

@Controller("admin/audit-logs")
export class AuditLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: AuditLogQueryDto) {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.entityType) where.entityType = query.entityType;
    if (query.action) where.action = query.action;
    if (query.adminId) where.adminId = query.adminId;
    if (query.search) where.summary = { contains: query.search.trim(), mode: "insensitive" };

    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: this.endOfDay(query.to) } : {}),
      };
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { id: true, email: true, name: true } } },
        ...skipTake(query.page, query.pageSize),
      }),
    ]);

    return paginated(logs, total, query.page, query.pageSize);
  }

  private endOfDay(value: string): Date {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setHours(23, 59, 59, 999);
    }
    return date;
  }
}
