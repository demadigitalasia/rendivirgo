import { Controller, Get, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  async check() {
    let database = "up";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "down";
    }

    let uploads = "up";
    try {
      const uploadDir = join(process.cwd(), this.config.get<string>("UPLOAD_DIR") ?? "uploads");
      await mkdir(uploadDir, { recursive: true });
      await access(uploadDir, constants.W_OK);
    } catch (error) {
      uploads = "down";
      this.logger.warn(`Uploads directory is not writable: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      status: database === "up" && uploads === "up" ? "ok" : "degraded",
      database,
      uploads,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
