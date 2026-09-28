import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type PayPalOrder = {
  id: string;
  status: string;
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    amount?: { currency_code: string; value: string };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
      }>;
    };
  }>;
  links?: Array<{ rel: string; href: string }>;
};

export type PayPalCapture = {
  id: string;
  status: string;
  amount: { currency_code: string; value: string };
};

@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly webhookId?: string;
  private readonly baseUrl: string;
  private cachedToken?: { value: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>("PAYPAL_CLIENT_ID")?.trim() || undefined;
    this.clientSecret = this.config.get<string>("PAYPAL_CLIENT_SECRET")?.trim() || undefined;
    this.webhookId = this.config.get<string>("PAYPAL_WEBHOOK_ID")?.trim() || undefined;
    const environment = (this.config.get<string>("PAYPAL_ENV") ?? "sandbox").trim().toLowerCase();
    this.baseUrl = environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  private async accessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) return this.cachedToken.value;
    if (!this.clientId || !this.clientSecret) throw new BadGatewayException("PayPal is not configured");

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      this.logger.error(`PayPal authentication failed (${response.status})`);
      throw new BadGatewayException("PayPal authentication failed");
    }

    const payload = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = { value: payload.access_token, expiresAt: Date.now() + payload.expires_in * 1000 };
    return this.cachedToken.value;
  }

  private async request<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
    const token = await this.accessToken();
    const { idempotencyKey, ...rest } = init;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...rest,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          ...(idempotencyKey ? { "paypal-request-id": idempotencyKey } : {}),
          ...(rest.headers ?? {}),
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      this.logger.error(`PayPal ${rest.method ?? "GET"} ${path} unreachable: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadGatewayException("PayPal is unreachable");
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      this.logger.error(`PayPal ${rest.method ?? "GET"} ${path} failed (${response.status}): ${detail.slice(0, 500)}`);
      throw new BadGatewayException("PayPal request failed");
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async createOrder(input: {
    amount: string;
    currency: string;
    referenceId: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; approveUrl: string | null }> {
    const order = await this.request<PayPalOrder>("/v2/checkout/orders", {
      method: "POST",
      idempotencyKey: `rv-${input.referenceId}`,
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: input.referenceId,
            custom_id: input.referenceId,
            amount: { currency_code: input.currency, value: input.amount },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "RENDI VIRGO",
              user_action: "PAY_NOW",
              shipping_preference: "NO_SHIPPING",
              return_url: input.returnUrl,
              cancel_url: input.cancelUrl,
            },
          },
        },
      }),
    });

    const approveUrl =
      order.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href ?? null;

    return { id: order.id, approveUrl };
  }

  async getOrder(paypalOrderId: string): Promise<PayPalOrder> {
    return this.request<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`);
  }

  async captureOrder(paypalOrderId: string): Promise<PayPalOrder> {
    return this.request<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: "POST",
      body: "{}",
    });
  }

  extractCapture(order: PayPalOrder): PayPalCapture | null {
    const capture = order.purchase_units?.[0]?.payments?.captures?.find((entry) => entry.status === "COMPLETED");
    return capture ?? null;
  }

  async verifyWebhook(headers: Record<string, string | string[] | undefined>, event: unknown): Promise<boolean> {
    if (!this.webhookId) {
      this.logger.warn("PayPal webhook received but PAYPAL_WEBHOOK_ID is not configured — rejecting");
      return false;
    }

    const header = (name: string): string | undefined => {
      const value = headers[name];
      return Array.isArray(value) ? value[0] : value;
    };

    const transmissionId = header("paypal-transmission-id");
    const transmissionTime = header("paypal-transmission-time");
    const certUrl = header("paypal-cert-url");
    const authAlgo = header("paypal-auth-algo");
    const transmissionSig = header("paypal-transmission-sig");
    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) return false;

    try {
      const result = await this.request<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
        method: "POST",
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: this.webhookId,
          webhook_event: event,
        }),
      });
      return result.verification_status === "SUCCESS";
    } catch {
      return false;
    }
  }
}
