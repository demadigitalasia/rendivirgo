import { Controller, Get, Logger, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
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
  @Get("live")
  live() {
    return {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get()
  check(@Res({ passthrough: true }) response: Response) {
    return this.readiness(response);
  }

  @Public()
  @Get("ready")
  ready(@Res({ passthrough: true }) response: Response) {
    return this.readiness(response);
  }

  private async readiness(response: Response) {
    let database = "up";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "down";
    }

    const configuredUploadDir = this.config.get<string>("UPLOAD_DIR") ?? "uploads";
    const uploadDir = isAbsolute(configuredUploadDir)
      ? configuredUploadDir
      : resolve(process.cwd(), configuredUploadDir);
    const privateUploadDir = resolve(
      this.config.get<string>("LAPIDARY_PRIVATE_UPLOAD_DIR") ??
        join(process.cwd(), "private-uploads", "lapidary"),
    );
    const uploads = await this.directoryStatus(uploadDir, "Uploads");
    const privateUploads = await this.directoryStatus(privateUploadDir, "Private lapidary uploads");

    const status = database === "up" && uploads === "up" && privateUploads === "up" ? "ok" : "degraded";
    response.status(status === "ok" ? 200 : 503);

    return {
      status,
      database,
      uploads,
      privateUploads,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async directoryStatus(directory: string, label: string) {
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await access(directory, constants.W_OK);
      return "up";
    } catch (error) {
      this.logger.warn(
        label + " directory is not writable: " +
          (error instanceof Error ? error.message : String(error)),
      );
      return "down";
    }
  }
}
