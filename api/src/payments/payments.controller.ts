import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { createReadStream } from "node:fs";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../common/decorators/public.decorator";
import {
  CapturePayPalOrderDto,
  CreatePayPalOrderDto,
  ResumeCheckoutDto,
  SubmitBankTransferProofDto,
} from "./dto/payments.dto";
import { PayPalService } from "./paypal.service";
import { PaymentsService, type PaymentProofFile } from "./payments.service";

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
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("bank-transfer/:orderId/proof")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
        if (!allowed.includes(file.mimetype)) {
          callback(new BadRequestException("Only jpeg, png, webp, gif, or avif receipts are allowed"), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  submitBankTransferProof(
    @Param("orderId") orderId: string,
    @Body() dto: SubmitBankTransferProofDto,
    @UploadedFile() file: PaymentProofFile | undefined,
  ) {
    return this.paymentsService.submitBankTransferProof(orderId, dto.email, file);
  }

  @Get("admin/orders/:orderId/bank-transfer-proof")
  @Header("Cache-Control", "private, no-store")
  async bankTransferProof(@Param("orderId") orderId: string) {
    const proof = await this.paymentsService.getBankTransferProof(orderId);
    return new StreamableFile(createReadStream(proof.path), {
      type: proof.mimeType,
      disposition: "inline",
    });
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
