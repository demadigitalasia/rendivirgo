import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey?: string;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>("RESEND_API_KEY")?.trim() || undefined;
    this.from = this.config.get<string>("EMAIL_FROM")?.trim() || "RENDI VIRGO <onboarding@resend.dev>";
    this.replyTo = this.config.get<string>("EMAIL_REPLY_TO")?.trim() || undefined;
  }

  isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  async send(input: SendEmailInput): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(`Email skipped (RESEND_API_KEY not configured): "${input.subject}" -> ${String(input.to)}`);
      return false;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: Array.isArray(input.to) ? input.to : [input.to],
          subject: input.subject,
          html: input.html,
          ...(input.text ? { text: input.text } : {}),
          ...(input.replyTo || this.replyTo ? { reply_to: input.replyTo ?? this.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        this.logger.error(`Resend rejected "${input.subject}" (${response.status}): ${detail.slice(0, 300)}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send "${input.subject}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
