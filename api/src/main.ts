import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { DecimalSerializerInterceptor } from "./common/interceptors/decimal-serializer.interceptor";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });
  const config = app.get(ConfigService);
  const logger = new Logger("Http");
  const port = Number(config.get("PORT") ?? 4000);
  const isProduction = config.get<string>("NODE_ENV") === "production";
  const configuredOrigin = config.get<string>("APP_ORIGIN")?.trim();

  if (isProduction && !configuredOrigin) {
    throw new Error("APP_ORIGIN must be set in production (comma-separated list of allowed origins)");
  }

  const configuredOrigins = (configuredOrigin ?? "http://localhost:3002")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = Array.from(
    new Set(isProduction ? configuredOrigins : [...configuredOrigins, "http://localhost:3000", "http://localhost:3002"]),
  );
  const allowedOrigins = new Set(origins);

  const trustProxySetting = config.get<string>("TRUST_PROXY") ?? "1";
  const trustProxy =
    trustProxySetting === "false" || trustProxySetting === "0"
      ? false
      : Number.isFinite(Number(trustProxySetting))
        ? Number(trustProxySetting)
        : trustProxySetting;
  (app.getHttpAdapter().getInstance() as { set(setting: string, value: unknown): void }).set(
    "trust proxy",
    trustProxy,
  );

  app.setGlobalPrefix("api");

  // JSON bodies can carry blog/page documents and CSV imports, so allow 2 MB.
  app.useBodyParser("json", { limit: "2mb" });
  app.useBodyParser("urlencoded", { limit: "2mb", extended: true });

  app.use(cookieParser());
  app.use((request: Request & { id?: string }, response: Response, next: NextFunction) => {
    const requestId = request.headers["x-request-id"]?.toString().slice(0, 80) || randomUUID();
    request.id = requestId;
    response.setHeader("x-request-id", requestId);

    const startedAt = Date.now();
    response.on("finish", () => {
      const line = `${request.method} ${request.originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms rid=${requestId}`;
      if (response.statusCode >= 500) logger.error(line);
      else logger.log(line);
    });

    next();
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
    const origin = request.headers.origin;
    if (mutating && origin && !allowedOrigins.has(origin)) {
      response.status(403).json({ statusCode: 403, message: "Invalid request origin" });
      return;
    }
    next();
  });
  app.use(
    "/uploads",
    express.static(join(process.cwd(), config.get<string>("UPLOAD_DIR") ?? "uploads"), {
      maxAge: "7d",
      fallthrough: true,
      index: false,
      dotfiles: "deny",
      setHeaders: (response) => {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Content-Disposition", "inline");
        response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      },
    }),
  );
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new DecimalSerializerInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  await app.listen(port);
  new Logger("Bootstrap").log(`RENDI VIRGO API listening on http://localhost:${port}/api`);
}

void bootstrap();
