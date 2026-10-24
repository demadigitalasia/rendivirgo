import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { EtsyIntegrationService } from "../etsy/etsy-integration.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePosReservationDto, CreatePosSaleDto, PosSettingsDto } from "./dto/pos.dto";

const EXCHANGE_RATE_KEY = "pos.usdIdrRate";
const catalogInclude = {
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
  variants: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.ProductInclude;

type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof catalogInclude }>;

@Injectable()
export class PosService implements OnModuleInit, OnModuleDestroy {
  private reservationTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly etsy: EtsyIntegrationService,
  ) {}

  onModuleInit() {
    this.reservationTimer = setInterval(() => {
      void this.releaseExpiredReservations().catch(() => undefined);
    }, 30_000);
    this.reservationTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.reservationTimer) clearInterval(this.reservationTimer);
  }

  private async configuredRate(): Promise<number | null> {
    const setting = await this.prisma.siteSetting.findUnique({ where: { key: EXCHANGE_RATE_KEY }, select: { value: true } });
    const rate = typeof setting?.value === "number" ? setting.value : Number(setting?.value);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }

  async getSettings() {
    return { currency: "IDR", exchangeRate: await this.configuredRate() };
  }

  async updateSettings(dto: PosSettingsDto, context: AuditContext) {
    const rate = Math.round(dto.exchangeRate * 10_000) / 10_000;
    await this.prisma.siteSetting.upsert({
      where: { key: EXCHANGE_RATE_KEY },
      create: { key: EXCHANGE_RATE_KEY, value: rate },
      update: { value: rate },
    });
    await this.audit.log({
      adminId: context.adminId,
      action: "pos.settings.update",
      entityType: "SiteSetting",
      entityId: EXCHANGE_RATE_KEY,
      summary: `Updated POS USD-IDR exchange rate to ${rate}`,
      metadata: { exchangeRate: rate },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return { currency: "IDR", exchangeRate: rate };
  }

  private normalizedReservationItems(items: CreatePosReservationDto["items"]) {
    const quantities = new Map<string, { productId: string; variantId: string | null; quantity: number }>();
    for (const item of items) {
      const variantId = item.variantId ?? null;
      const key = `${item.productId}:${variantId ?? ""}`;
      const current = quantities.get(key);
      if (current) current.quantity += item.quantity;
      else quantities.set(key, { productId: item.productId, variantId, quantity: item.quantity });
    }
    return [...quantities.values()].sort((a, b) => `${a.productId}:${a.variantId ?? ""}`.localeCompare(`${b.productId}:${b.variantId ?? ""}`));
  }

  async reserveStock(dto: CreatePosReservationDto, context: AuditContext) {
    if (!context.adminId) throw new BadRequestException("Admin session required to reserve POS stock");
    await this.releaseExpiredReservations();
    const items = this.normalizedReservationItems(dto.items);
    const fingerprint = createHash("sha256").update(JSON.stringify(items)).digest("hex");
    const previous = await this.prisma.posReservation.findUnique({ where: { requestId: dto.requestId }, include: { items: true } });
    if (previous) {
      if (previous.fingerprint !== fingerprint || previous.adminId !== context.adminId) {
        throw new ConflictException("This POS hold request was already used with different items");
      }
      if (previous.committedAt) throw new ConflictException("This POS stock hold has already been committed");
      if (previous.releasedAt || previous.expiresAt.getTime() <= Date.now()) {
        throw new ConflictException("This POS stock hold has expired. Start a new hold.");
      }
      return { reservationId: previous.id, expiresAt: previous.expiresAt };
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const reservation = await this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: productIds } }, include: catalogInclude });
      const productById = new Map(products.map((product) => [product.id, product]));
      const heldItems: Array<{ productId: string; variantId: string | null; stockModel: "Unique" | "Quantity"; quantity: number }> = [];

      for (const item of items) {
        const product = productById.get(item.productId);
        if (!product || product.isBulkMaterial || product.status !== "Published" || !product.sellInWorkshop) {
          throw new BadRequestException("One or more items are unavailable for Workshop POS");
        }
        const variant = item.variantId ? product.variants.find((entry) => entry.id === item.variantId) : null;
        if (item.variantId && !variant) throw new BadRequestException(`The selected variant of "${product.name}" was not found`);
        if (product.variants.length && !variant) throw new BadRequestException(`Choose a variant for "${product.name}"`);
        if (product.stockModel === "Unique" && !variant) {
          if (item.quantity !== 1) throw new BadRequestException(`"${product.name}" is a unique piece and can only be held once`);
          const changed = await tx.product.updateMany({
            where: { id: product.id, stockModel: "Unique", status: "Published", sellInWorkshop: true },
            data: { status: "Reserved" },
          });
          if (changed.count !== 1) throw new ConflictException(`"${product.name}" is no longer available`);
        } else if (variant) {
          const changed = await tx.productVariant.updateMany({
            where: { id: variant.id, product: { is: { status: "Published", sellInWorkshop: true } }, stockQuantity: { gte: item.quantity } },
            data: { stockQuantity: { decrement: item.quantity } },
          });
          if (changed.count !== 1) throw new ConflictException(`"${product.name}" no longer has enough shared stock`);
        } else {
          const changed = await tx.product.updateMany({
            where: { id: product.id, stockModel: "Quantity", status: "Published", sellInWorkshop: true, stockQuantity: { gte: item.quantity } },
            data: { stockQuantity: { decrement: item.quantity } },
          });
          if (changed.count !== 1) throw new ConflictException(`"${product.name}" no longer has enough shared stock`);
        }
        heldItems.push({ productId: product.id, variantId: item.variantId, stockModel: product.stockModel, quantity: item.quantity });
      }

      const created = await tx.posReservation.create({
        data: {
          requestId: dto.requestId,
          fingerprint,
          adminId: context.adminId!,
          expiresAt,
          items: { create: heldItems },
        },
        include: { items: true },
      });
      await this.etsy.enqueueProductsSync(productIds, tx);
      return created;
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "pos.stock.reserve",
      entityType: "PosReservation",
      entityId: reservation.id,
      summary: `Reserved ${items.length} POS stock line(s) for five minutes`,
      metadata: { items },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return { reservationId: reservation.id, expiresAt: reservation.expiresAt };
  }

  private async releaseReservationInternal(reservationId: string, adminId?: string, expiredOnly = false): Promise<boolean> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.posReservation.updateMany({
        where: {
          id: reservationId,
          committedAt: null,
          releasedAt: null,
          ...(adminId ? { adminId } : {}),
          ...(expiredOnly ? { expiresAt: { lte: now } } : {}),
        },
        data: { releasedAt: now },
      });
      if (claimed.count !== 1) return false;
      const items = await tx.posReservationItem.findMany({ where: { reservationId } });
      for (const item of items) {
        if (item.variantId) {
          await tx.productVariant.updateMany({ where: { id: item.variantId }, data: { stockQuantity: { increment: item.quantity } } });
        } else if (item.stockModel === "Quantity") {
          await tx.product.updateMany({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
        } else {
          await tx.product.updateMany({ where: { id: item.productId, status: "Reserved" }, data: { status: "Published" } });
        }
      }
      await this.etsy.enqueueProductsSync([...new Set(items.map((item) => item.productId))], tx);
      return true;
    });
  }

  async releaseExpiredReservations(): Promise<number> {
    const expired = await this.prisma.posReservation.findMany({
      where: { expiresAt: { lte: new Date() }, committedAt: null, releasedAt: null },
      select: { id: true },
      take: 100,
    });
    let released = 0;
    for (const reservation of expired) {
      if (await this.releaseReservationInternal(reservation.id, undefined, true)) released += 1;
    }
    return released;
  }

  async refreshReservation(reservationId: string, context: AuditContext) {
    if (!context.adminId) throw new BadRequestException("Admin session required");
    const reservation = await this.prisma.posReservation.findFirst({
      where: { id: reservationId, adminId: context.adminId, committedAt: null, releasedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!reservation) throw new NotFoundException("Active POS stock hold not found");
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const refreshed = await this.prisma.posReservation.updateMany({
      where: { id: reservationId, adminId: context.adminId, committedAt: null, releasedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt },
    });
    if (refreshed.count !== 1) throw new ConflictException("This POS stock hold expired. Start a new hold.");
    return { reservationId, expiresAt };
  }

  async releaseReservation(reservationId: string, context: AuditContext) {
    if (!context.adminId) throw new BadRequestException("Admin session required");
    const exists = await this.prisma.posReservation.findFirst({ where: { id: reservationId, adminId: context.adminId } });
    if (!exists) throw new NotFoundException("POS stock hold not found");
    const released = await this.releaseReservationInternal(reservationId, context.adminId);
    return { released };
  }

  private availableQuantity(product: CatalogProduct): number {
    if (product.variants.length) {
      return product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0);
    }
    if (product.stockModel === "Unique") {
      return product.status === "Published" ? 1 : 0;
    }
    return product.stockQuantity ?? 0;
  }

  async catalog(search: string) {
    const term = search.trim();
    const products = await this.prisma.product.findMany({
      where: {
        status: "Published",
        sellInWorkshop: true,
        ...(term ? { OR: [
          { name: { contains: term, mode: "insensitive" } },
          { sku: { contains: term, mode: "insensitive" } },
          { variants: { some: { OR: [
            { name: { contains: term, mode: "insensitive" } },
            { sku: { contains: term, mode: "insensitive" } },
          ] } } },
        ] } : {}),
      },
      include: catalogInclude,
      orderBy: [{ name: "asc" }, { sku: "asc" }],
      take: 100,
    });
    return products
      .filter((product) => this.availableQuantity(product) > 0)
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: Number(product.price),
        currency: product.currency,
        stockModel: product.stockModel,
        availableQuantity: this.availableQuantity(product),
        imageUrl: product.images[0]?.url ?? null,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          price: Number(variant.price),
          availableQuantity: variant.stockQuantity,
        })).filter((variant) => variant.availableQuantity > 0),
      }));
  }

  private idr(value: Prisma.Decimal | number, exchangeRate: number): Prisma.Decimal {
    return new Prisma.Decimal(value).mul(exchangeRate).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  }

  async createSale(dto: CreatePosSaleDto, context: AuditContext) {
    if (!dto.items?.length) throw new BadRequestException("Add at least one item to the sale");
    const requestedRate = Math.round(dto.exchangeRate * 10_000) / 10_000;
    const hasDiscount = dto.manualDiscountValue !== undefined && dto.manualDiscountValue > 0;
    if (hasDiscount && (!dto.manualDiscountType || !dto.discountReason?.trim())) {
      throw new BadRequestException("A discount type and reason are required");
    }
    if (!hasDiscount && (dto.manualDiscountType || dto.discountReason?.trim())) {
      throw new BadRequestException("Remove the discount reason and type when no discount is applied");
    }
    if (hasDiscount && dto.manualDiscountType === "Percentage" && dto.manualDiscountValue! > 100) {
      throw new BadRequestException("Percentage discount cannot exceed 100%");
    }
    if (hasDiscount && dto.manualDiscountType === "Fixed" && !Number.isInteger(dto.manualDiscountValue)) {
      throw new BadRequestException("Fixed IDR discounts must use whole rupiah amounts");
    }

    const quantities = new Map<string, { productId: string; variantId?: string; quantity: number; expectedUnitPriceIdr: number; unitPriceIdr?: number }>();
    for (const item of dto.items) {
      const key = `${item.productId}:${item.variantId ?? ""}`;
      const current = quantities.get(key);
      if (current) {
        if (current.expectedUnitPriceIdr !== item.expectedUnitPriceIdr || current.unitPriceIdr !== item.unitPriceIdr) {
          throw new BadRequestException("A cart item has conflicting price snapshots");
        }
        current.quantity += item.quantity;
      } else quantities.set(key, {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        expectedUnitPriceIdr: item.expectedUnitPriceIdr,
        ...(item.unitPriceIdr !== undefined ? { unitPriceIdr: item.unitPriceIdr } : {}),
      });
    }
    const normalizedItems = [...quantities.values()];
    const fingerprint = createHash("sha256").update(JSON.stringify({
      exchangeRate: requestedRate,
      customerId: dto.customerId ?? null,
      paymentMethod: dto.paymentMethod,
      paymentRef: dto.paymentRef?.trim() ?? "",
      manualDiscountType: dto.manualDiscountType ?? null,
      manualDiscountValue: hasDiscount ? dto.manualDiscountValue : null,
      discountReason: hasDiscount ? dto.discountReason!.trim() : null,
      items: normalizedItems,
    })).digest("hex");
    const checkoutKey = `pos:${dto.requestId}`;
    const previous = await this.prisma.order.findUnique({ where: { checkoutKey }, include: { items: true } });
    if (previous) {
      if (previous.checkoutFingerprint !== fingerprint) throw new ConflictException("This POS sale request was already used with different details");
      return this.receipt(previous);
    }

    const rate = await this.configuredRate();
    if (!rate) throw new BadRequestException("Set the POS USD-IDR exchange rate before recording a sale");
    if (Math.round(dto.exchangeRate * 10_000) !== Math.round(rate * 10_000)) {
      throw new ConflictException("The exchange rate changed. Refresh POS pricing and try again.");
    }

    const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const reservation = await tx.posReservation.findFirst({
          where: { id: dto.reservationId, adminId: context.adminId ?? "", committedAt: null, releasedAt: null, expiresAt: { gt: now } },
          include: { items: true },
        });
        if (!reservation) throw new ConflictException("POS stock hold expired or was released. Reserve the cart again before confirming payment.");
        const reservedByKey = new Map(reservation.items.map((item) => [`${item.productId}:${item.variantId ?? ""}`, item.quantity]));
        if (reservedByKey.size !== normalizedItems.length || normalizedItems.some((item) => reservedByKey.get(`${item.productId}:${item.variantId ?? ""}`) !== item.quantity)) {
          throw new ConflictException("The active POS stock hold does not match the current cart");
        }
        const customer = dto.customerId
          ? await tx.customer.findUnique({ where: { id: dto.customerId } })
          : null;
        if (dto.customerId && !customer) throw new NotFoundException("Customer not found");
        const products = await tx.product.findMany({ where: { id: { in: productIds } }, include: catalogInclude });
        const productById = new Map(products.map((product) => [product.id, product]));
        const itemSnapshots: Array<{
          product: CatalogProduct;
          variantId?: string;
          quantity: number;
          weightGram: number;
          unitPrice: Prisma.Decimal;
          lineTotal: Prisma.Decimal;
          name: string;
          sku: string;
          imageUrl: string | null;
          workshopAllocatedQuantity: number;
        }> = [];
        let subtotal = new Prisma.Decimal(0);

        for (const requested of normalizedItems) {
          const product = productById.get(requested.productId);
          if (!product || product.isBulkMaterial || !product.sellInWorkshop) {
            throw new BadRequestException("One or more items are unavailable for Workshop POS");
          }
          const variant = requested.variantId ? product.variants.find((entry) => entry.id === requested.variantId) : null;
          if (requested.variantId && !variant) throw new BadRequestException(`The selected variant of "${product.name}" was not found`);
          if (product.variants.length && !variant) throw new BadRequestException(`Choose a variant for "${product.name}"`);
          const uniqueHold = product.stockModel === "Unique" && !variant && product.status === "Reserved" && reservedByKey.has(`${product.id}:`);
          if (product.status !== "Published" && !uniqueHold) throw new BadRequestException(`"${product.name}" is no longer available for Workshop POS`);
          if (product.stockModel === "Unique" && requested.quantity > 1 && !variant) {
            throw new BadRequestException(`"${product.name}" is a unique piece and can only be sold once`);
          }
          const baseUnitPrice = this.idr(variant?.price ?? product.price, rate);
          if (baseUnitPrice.toNumber() !== requested.expectedUnitPriceIdr) {
            throw new ConflictException(`The price for "${product.name}" changed. Refresh the cart and confirm again.`);
          }
          const unitPrice = requested.unitPriceIdr === undefined
            ? baseUnitPrice
            : new Prisma.Decimal(requested.unitPriceIdr).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
          const lineTotal = unitPrice.mul(requested.quantity);
          if (uniqueHold) {
            const sold = await tx.product.updateMany({
              where: { id: product.id, status: "Reserved", stockModel: "Unique", sellInWorkshop: true },
              data: { status: "Sold" },
            });
            if (sold.count !== 1) throw new ConflictException(`"${product.name}" is no longer available`);
          }
          subtotal = subtotal.add(lineTotal);
          itemSnapshots.push({
            product,
            variantId: requested.variantId,
            quantity: requested.quantity,
            weightGram: variant?.weightGram ?? product.weightGram,
            unitPrice,
            lineTotal,
            name: variant ? `${product.name} — ${variant.name}` : product.name,
            sku: variant?.sku ?? product.sku,
            imageUrl: product.images[0]?.url ?? null,
            workshopAllocatedQuantity: 0,
          });
        }

        const committed = await tx.posReservation.updateMany({
          where: { id: reservation.id, adminId: context.adminId ?? "", committedAt: null, releasedAt: null, expiresAt: { gt: now } },
          data: { committedAt: now },
        });
        if (committed.count !== 1) throw new ConflictException("POS stock hold expired before payment confirmation");

        const rawDiscount = !hasDiscount ? new Prisma.Decimal(0) : dto.manualDiscountType === "Percentage"
          ? subtotal.mul(dto.manualDiscountValue!).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
          : new Prisma.Decimal(dto.manualDiscountValue!).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
        const discountTotal = rawDiscount.greaterThan(subtotal) ? subtotal : rawDiscount;
        const total = subtotal.sub(discountTotal);
        const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        const sequence = await tx.sequence.upsert({
          where: { key: `order:${dateKey}` },
          create: { key: `order:${dateKey}`, value: 1 },
          update: { value: { increment: 1 } },
        });
        const orderNumber = `RV-${dateKey}-${String(sequence.value).padStart(4, "0")}`;
        const order = await tx.order.create({
          data: {
            orderNumber,
            checkoutKey,
            checkoutFingerprint: fingerprint,
            customerId: customer?.id ?? null,
            email: customer?.email ?? null,
            customerName: customer?.name ?? "Walk-in customer",
            phone: customer?.phone ?? null,
            status: "Completed",
            paymentStatus: "Paid",
            paymentMethod: dto.paymentMethod,
            paymentRef: dto.paymentRef?.trim() || null,
            source: "POS",
            fulfillmentMethod: "WorkshopPickup",
            currency: "IDR",
            exchangeRate: new Prisma.Decimal(rate),
            subtotal,
            shippingCost: 0,
            discountTotal,
            manualDiscountType: hasDiscount ? dto.manualDiscountType : null,
            manualDiscountValue: hasDiscount ? new Prisma.Decimal(dto.manualDiscountValue!) : null,
            discountReason: hasDiscount ? dto.discountReason!.trim() : null,
            taxTotal: 0,
            total,
            placedAt: now,
            paidAt: now,
            completedAt: now,
            totalWeightGram: itemSnapshots.reduce((sum, item) => sum + item.weightGram * item.quantity, 0),
            items: {
              create: itemSnapshots.map((item) => ({
                productId: item.product.id,
                variantId: item.variantId ?? null,
                name: item.name,
                sku: item.sku,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                weightGram: item.weightGram,
                lineTotal: item.lineTotal,
                imageUrl: item.imageUrl,
                workshopAllocatedQuantity: item.workshopAllocatedQuantity,
              })),
            },
            events: {
              create: [
                { adminId: context.adminId ?? null, type: "payment", message: `POS payment confirmed by ${dto.paymentMethod}${dto.paymentRef?.trim() ? ` (${dto.paymentRef.trim()})` : ""}` },
                { adminId: context.adminId ?? null, type: "note", message: "Workshop POS sale completed; goods handed over in person." },
              ],
            },
          },
          include: { items: true },
        });
        await tx.notification.create({
          data: {
            type: "Order",
            title: `Workshop POS sale ${order.orderNumber}`,
            body: `${order.currency} ${Number(order.total).toLocaleString("id-ID")} · ${order.customerName}`,
            href: `/admin/orders/${order.id}`,
            entityType: "Order",
            entityId: order.id,
          },
        });
        await this.etsy.enqueueProductsSync(productIds, tx);
        return order;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      await this.audit.log({
        adminId: context.adminId,
        action: "pos.sale.create",
        entityType: "Order",
        entityId: created.id,
        summary: `Recorded workshop POS sale ${created.orderNumber}`,
        metadata: {
          paymentMethod: dto.paymentMethod,
          currency: "IDR",
          total: Number(created.total),
          exchangeRate: rate,
          itemCount: created.items.length,
          priceAdjustments: normalizedItems.filter((item) => item.unitPriceIdr !== undefined).map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? null,
            quantity: item.quantity,
            catalogUnitPriceIdr: item.expectedUnitPriceIdr,
            saleUnitPriceIdr: item.unitPriceIdr,
          })),
        },
        ip: context.ip,
        userAgent: context.userAgent,
      });
      return this.receipt(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002")) {
        const replay = await this.prisma.order.findUnique({ where: { checkoutKey }, include: { items: true } });
        if (replay?.checkoutFingerprint === fingerprint) {
          return this.receipt(replay);
        }
        throw new ConflictException("Stock or sale state changed while completing the transaction. Refresh the cart and try again.");
      }
      throw error;
    }
  }

  private receipt(order: {
    id: string;
    orderNumber: string;
    currency: string;
    total: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    discountTotal: Prisma.Decimal;
    exchangeRate: Prisma.Decimal | null;
    customerName: string;
    paymentMethod: string;
    paymentRef: string | null;
    discountReason: string | null;
    paidAt: Date | null;
    items: Array<{ name: string; sku: string; quantity: number; unitPrice: Prisma.Decimal; lineTotal: Prisma.Decimal }>;
  }) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      currency: order.currency,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      discountTotal: Number(order.discountTotal),
      exchangeRate: order.exchangeRate === null ? null : Number(order.exchangeRate),
      customerName: order.customerName,
      paymentMethod: order.paymentMethod,
      paymentRef: order.paymentRef,
      discountReason: order.discountReason,
      paidAt: order.paidAt,
      items: order.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
    };
  }
}
