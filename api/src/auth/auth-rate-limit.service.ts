import { createHmac } from "node:crypto";
import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthRateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthRateLimitService.name);
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  onModuleInit() {
    void this.cleanupExpiredBuckets();
    this.cleanupTimer = setInterval(() => void this.cleanupExpiredBuckets(), 5 * 60_000);
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async consume(action: string, identity: string | undefined, limit: number, windowMs: number): Promise<void> {
    const secret = this.config.get<string>("SESSION_SECRET")?.trim();
    const production = this.config.get<string>("NODE_ENV") === "production";
    if (!secret || (production && secret.length < 32)) {
      throw new ServiceUnavailableException("Shared authentication rate limiting requires a stable SESSION_SECRET of at least 32 characters");
    }

    const key = createHmac("sha256", secret).update(`auth-rate-limit:v1:${action}:${identity || "unknown"}`).digest("hex");
    const resetAt = new Date(Date.now() + windowMs);
    const rows = await this.prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "AuthRateLimitBucket" ("key", "count", "resetAt", "updatedAt")
      VALUES (${key}, 1, ${resetAt}, CURRENT_TIMESTAMP)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "AuthRateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN 1
          ELSE "AuthRateLimitBucket"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "AuthRateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN EXCLUDED."resetAt"
          ELSE "AuthRateLimitBucket"."resetAt"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "count", "resetAt"
    `;

    if (rows[0]?.count > limit) {
      const retrySeconds = Math.max(1, Math.ceil((rows[0].resetAt.getTime() - Date.now()) / 1000));
      throw new HttpException(`Too many ${action} requests. Try again in ${retrySeconds} seconds.`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async cleanupExpiredBuckets(): Promise<void> {
    try {
      await this.prisma.authRateLimitBucket.deleteMany({ where: { resetAt: { lte: new Date() } } });
    } catch (error) {
      this.logger.error(`Auth rate limit bucket cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
