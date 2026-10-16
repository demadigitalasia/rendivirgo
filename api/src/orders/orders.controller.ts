import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { IsEmail } from "class-validator";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import {
  CreateOrderDto,
  CreateReturnRequestDto,
  CreateOrderEventDto,
  OrderQueryDto,
  RefundOrderDto,
  ReviewReturnRequestDto,
  UpdateFulfillmentDto,
  UpdateOrderDto,
} from "./dto/order.dto";
import { OrdersService } from "./orders.service";
import { OrderReturnRequestsService, type ReturnEvidenceFile } from "./order-return-requests.service";

class RequestHistoryLinkDto {
  @IsEmail()
  email: string;
}

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly returnRequests: OrderReturnRequestsService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("quote")
  quote(@Body() dto: CreateOrderDto) {
    return this.ordersService.quote(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post("return-requests")
  @UseInterceptors(FileInterceptor("evidence", {
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.mimetype)) {
        callback(new BadRequestException("Upload a JPEG, PNG, WebP, GIF, or AVIF image"), false);
        return;
      }
      callback(null, true);
    },
  }))
  submitReturnRequest(@Body() dto: CreateReturnRequestDto, @UploadedFile() evidence?: ReturnEvidenceFile) {
    return this.returnRequests.submit(dto, evidence);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post("history-link")
  historyLink(@Body() dto: RequestHistoryLinkDto) {
    return this.ordersService.requestHistoryLink(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get("history")
  history(@Query("token") token?: string) {
    return this.ordersService.history(token ?? "");
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get("track/:orderNumber")
  track(@Param("orderNumber") orderNumber: string, @Query("email") email?: string) {
    return this.ordersService.track(orderNumber, email);
  }
}

@Controller("admin/orders")
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly returnRequests: OrderReturnRequestsService,
  ) {}

  @Get()
  list(@Query() query: OrderQueryDto) {
    return this.ordersService.listAdmin(query);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.ordersService.getAdminById(id);
  }

  @Patch(":id/return-requests/:requestId")
  reviewReturnRequest(
    @Param("id") orderId: string,
    @Param("requestId") requestId: string,
    @Body() dto: ReviewReturnRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.returnRequests.review(orderId, requestId, dto, auditContextFrom(request));
  }

  @Get(":id/return-requests/:requestId/evidence")
  async returnEvidence(
    @Param("id") orderId: string,
    @Param("requestId") requestId: string,
    @Res() response: Response,
  ) {
    const image = await this.returnRequests.readEvidence(orderId, requestId);
    response.setHeader("Content-Type", image.mimeType);
    response.setHeader("Content-Length", image.buffer.length);
    response.setHeader("Content-Disposition", `inline; filename="${image.filename}"`);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    response.send(image.buffer);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOrderDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.update(id, dto, auditContextFrom(request));
  }

  @Patch(":id/fulfillment")
  advanceFulfillment(
    @Param("id") id: string,
    @Body() dto: UpdateFulfillmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ordersService.advanceFulfillment(id, dto.status, auditContextFrom(request));
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.ordersService.cancelOrder(id, auditContextFrom(request));
  }

  @Post(":id/return")
  returnOrder(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.ordersService.returnOrder(id, auditContextFrom(request));
  }

  @Post(":id/confirm-payment")
  confirmPayment(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.ordersService.confirmPayment(id, auditContextFrom(request));
  }

  @Post(":id/events")
  addEvent(@Param("id") id: string, @Body() dto: CreateOrderEventDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.addEvent(id, dto, auditContextFrom(request));
  }

  @Get(":id/invoice")
  invoice(@Param("id") id: string) {
    return this.ordersService.invoice(id);
  }

  @Post(":id/refund")
  refund(@Param("id") id: string, @Body() dto: RefundOrderDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.refund(id, dto, auditContextFrom(request));
  }
}
