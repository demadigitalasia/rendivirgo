import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import express from "express";
import { join } from "node:path";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { DecimalSerializerInterceptor } from "./common/interceptors/decimal-serializer.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  const config = app.get(ConfigService);
  const port = Number(config.get("PORT") ?? 4000);
  const origins = (config.get<string>("APP_ORIGIN") ?? "http://localhost:3002")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.use(
    "/uploads",
    express.static(join(process.cwd(), config.get<string>("UPLOAD_DIR") ?? "uploads"), {
      maxAge: "7d",
      fallthrough: true,
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
