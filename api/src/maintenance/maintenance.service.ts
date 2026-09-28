import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60_000;
const RUN_INTERVAL_MS = DAY_MS;

export type MaintenanceResult = {
  sessions: number;
  notifications: number;
  auditLogs: number;
};

@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const firstRun = setTimeout(() => {
      void this.run().catch((error) =>
        this.logger.error(`Maintenance run failed: ${error instanceof Error ? error.message : String(error)}`),
      );
    }, FIRST_RUN_DELAY_MS);
    firstRun.unref?.();

    this.timer = setInterval(() => {
      void this.run().catch((error) =>
        this.logger.error(`Maintenance run failed: ${error instanceof Error ? error.message : String(error)}`),
      );
    }, RUN_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<MaintenanceResult> {
    const now = Date.now();
    const auditRetentionDays = Number(this.config.get<string>("AUDIT_RETENTION_DAYS") ?? 365);
    const auditCutoff = new Date(now - (Number.isFinite(auditRetentionDays) && auditRetentionDays > 0 ? auditRetentionDays : 365) * DAY_MS);

    const [sessions, notifications, auditLogs] = await this.prisma.$transaction([
      this.prisma.adminSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date(now - 7 * DAY_MS) } },
            { revokedAt: { lt: new Date(now - 7 * DAY_MS) } },
          ],
        },
      }),
      this.prisma.notification.deleteMany({
        where: { isRead: true, createdAt: { lt: new Date(now - 90 * DAY_MS) } },
      }),
      this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } }),
    ]);

    const result: MaintenanceResult = {
      sessions: sessions.count,
      notifications: notifications.count,
      auditLogs: auditLogs.count,
    };

    if (result.sessions || result.notifications || result.auditLogs) {
      this.logger.log(
        `Retention clean-up: ${result.sessions} session(s), ${result.notifications} notification(s), ${result.auditLogs} audit log(s) removed`,
      );
    }

    return result;
  }
}
