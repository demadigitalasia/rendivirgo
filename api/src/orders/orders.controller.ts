import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { auditContextFrom } from "../common/utils/audit-context";
import { CreateOrderDto, CreateOrderEventDto, OrderQueryDto, RefundOrderDto, UpdateOrderDto } from "./dto/order.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Public()
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Public()
  @Get("track/:orderNumber")
  track(@Param("orderNumber") orderNumber: string, @Query("email") email?: string) {
    return this.ordersService.track(orderNumber, email);
  }
}

@Controller("admin/orders")
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@Query() query: OrderQueryDto) {
    return this.ordersService.listAdmin(query);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.ordersService.getAdminById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOrderDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.update(id, dto, auditContextFrom(request));
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
