import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService, type SendEmailInput } from "../email/email.service";

const MAX_ATTEMPTS = 8;
const DISPATCH_INTERVAL_MS = 15_000;

type ContactEmailJob = {
  id: string;
  messageId: string;
  kind: "AdminNotification" | "CustomerReply";
  dedupeKey: string;
  encryptedPayload: string;
  status: "Pending" | "Processing";
  lockedAt: Date | null;
  attempts: number;
};

@Injectable()
export class ContactEmailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContactEmailOutboxService.name);
  private timer?: NodeJS.Timeout;
  private dispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.email.isEnabled() || !this.email.readiness().senderConfigured) {
      this.logger.warn("Contact email outbox is waiting for RESEND_API_KEY and EMAIL_FROM configuration");
    }
    void this.dispatchOutbox();
    this.timer = setInterval(() => void this.dispatchOutbox(), DISPATCH_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(
    tx: Prisma.TransactionClient,
    messageId: string,
    kind: "AdminNotification" | "CustomerReply",
    dedupeKey: string,
    input: SendEmailInput,
  ): Promise<void> {
    await tx.contactEmailOutbox.create({
      data: { messageId, kind, dedupeKey, encryptedPayload: this.encrypt(input) },
    });
  }

  async retry(messageId: string, emailId: string) {
    const job = await this.prisma.contactEmailOutbox.findFirst({
      where: { id: emailId, messageId },
      select: { id: true, status: true, encryptedPayload: true },
    });
    if (!job) return { ok: false as const, reason: "not-found" as const };
    if (job.status !== "Failed" || !job.encryptedPayload) {
      return { ok: false as const, reason: "not-retryable" as const };
    }

    const updated = await this.prisma.contactEmailOutbox.updateMany({
      where: { id: emailId, messageId, status: "Failed", encryptedPayload: { not: "" } },
      data: { status: "Pending", attempts: 0, availableAt: new Date(), lockedAt: null, lastError: null },
    });
    return updated.count === 1
      ? { ok: true as const }
      : { ok: false as const, reason: "not-retryable" as const };
  }

  private encryptionKey(): Buffer {
    const secret = this.config.get<string>("SESSION_SECRET")?.trim();
    if (!secret) throw new ServiceUnavailableException("Contact email encryption requires SESSION_SECRET");
    if (this.config.get<string>("NODE_ENV") === "production" && secret.length < 32) {
      throw new ServiceUnavailableException("Contact email encryption requires a stable SESSION_SECRET of at least 32 characters");
    }
    return createHmac("sha256", secret).update("rendi-virgo:contact-email-outbox:v1").digest();
  }

  private encrypt(input: SendEmailInput): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(input), "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
  }

  private decrypt(encrypted: string): SendEmailInput {
    const [version, ivPart, tagPart, payloadPart] = encrypted.split(".");
    if (version !== "v1" || !ivPart || !tagPart || !payloadPart) throw new Error("Invalid contact email payload");
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payloadPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const input = JSON.parse(plaintext) as SendEmailInput;
    if (!input || typeof input.subject !== "string" || typeof input.html !== "string" || !input.to) {
      throw new Error("Invalid contact email payload");
    }
    return input;
  }

  private async dispatchOutbox(): Promise<void> {
    if (this.dispatching || !this.email.isEnabled() || !this.email.readiness().senderConfigured) return;
    this.dispatching = true;
    try {
      const now = new Date();
      const staleLock = new Date(now.getTime() - 5 * 60_000);
      const jobs = await this.prisma.contactEmailOutbox.findMany({
        where: {
          OR: [
            { status: "Pending", availableAt: { lte: now } },
            { status: "Processing", lockedAt: { lte: staleLock } },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      for (const candidate of jobs) {
        const job = candidate as ContactEmailJob;
        const lockedAt = new Date();
        const claim = await this.prisma.contactEmailOutbox.updateMany({
          where: job.status === "Pending"
            ? { id: job.id, status: "Pending", availableAt: { lte: now } }
            : { id: job.id, status: "Processing", lockedAt: job.lockedAt },
          data: { status: "Processing", lockedAt, attempts: { increment: 1 } },
        });
        if (claim.count !== 1) continue;

        try {
          const sent = await this.email.send({ ...this.decrypt(job.encryptedPayload), idempotencyKey: job.dedupeKey });
          if (!sent) throw new Error("Email provider did not accept the message");
          await this.prisma.contactEmailOutbox.updateMany({
            where: { id: job.id, status: "Processing", lockedAt },
            data: { status: "Sent", sentAt: new Date(), encryptedPayload: "", lockedAt: null, lastError: null },
          });
        } catch (error) {
          const attempts = job.attempts + 1;
          const terminal = attempts >= MAX_ATTEMPTS;
          const delayMs = Math.min(5 * 60_000, 15_000 * 2 ** Math.min(attempts - 1, 4));
          const lastError = error instanceof Error ? error.message.slice(0, 500) : "Email provider did not accept the message";
          await this.prisma.contactEmailOutbox.updateMany({
            where: { id: job.id, status: "Processing", lockedAt },
            data: {
              status: terminal ? "Failed" : "Pending",
              availableAt: new Date(Date.now() + delayMs),
              lockedAt: null,
              lastError,
            },
          });

          if (terminal) {
            await this.prisma.notification.create({
              data: {
                type: "System",
                title: "Contact email needs attention",
                body: "An email for a contact message failed after repeated attempts. Open the inbox message to retry it.",
                href: `/admin/messages?open=${job.messageId}`,
                entityType: "Message",
                entityId: job.messageId,
              },
            });
          }
          this.logger.error(`Contact email job ${job.id} failed on attempt ${attempts}${terminal ? "; retries stopped" : `; retry scheduled in ${Math.ceil(delayMs / 1000)} seconds`}`);
        }
      }
    } catch (error) {
      this.logger.error(`Contact email dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.dispatching = false;
    }
  }
}
