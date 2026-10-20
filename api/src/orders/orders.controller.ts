import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { IsEmail } from "class-validator";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { CUSTOMER_SESSION_COOKIE_NAME, CustomerAuthService } from "../customers/customer-auth.service";
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
import { WholesaleCatalogQueryDto } from "./dto/wholesale-catalog-query.dto";
import { OrdersService } from "./orders.service";
import { OrderReturnRequestsService, type ReturnEvidenceFile } from "./order-return-requests.service";
import { CustomerGuard } from "../customers/customer.guard";
import { IsInt, IsNumber, Min } from "class-validator";

class UpdateWholesaleMinimumsDto {
  @IsNumber()
  @Min(0)
  minimumSubtotalUsd: number;

  @IsInt()
  @Min(0)
  minimumPieces: number;
}

@Public()
@UseGuards(CustomerGuard)
@Controller("wholesale")
export class WholesaleController {
  constructor(private readonly ordersService: OrdersService) {}

  private customerId(request: AuthenticatedRequest): string {
    if (!request.customer?.wholesaleAccess) throw new ForbiddenException("This account does not have Wholesale access");
    return request.customer.id;
  }

  @Get("minimums")
  minimums(@Req() request: AuthenticatedRequest) {
    this.customerId(request);
    return this.ordersService.wholesaleMinimums();
  }

  @Get("catalog")
  catalog(@Req() request: AuthenticatedRequest, @Query() query: WholesaleCatalogQueryDto) {
    return this.ordersService.wholesaleCatalog(this.customerId(request), query);
  }

  @Post("quote")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  quote(@Body() dto: CreateOrderDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.quoteWholesale(dto, this.customerId(request));
  }

  @Post("orders")
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  create(@Body() dto: CreateOrderDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.createWholesale(dto, this.customerId(request));
  }
}

@Controller("admin/wholesale")
export class AdminWholesaleController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get("minimums")
  minimums() {
    return this.ordersService.wholesaleMinimums();
  }

  @Patch("minimums")
  updateMinimums(@Body() dto: UpdateWholesaleMinimumsDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.updateWholesaleMinimums(dto, auditContextFrom(request));
  }
}

class RequestHistoryLinkDto {
  @IsEmail()
  email: string;
}

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly returnRequests: OrderReturnRequestsService,
    private readonly customerAuth: CustomerAuthService,
  ) {}

  private async signedInCustomerId(request: AuthenticatedRequest): Promise<string | undefined> {
    const token = (request.cookies as Record<string, string> | undefined)?.[CUSTOMER_SESSION_COOKIE_NAME];
    if (!token) return undefined;
    const session = await this.customerAuth.resolveSession(token);
    return session?.customer.id;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("quote")
  async quote(@Body() dto: CreateOrderDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.quote(dto, await this.signedInCustomerId(request));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async create(@Body() dto: CreateOrderDto, @Req() request: AuthenticatedRequest) {
    const customerId = await this.signedInCustomerId(request);
    return this.ordersService.create(dto, false, customerId ? { source: "Online", customerId } : undefined);
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

  @Post(":id/restock-return")
  restockReturnedInventory(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.ordersService.restockReturnedInventory(id, auditContextFrom(request));
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
