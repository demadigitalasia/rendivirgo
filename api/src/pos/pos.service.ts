import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePosSaleDto, PosSettingsDto } from "./dto/pos.dto";

const EXCHANGE_RATE_KEY = "pos.usdIdrRate";
const catalogInclude = {
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
  variants: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.ProductInclude;

type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof catalogInclude }>;

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  private availableQuantity(product: CatalogProduct): number {
    if (product.variants.length) {
      return product.variants.reduce((sum, variant) => sum + variant.stockQuantity + variant.workshopStockQuantity, 0);
    }
    if (product.stockModel === "Unique") {
      return product.status === "Published" ? Math.max(1, product.workshopStockQuantity) : 0;
    }
    return (product.stockQuantity ?? 0) + product.workshopStockQuantity;
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
          availableQuantity: variant.stockQuantity + variant.workshopStockQuantity,
        })).filter((variant) => variant.availableQuantity > 0),
      }));
  }

  private idr(value: Prisma.Decimal | number, exchangeRate: number): Prisma.Decimal {
    return new Prisma.Decimal(value).mul(exchangeRate).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  }

  private async consumeStock(
    tx: Prisma.TransactionClient,
    product: CatalogProduct,
    variantId: string | undefined,
    quantity: number,
  ): Promise<number> {
    if (product.stockModel === "Unique" && !variantId) {
      const updated = await tx.product.updateMany({
        where: {
          id: product.id,
          status: "Published",
          sellInWorkshop: true,
          workshopStockQuantity: product.workshopStockQuantity > 0 ? { gte: 1 } : 0,
        },
        data: {
          status: "Sold",
          ...(product.workshopStockQuantity > 0 ? { workshopStockQuantity: { decrement: 1 } } : {}),
        },
      });
      if (updated.count !== 1) throw new ConflictException(`"${product.name}" is no longer available`);
      return product.workshopStockQuantity > 0 ? 1 : 0;
    }

    const variant = variantId ? product.variants.find((entry) => entry.id === variantId) : null;
    if (variantId && !variant) throw new BadRequestException(`The selected variant of "${product.name}" was not found`);
    const workshopAvailable = variant ? variant.workshopStockQuantity : product.workshopStockQuantity;
    const sharedAvailable = variant ? variant.stockQuantity : (product.stockQuantity ?? 0);
    const fromWorkshop = Math.min(workshopAvailable, quantity);
    const fromShared = quantity - fromWorkshop;
    if (fromWorkshop > 0) {
      const changed = variant
        ? await tx.productVariant.updateMany({
            where: {
              id: variant.id,
              product: { is: { status: "Published", sellInWorkshop: true } },
              workshopStockQuantity: { gte: fromWorkshop },
            },
            data: { workshopStockQuantity: { decrement: fromWorkshop } },
          })
        : await tx.product.updateMany({
            where: {
              id: product.id,
              status: "Published",
              sellInWorkshop: true,
              workshopStockQuantity: { gte: fromWorkshop },
            },
            data: { workshopStockQuantity: { decrement: fromWorkshop } },
          });
      if (changed.count !== 1) throw new ConflictException(`Workshop allocation for "${product.name}" changed; refresh the cart`);
    }
    if (fromShared > 0) {
      if (sharedAvailable < fromShared) throw new ConflictException(`"${product.name}" no longer has enough shared stock`);
      const changed = variant
        ? await tx.productVariant.updateMany({
            where: {
              id: variant.id,
              product: { is: { status: "Published", sellInWorkshop: true } },
              stockQuantity: { gte: fromShared },
            },
            data: { stockQuantity: { decrement: fromShared } },
          })
        : await tx.product.updateMany({
            where: {
              id: product.id,
              stockModel: "Quantity",
              status: "Published",
              sellInWorkshop: true,
              stockQuantity: { gte: fromShared },
            },
            data: { stockQuantity: { decrement: fromShared } },
          });
      if (changed.count !== 1) throw new ConflictException(`"${product.name}" no longer has enough shared stock`);
    }
    return fromWorkshop;
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
          if (!product || product.status !== "Published" || !product.sellInWorkshop) {
            throw new BadRequestException("One or more items are unavailable for Workshop POS");
          }
          const variant = requested.variantId ? product.variants.find((entry) => entry.id === requested.variantId) : null;
          if (requested.variantId && !variant) throw new BadRequestException(`The selected variant of "${product.name}" was not found`);
          if (product.variants.length && !variant) throw new BadRequestException(`Choose a variant for "${product.name}"`);
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
          const allocated = await this.consumeStock(tx, product, requested.variantId, requested.quantity);
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
            workshopAllocatedQuantity: allocated,
          });
        }

        const rawDiscount = !hasDiscount ? new Prisma.Decimal(0) : dto.manualDiscountType === "Percentage"
          ? subtotal.mul(dto.manualDiscountValue!).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
          : new Prisma.Decimal(dto.manualDiscountValue!).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
        const discountTotal = rawDiscount.greaterThan(subtotal) ? subtotal : rawDiscount;
        const total = subtotal.sub(discountTotal);
        const now = new Date();
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
