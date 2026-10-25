import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService, type SendEmailInput } from "../email/email.service";

const MAX_ATTEMPTS = 8;
const DISPATCH_INTERVAL_MS = 15_000;

@Injectable()
export class LapidaryEmailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LapidaryEmailOutboxService.name);
  private timer?: NodeJS.Timeout;
  private dispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    void this.dispatchOutbox();
    this.timer = setInterval(() => void this.dispatchOutbox(), DISPATCH_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(tx: Prisma.TransactionClient, requestId: string, dedupeKey: string, input: SendEmailInput): Promise<void> {
    await tx.lapidaryEmailOutbox.create({
      data: { requestId, dedupeKey, encryptedPayload: this.encrypt(input) },
    });
  }

  private encryptionKey(): Buffer {
    const secret = this.config.get<string>("SESSION_SECRET")?.trim();
    const production = this.config.get<string>("NODE_ENV") === "production";
    if (!secret || (production && secret.length < 32)) {
      throw new ServiceUnavailableException("Lapidary email delivery requires a stable SESSION_SECRET of at least 32 characters");
    }
    return createHmac("sha256", secret).update("rendi-virgo:lapidary-email-outbox:v1").digest();
  }

  private encrypt(input: SendEmailInput): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(input), "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
  }

  private decrypt(encrypted: string): SendEmailInput {
    const [version, ivPart, tagPart, payloadPart] = encrypted.split(".");
    if (version !== "v1" || !ivPart || !tagPart || !payloadPart) throw new Error("Invalid lapidary email payload");
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payloadPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const input = JSON.parse(plaintext) as SendEmailInput;
    if (!input || typeof input.subject !== "string" || typeof input.html !== "string" || !input.to) {
      throw new Error("Invalid lapidary email payload");
    }
    return input;
  }

  private async dispatchOutbox(): Promise<void> {
    if (this.dispatching || !this.email.isEnabled() || !this.email.readiness().senderConfigured) return;
    this.dispatching = true;
    try {
      const now = new Date();
      await this.prisma.lapidaryEmailOutbox.deleteMany({
        where: { status: { in: ["Sent", "Failed"] }, updatedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60_000) } },
      });
      const staleLock = new Date(now.getTime() - 5 * 60_000);
      const jobs = await this.prisma.lapidaryEmailOutbox.findMany({
        where: {
          OR: [
            { status: "Pending", availableAt: { lte: now } },
            { status: "Processing", lockedAt: { lte: staleLock } },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      for (const job of jobs) {
        const claim = await this.prisma.lapidaryEmailOutbox.updateMany({
          where: job.status === "Pending"
            ? { id: job.id, status: "Pending", availableAt: { lte: now } }
            : { id: job.id, status: "Processing", lockedAt: job.lockedAt },
          data: { status: "Processing", lockedAt: now, attempts: { increment: 1 } },
        });
        if (claim.count !== 1) continue;

        try {
          const email = this.decrypt(job.encryptedPayload);
          if (email.claimTokenHash) {
            const request = await this.prisma.lapidaryRequest.findUnique({ where: { id: job.requestId }, select: { claimTokenHash: true, claimTokenExpiresAt: true, customerId: true } });
            if (!request || request.customerId || request.claimTokenHash !== email.claimTokenHash || !request.claimTokenExpiresAt || request.claimTokenExpiresAt <= new Date()) {
              await this.prisma.lapidaryEmailOutbox.updateMany({ where: { id: job.id, status: "Processing", lockedAt: now }, data: { status: "Failed", encryptedPayload: "", lockedAt: null, lastError: "Invitation superseded, expired, or already redeemed. Issue a new invitation if needed." } });
              continue;
            }
          }
          const sent = await this.email.send({ ...email, idempotencyKey: job.dedupeKey });
          if (!sent) throw new Error("Email provider did not accept the message");
          await this.prisma.lapidaryEmailOutbox.updateMany({
            where: { id: job.id, status: "Processing", lockedAt: now },
            data: { status: "Sent", sentAt: new Date(), encryptedPayload: "", lockedAt: null, lastError: null },
          });
        } catch (error) {
          const attempts = job.attempts + 1;
          const terminal = attempts >= MAX_ATTEMPTS;
          const delayMs = Math.min(5 * 60_000, 15_000 * 2 ** Math.min(attempts - 1, 4));
          await this.prisma.lapidaryEmailOutbox.updateMany({
            where: { id: job.id, status: "Processing", lockedAt: now },
            data: {
              status: terminal ? "Failed" : "Pending",
              availableAt: new Date(Date.now() + delayMs),
              lockedAt: null,
              lastError: error instanceof Error ? error.message.slice(0, 500) : "Email provider did not accept the message",
            },
          });
          if (terminal) {
            await this.prisma.notification.create({
              data: {
                type: "System",
                title: `Lapidary customer email needs attention`,
                body: `The message for request ${job.requestId} failed after ${MAX_ATTEMPTS} attempts. Retry it from the request dashboard.`,
                href: `/admin/lapidary/requests?open=${job.requestId}`,
                entityType: "LapidaryRequest",
                entityId: job.requestId,
              },
            });
          }
          this.logger.error(`Lapidary email job ${job.id} failed on attempt ${attempts}${terminal ? "; retries stopped" : `; retry scheduled in ${Math.ceil(delayMs / 1000)} seconds`}`);
        }
      }
    } catch (error) {
      this.logger.error(`Lapidary email dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.dispatching = false;
    }
  }
}
