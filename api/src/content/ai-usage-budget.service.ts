import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import type { AuditContext } from "../common/types/audit-context";

type AiUsageStatus = "success" | "failure";
type UsageMetadata = Record<string, unknown>;

const AI_USAGE_ACTION = "ai.generate";
const RESERVATION_TIMEOUT_MS = 5 * 60_000;

function metadataObject(value: unknown): UsageMetadata {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UsageMetadata : {};
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

@Injectable()
export class AiUsageBudgetService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private numberSetting(name: string, fallback: number, minimum = 1): number {
    const raw = this.config.get<string>(name)?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value >= minimum ? value : fallback;
  }

  allowedModels(): Set<string> {
    const configured = this.config.get<string>("AI_ALLOWED_MODELS")
      ?.split(",")
      .map((model) => model.trim())
      .filter(Boolean);
    const fallback = this.config.get<string>("OPENROUTER_MODEL")?.trim() || "openai/gpt-4.1-mini";
    return new Set(configured?.length ? configured : [fallback]);
  }

  async reserve(input: { kind: string; model: string; inputCharacters: number }, actor?: AuditContext): Promise<string> {
    if (!this.allowedModels().has(input.model)) {
      throw new HttpException(
        "This AI model is not approved. Select an approved model in Admin Settings or ask an administrator to update AI_ALLOWED_MODELS.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const requestReservationUsd = this.numberSetting("AI_REQUEST_RESERVATION_USD", 0.1, 0.001);
    const monthlyBudgetUsd = this.numberSetting("AI_MONTHLY_BUDGET_USD", 25, 0.01);
    const dailyRequestLimit = Math.floor(this.numberSetting("AI_DAILY_REQUEST_LIMIT", 50));
    const perAdminDailyLimit = Math.floor(this.numberSetting("AI_DAILY_ADMIN_REQUEST_LIMIT", 30));
    const concurrentLimit = Math.floor(this.numberSetting("AI_MAX_CONCURRENT_REQUESTS", 2));

    return this.prisma.$transaction(async (tx) => {
      // Serialize admission checks across API replicas. This lock is held only while the budget row is inspected and reserved.
      // The lock function returns PostgreSQL `void`, which Prisma cannot deserialize from `$queryRaw`.
      // We only need its transaction-scoped side effect, so execute it without requesting rows.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261026, 41001)`;
      const monthWhere = { action: AI_USAGE_ACTION, createdAt: { gte: monthStart } };
      const recordCount = await tx.auditLog.count({ where: monthWhere });
      if (recordCount > 5000) {
        throw new HttpException("AI usage history is too large to calculate the budget safely. Ask an administrator to review usage records.", HttpStatus.SERVICE_UNAVAILABLE);
      }
      const rows = await tx.auditLog.findMany({
        where: monthWhere,
        orderBy: { createdAt: "asc" },
        select: { id: true, adminId: true, createdAt: true, metadata: true },
      });

      const currentRows = rows.map((row) => ({ ...row, metadata: metadataObject(row.metadata) }));
      for (const row of currentRows) {
        if (row.metadata.status !== "pending" || now.getTime() - row.createdAt.getTime() <= RESERVATION_TIMEOUT_MS) continue;
        const reserved = positiveNumber(row.metadata.estimatedCostUsd) ?? requestReservationUsd;
        const expiredMetadata = {
          ...row.metadata,
          status: "failure",
          outcome: "reservation_expired",
          providerCostUsd: reserved,
          durationMs: now.getTime() - row.createdAt.getTime(),
        };
        await tx.auditLog.update({ where: { id: row.id }, data: { summary: "AI generation reservation expired", metadata: expiredMetadata } });
        row.metadata = expiredMetadata;
      }

      const todayRows = currentRows.filter((row) => row.createdAt >= dayStart);
      if (todayRows.length >= dailyRequestLimit) {
        throw new HttpException("The daily AI request limit has been reached. Try again tomorrow.", HttpStatus.TOO_MANY_REQUESTS);
      }
      if (actor?.adminId && todayRows.filter((row) => row.adminId === actor.adminId).length >= perAdminDailyLimit) {
        throw new HttpException("Your daily AI request limit has been reached. Try again tomorrow.", HttpStatus.TOO_MANY_REQUESTS);
      }

      const inFlight = currentRows.filter((row) => row.metadata.status === "pending").length;
      if (inFlight >= concurrentLimit) {
        throw new HttpException("AI is handling its maximum number of requests. Try again in a moment.", HttpStatus.TOO_MANY_REQUESTS);
      }

      const monthlyCost = currentRows.reduce((sum, row) => {
        const providerCost = positiveNumber(row.metadata.providerCostUsd);
        const reservedCost = positiveNumber(row.metadata.estimatedCostUsd);
        return sum + (providerCost ?? reservedCost ?? 0);
      }, 0);
      if (monthlyCost + requestReservationUsd > monthlyBudgetUsd) {
        throw new HttpException("The monthly AI budget has been reached. Contact an administrator to review the budget.", HttpStatus.TOO_MANY_REQUESTS);
      }

      const reservation = await tx.auditLog.create({
        data: {
          adminId: actor?.adminId ?? null,
          action: AI_USAGE_ACTION,
          entityType: "AI",
          summary: `AI ${input.kind} generation pending`,
          metadata: {
            kind: input.kind,
            model: input.model,
            status: "pending",
            inputCharacters: input.inputCharacters,
            estimatedCostUsd: requestReservationUsd,
          },
          ip: actor?.ip ?? null,
          userAgent: actor?.userAgent ?? null,
        },
        select: { id: true },
      });
      return reservation.id;
    });
  }

  async complete(reservationId: string, status: AiUsageStatus, details: UsageMetadata, durationMs: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261026, 41001)`;
      const row = await tx.auditLog.findUnique({ where: { id: reservationId }, select: { metadata: true } });
      if (!row) throw new Error("AI usage reservation is missing.");
      const current = metadataObject(row.metadata);
      if (current.status !== "pending") return;
      await tx.auditLog.update({
        where: { id: reservationId },
        data: {
          summary: `AI ${String(current.kind ?? "content")} generation ${status}`,
          metadata: { ...current, ...details, status, durationMs },
        },
      });
    });
  }
}
