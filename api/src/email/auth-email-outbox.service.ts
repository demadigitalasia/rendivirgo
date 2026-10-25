import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService, type SendEmailInput } from "./email.service";

export type AuthEmailOutboxKind = "CustomerVerification" | "CustomerPasswordReset" | "CustomerPasswordChanged" | "AdminPasswordReset" | "WholesaleCustomerNotification" | "WholesaleAdminNotification";

type EnqueueAuthEmailInput = {
  kind: AuthEmailOutboxKind;
  targetId: string;
  tokenHash: string;
  expiresAt: Date;
  email: SendEmailInput;
};

type AuthEmailJob = {
  id: string;
  kind: AuthEmailOutboxKind;
  targetId: string;
  tokenHash: string;
  dedupeKey: string;
  encryptedPayload: string;
  expiresAt: Date;
  status: "Pending" | "Processing";
  lockedAt: Date | null;
  attempts: number;
};

class AuthEmailPayloadError extends Error {}

const MAX_ATTEMPTS = 8;

@Injectable()
export class AuthEmailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthEmailOutboxService.name);
  private dispatchTimer?: NodeJS.Timeout;
  private dispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.email.isEnabled()) {
      this.logger.error("Auth email outbox is waiting for RESEND_API_KEY configuration");
    }
    void this.dispatchOutbox();
    this.dispatchTimer = setInterval(() => void this.dispatchOutbox(), 15_000);
    this.dispatchTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
  }

  async enqueue(tx: Prisma.TransactionClient, input: EnqueueAuthEmailInput): Promise<void> {
    if (!this.email.isEnabled() && !input.kind.startsWith("Wholesale") && input.kind !== "CustomerPasswordChanged") {
      throw new ServiceUnavailableException("Email delivery is currently unavailable");
    }
    await tx.authEmailOutbox.create({
      data: {
        kind: input.kind,
        targetId: input.targetId,
        tokenHash: input.tokenHash,
        dedupeKey: input.tokenHash,
        encryptedPayload: this.encrypt(input.email),
        expiresAt: input.expiresAt,
      },
    });
  }

  private encryptionKey(): Buffer {
    const secret = this.config.get<string>("SESSION_SECRET")?.trim();
    const production = this.config.get<string>("NODE_ENV") === "production";
    if (!secret || (production && secret.length < 32)) {
      throw new ServiceUnavailableException("Auth email encryption requires a stable SESSION_SECRET of at least 32 characters");
    }
    return createHmac("sha256", secret).update("rendi-virgo:auth-email-outbox:v1").digest();
  }

  private encrypt(input: SendEmailInput): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(input), "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
  }

  private decrypt(encrypted: string): SendEmailInput {
    try {
      const [version, ivPart, tagPart, payloadPart] = encrypted.split(".");
      if (version !== "v1" || !ivPart || !tagPart || !payloadPart) throw new Error("Invalid encrypted auth email payload");
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(ivPart, "base64url"));
      decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(payloadPart, "base64url")),
        decipher.final(),
      ]).toString("utf8");
      const input = JSON.parse(plaintext) as SendEmailInput;
      if (!input || typeof input.subject !== "string" || typeof input.html !== "string" || !input.to) {
        throw new Error("Invalid auth email payload");
      }
      return input;
    } catch {
      throw new AuthEmailPayloadError("Auth email payload could not be decrypted");
    }
  }

  private async dispatchOutbox(): Promise<void> {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      const now = new Date();
      await this.prisma.authEmailOutbox.updateMany({
        where: { status: { in: ["Pending", "Processing"] }, expiresAt: { lte: now } },
        data: { status: "Cancelled", encryptedPayload: "", lockedAt: null, lastError: "Link expired before delivery" },
      });
      await this.prisma.authEmailOutbox.deleteMany({
        where: { status: { in: ["Sent", "Cancelled", "Failed"] }, updatedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60_000) } },
      });
      if (!this.email.isEnabled()) return;

      const staleLock = new Date(now.getTime() - 5 * 60_000);
      const jobs = await this.prisma.authEmailOutbox.findMany({
        where: {
          expiresAt: { gt: now },
          OR: [
            { status: "Pending", availableAt: { lte: now } },
            { status: "Processing", lockedAt: { lte: staleLock } },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      for (const job of jobs) {
        const claim = await this.prisma.authEmailOutbox.updateMany({
          where: job.status === "Pending"
            ? { id: job.id, status: "Pending", availableAt: { lte: now } }
            : { id: job.id, status: "Processing", lockedAt: job.lockedAt },
          data: { status: "Processing", lockedAt: now, attempts: { increment: 1 } },
        });
        if (claim.count !== 1) continue;

        try {
          const claimedJob = job as AuthEmailJob;
          if (!(await this.tokenIsCurrent(claimedJob))) {
            await this.prisma.authEmailOutbox.updateMany({
              where: { id: job.id, status: "Processing", lockedAt: now },
              data: { status: "Cancelled", encryptedPayload: "", lockedAt: null, lastError: "Auth token is no longer current" },
            });
            continue;
          }

          let input: SendEmailInput;
          try {
            input = this.decrypt(job.encryptedPayload);
          } catch (error) {
            if (!(error instanceof AuthEmailPayloadError)) throw error;
            await this.prisma.authEmailOutbox.updateMany({
              where: { id: job.id, status: "Processing", lockedAt: now },
              data: { status: "Failed", encryptedPayload: "", lockedAt: null, lastError: "Auth email payload could not be decrypted" },
            });
            this.logger.error(`Auth email outbox job ${job.id} could not be decrypted; retries stopped`);
            continue;
          }
          const sent = await this.email.send({ ...input, idempotencyKey: job.dedupeKey });
          if (!sent) throw new Error("Email provider did not accept the message");
          await this.prisma.authEmailOutbox.updateMany({
            where: { id: job.id, status: "Processing", lockedAt: now },
            data: { status: "Sent", sentAt: new Date(), encryptedPayload: "", lockedAt: null, lastError: null },
          });
        } catch (error) {
          const attempts = job.attempts + 1;
          const expired = job.expiresAt.getTime() <= Date.now();
          const terminal = attempts >= MAX_ATTEMPTS || expired;
          const delayMs = Math.min(5 * 60_000, 15_000 * 2 ** Math.min(attempts - 1, 4));
          await this.prisma.authEmailOutbox.updateMany({
            where: { id: job.id, status: "Processing", lockedAt: now },
            data: {
              status: terminal ? "Failed" : "Pending",
              availableAt: new Date(Date.now() + delayMs),
              lockedAt: null,
              ...(terminal ? { encryptedPayload: "" } : {}),
              lastError: "Email provider did not accept the message",
            },
          });
          this.logger.error(`Auth email outbox job ${job.id} failed on attempt ${attempts}${terminal ? "; retries stopped" : `; retry scheduled in ${Math.ceil(delayMs / 1000)} seconds`}`);
        }
      }
    } catch (error) {
      this.logger.error(`Auth email outbox dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.dispatching = false;
    }
  }

  private async tokenIsCurrent(job: AuthEmailJob): Promise<boolean> {
    const now = new Date();
    if (job.expiresAt.getTime() <= now.getTime()) return false;
    if (job.kind === "WholesaleCustomerNotification" || job.kind === "WholesaleAdminNotification") {
      const customer = await this.prisma.customer.findUnique({ where: { id: job.targetId }, select: { wholesaleRevision: true } });
      return Boolean(customer && createHash("sha256").update(`wholesale:${job.targetId}:${customer.wholesaleRevision}:${job.kind}`).digest("hex") === job.tokenHash);
    }
    if (job.kind === "CustomerVerification") {
      return Boolean(await this.prisma.customer.findFirst({
        where: { id: job.targetId, verificationTokenHash: job.tokenHash, verificationTokenExpiresAt: { gt: now } },
        select: { id: true },
      }));
    }
    if (job.kind === "CustomerPasswordReset") {
      return Boolean(await this.prisma.customer.findFirst({
        where: { id: job.targetId, resetTokenHash: job.tokenHash, resetTokenExpiresAt: { gt: now }, emailVerifiedAt: { not: null } },
        select: { id: true },
      }));
    }
    if (job.kind === "CustomerPasswordChanged") {
      return Boolean(await this.prisma.customer.findFirst({
        where: { id: job.targetId, emailVerifiedAt: { not: null } },
        select: { id: true },
      }));
    }
    return Boolean(await this.prisma.admin.findFirst({
      where: { id: job.targetId, resetTokenHash: job.tokenHash, resetTokenExpiresAt: { gt: now } },
      select: { id: true },
    }));
  }
}
