import { Body, Controller, Get, Post, Req, UnauthorizedException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../common/decorators/public.decorator";
import { CapturePayPalOrderDto, CreatePayPalOrderDto, ResumeCheckoutDto } from "./dto/payments.dto";
import { PayPalService } from "./paypal.service";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paypalService: PayPalService,
  ) {}

  @Public()
  @Get("methods")
  methods() {
    return this.paymentsService.methods();
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("resume")
  resume(@Body() dto: ResumeCheckoutDto) {
    return this.paymentsService.resumeCheckout(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("paypal/orders")
  createPaypalOrder(@Body() dto: CreatePayPalOrderDto, @Req() request: Request) {
    return this.paymentsService.createPaypalOrder(dto.orderId, request.headers.origin);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("paypal/capture")
  capture(@Body() dto: CapturePayPalOrderDto) {
    return this.paymentsService.capturePaypalOrder(dto.paypalOrderId);
  }

  @Public()
  @Post("paypal/webhook")
  async webhook(@Req() request: Request) {
    const event = request.body as { event_type?: string; resource?: Record<string, unknown> };
    const verified = await this.paypalService.verifyWebhook(
      request.headers as Record<string, string | string[] | undefined>,
      event,
      (request as Request & { rawBody?: Buffer }).rawBody,
    );
    if (!verified) {
      throw new UnauthorizedException("PayPal webhook signature could not be verified");
    }
    const result = await this.paymentsService.handleWebhook(event);
    return { ...result, verified: true };
  }
}
