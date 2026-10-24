import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { wholesalePriceQuery } from "./wholesale-catalog-price";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type OrderStatus } from "../../generated/prisma";
import type { Customer, OrderItem } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import { paginated, skipTake } from "../common/dto/pagination.dto";
import type { AuditContext } from "../common/types/audit-context";
import { signMagicToken, verifyMagicToken } from "../common/utils/magic-token";
import { EmailService } from "../email/email.service";
import {
  renderOrdersLinkEmail,
} from "../email/email.templates";
import { PrismaService } from "../prisma/prisma.service";
import { paypalCredentialsConfigured } from "../payments/paypal.service";
import { SettingsService } from "../settings/settings.service";
import { ShippingService } from "../settings/shipping.service";
import { OrderLifecycleService, type PreparedOrder } from "./order-lifecycle.service";
import { orderInclude, orderListInclude, type OrderListRow, type OrderScalars, type OrderWithRelations } from "./orders.types";
import {
  CreateOrderDto,
  CreateOrderEventDto,
  OrderQueryDto,
  RefundOrderDto,
  UpdateOrderDto,
} from "./dto/order.dto";
import { WholesaleCatalogQueryDto } from "./dto/wholesale-catalog-query.dto";

const checkoutProductInclude = {
  variants: true,
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
  category: { select: { slug: true, name: true } },
} satisfies Prisma.ProductInclude;

export { orderInclude, orderListInclude };
export { canTransitionOrderStatus } from "./order-lifecycle.service";
type CheckoutProduct = Prisma.ProductGetPayload<{ include: typeof checkoutProductInclude }>;

type CheckoutLine = {
  product: CheckoutProduct;
  variant: CheckoutProduct["variants"][number] | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
  weightGram: number;
  sku: string;
  name: string;
  imageUrl: string | null;
  fragile: boolean;
  oversized: boolean;
};

type ResolvedShipping = {
  name: string;
  carrier: string | null;
  shippingCost: Prisma.Decimal;
};

type ResolvedDiscount = {
  discount: Prisma.DiscountGetPayload<Record<never, never>>;
  discountTotal: Prisma.Decimal;
  shippingCost: Prisma.Decimal;
};

const SELLER_FALLBACK = {
  name: "RENDI VIRGO",
  address: "",
  email: "hello@rendivirgo.com",
  phone: "",
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly magicSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipping: ShippingService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly lifecycle: OrderLifecycleService,
  ) {
    this.magicSecret =
      this.config.get<string>("SESSION_SECRET") ??
      this.config.get<string>("ADMIN_PASSWORD") ??
      "rv-insecure-development-secret";
  }

  // ------------------------------------------------------------ mapping

  private orderBase(order: OrderScalars) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      email: order.email,
      customerName: order.customerName,
      phone: order.phone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      source: order.source,
      fulfillmentMethod: order.fulfillmentMethod,
      exchangeRate: order.exchangeRate,
      manualDiscountType: order.manualDiscountType,
      manualDiscountValue: order.manualDiscountValue,
      discountReason: order.discountReason,
      paymentRef: order.paymentRef,
      paymentProofUploadedAt: order.paymentProofUploadedAt,
      currency: order.currency,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      discountTotal: order.discountTotal,
      taxTotal: order.taxTotal,
      total: order.total,
      refundedAmount: order.refundedAmount,
      discountId: order.discountId,
      discountCode: order.discountCode,
      shippingName: order.shippingName,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      totalWeightGram: order.totalWeightGram,
      shippingAddress: {
        line1: order.shippingLine1,
        line2: order.shippingLine2,
        city: order.shippingCity,
        state: order.shippingState,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry,
        countryCode: order.shippingCountryCode,
      },
      customerNote: order.customerNote,
      internalNote: order.internalNote,
      placedAt: order.placedAt,
      paidAt: order.paidAt,
      packedAt: order.packedAt,
      shippedAt: order.shippedAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toApiCustomerRef(customer: Customer) {
    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      tags: customer.tags,
      acceptsMarketing: customer.acceptsMarketing,
    };
  }

  private toApiOrderItem(item: OrderItem) {
    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      sku: item.sku,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      weightGram: item.weightGram,
      lineTotal: item.lineTotal,
      imageUrl: item.imageUrl,
      workshopAllocatedQuantity: item.workshopAllocatedQuantity,
    };
  }

  private toApiEvent(event: { id: string; type: string; message: string; adminId: string | null; createdAt: Date }) {
    return { id: event.id, type: event.type, message: event.message, adminId: event.adminId, createdAt: event.createdAt };
  }

  toApiOrder(order: OrderWithRelations) {
    return {
      ...this.orderBase(order),
      discount: order.discount
        ? {
            id: order.discount.id,
            code: order.discount.code,
            type: order.discount.type,
            value: order.discount.value,
          }
        : null,
      customer: order.customer ? this.toApiCustomerRef(order.customer) : null,
      items: order.items.map((item) => this.toApiOrderItem(item)),
      events: order.events.map((event) => this.toApiEvent(event)),
      returnRequests: order.returnRequests.map((request) => ({
        id: request.id,
        status: request.status,
        reason: request.reason,
        details: request.details,
        hasEvidence: Boolean(request.evidencePath),
        submittedAt: request.submittedAt,
        reviewedAt: request.reviewedAt,
        adminResponse: request.adminResponse,
        reviewedBy: request.reviewedBy,
      })),
    };
  }

  private toApiOrderSummary(order: OrderListRow) {
    return {
      ...this.orderBase(order),
      customer: order.customer ? this.toApiCustomerRef(order.customer) : null,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      items: order.items.map((item) => this.toApiOrderItem(item)),
    };
  }

  // ------------------------------------------------------------ helpers

  private parseDate(value: string, endOfDay = false): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid date "${value}"`);
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date;
  }

  private async resolveShipping(
    shippingRateId: string | undefined,
    subtotal: Prisma.Decimal,
    totalWeightGram: number,
    countryCode: string | undefined,
    fragile: boolean,
    oversized: boolean,
  ): Promise<ResolvedShipping> {
    return this.shipping.resolveOrderShipping({
      shippingRateId,
      subtotal,
      weightGram: totalWeightGram,
      countryCode,
      fragile,
      oversized,
    });
  }

  private async resolveDiscount(
    code: string | undefined,
    lines: CheckoutLine[],
    subtotal: Prisma.Decimal,
    shippingCost: Prisma.Decimal,
    email: string,
  ): Promise<ResolvedDiscount | null> {
    const normalized = code?.trim();
    if (!normalized) return null;

    const discount = await this.prisma.discount.findFirst({
      where: { code: { equals: normalized, mode: "insensitive" } },
    });
    if (!discount) throw new BadRequestException("Discount code is not valid");
    if (!discount.isActive) throw new BadRequestException("Discount code is no longer active");

    const now = new Date();
    if (discount.startsAt && discount.startsAt > now) throw new BadRequestException("Discount code is not active yet");
    if (discount.endsAt && discount.endsAt < now) throw new BadRequestException("Discount code has expired");
    if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
      throw new BadRequestException("Discount code has reached its usage limit");
    }

    // Category-scoped discounts only apply to eligible line items, and the
    // minimum subtotal is checked against that eligible base — matching the
    // public validation endpoint so the cart total and the order agree.
    let base = subtotal;
    if (discount.categoryId) {
      base = lines
        .filter((line) => line.product.categoryId === discount.categoryId)
        .reduce((sum, line) => sum.plus(line.unitPrice.mul(line.quantity)), new Prisma.Decimal(0))
        .toDecimalPlaces(2);
      if (base.lessThanOrEqualTo(0)) {
        throw new BadRequestException("This discount does not apply to any item in your cart");
      }
    }

    if (base.lessThan(discount.minSubtotal)) {
      throw new BadRequestException(`A minimum subtotal of ${discount.minSubtotal.toFixed(2)} is required for this discount`);
    }

    if (discount.perCustomerLimit !== null) {
      const previousUses = await this.prisma.order.count({
        where: {
          email,
          discountId: discount.id,
          paymentStatus: { not: "Failed" },
          status: { not: "Cancelled" },
        },
      });
      if (previousUses >= discount.perCustomerLimit) {
        throw new BadRequestException("This discount code has already been used the maximum number of times for this customer");
      }
    }

    let discountTotal = new Prisma.Decimal(0);
    let nextShippingCost = shippingCost;

    switch (discount.type) {
      case "Percentage":
        discountTotal = base.mul(discount.value).div(100).toDecimalPlaces(2);
        break;
      case "Fixed":
        discountTotal = discount.value;
        break;
      case "FreeShipping":
        nextShippingCost = new Prisma.Decimal(0);
        break;
    }

    if (discountTotal.greaterThan(base)) discountTotal = base;

    return { discount, discountTotal, shippingCost: nextShippingCost };
  }

  // ------------------------------------------------------------ checkout

  async quote(dto: CreateOrderDto, customerId?: string) {
    return this.create(dto, true, customerId ? { source: "Online", customerId } : undefined);
  }

  private async requireWholesaleCustomer(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || !customer.emailVerifiedAt || !customer.wholesaleAccess) {
      throw new BadRequestException("Wholesale access is not enabled for this account");
    }
    return customer;
  }

  async wholesaleMinimums() {
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { in: ["wholesale.minimumSubtotalUsd", "wholesale.minimumPieces"] } },
      select: { key: true, value: true },
    });
    const values = new Map(rows.map((row) => [row.key, row.value]));
    const subtotal = Number(values.get("wholesale.minimumSubtotalUsd") ?? 300);
    const pieces = Number(values.get("wholesale.minimumPieces") ?? 100);
    return {
      minimumSubtotalUsd: Number.isFinite(subtotal) && subtotal >= 0 ? subtotal : 300,
      minimumPieces: Number.isInteger(pieces) && pieces >= 0 ? pieces : 100,
    };
  }

  async updateWholesaleMinimums(input: { minimumSubtotalUsd: number; minimumPieces: number }, context: AuditContext) {
    if (input.minimumSubtotalUsd < 0 || !Number.isFinite(input.minimumSubtotalUsd) || !Number.isInteger(input.minimumPieces) || input.minimumPieces < 0) {
      throw new BadRequestException("Wholesale minimums must be non-negative amounts and whole-piece counts");
    }
    await this.prisma.$transaction([
      this.prisma.siteSetting.upsert({
        where: { key: "wholesale.minimumSubtotalUsd" },
        create: { key: "wholesale.minimumSubtotalUsd", value: input.minimumSubtotalUsd },
        update: { value: input.minimumSubtotalUsd },
      }),
      this.prisma.siteSetting.upsert({
        where: { key: "wholesale.minimumPieces" },
        create: { key: "wholesale.minimumPieces", value: input.minimumPieces },
        update: { value: input.minimumPieces },
      }),
    ]);
    await this.audit.log({
      adminId: context.adminId,
      action: "wholesale.minimums.update",
      entityType: "SiteSetting",
      summary: `Updated Wholesale minimums to USD ${input.minimumSubtotalUsd} and ${input.minimumPieces} pieces`,
      metadata: input,
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return this.wholesaleMinimums();
  }

  async wholesaleCatalog(customerId: string, query: WholesaleCatalogQueryDto) {
    await this.requireWholesaleCustomer(customerId);
    const stockModelEligibility: Prisma.ProductWhereInput = {
      OR: [
        { stockModel: "Quantity" },
        { stockModel: "Unique", variants: { none: {} } },
      ],
    };
    const baseWhere: Prisma.ProductWhereInput = {
      status: "Published",
      sellInWholesale: true,
      isBulkMaterial: false,
      AND: [stockModelEligibility],
    };
    const constraints: Prisma.ProductWhereInput[] = [];
    const search = query.search?.trim().slice(0, 100);

    if (query.category) constraints.push({ category: { is: { slug: query.category } } });
    if (query.stoneType) constraints.push({ stoneType: { equals: query.stoneType, mode: "insensitive" } });
    if (query.origin) constraints.push({ origin: { equals: query.origin, mode: "insensitive" } });
    if (search) {
      constraints.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
          { stoneType: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { category: { is: { name: { contains: search, mode: "insensitive" } } } },
        ],
      });
    }

    const inStock: Prisma.ProductWhereInput = {
      OR: [
        { stockModel: "Unique", variants: { none: {} } },
        { stockModel: "Quantity", stockQuantity: { gt: 0 }, variants: { none: {} } },
        { variants: { some: { stockQuantity: { gt: 0 } } } },
      ],
    };
    if (query.availability === "in-stock") constraints.push(inStock);
    if (query.availability === "out-of-stock") constraints.push({ NOT: inStock });

    const where: Prisma.ProductWhereInput = {
      ...baseWhere,
      AND: [stockModelEligibility, ...constraints],
    };
    const wholesaleSort: Record<WholesaleCatalogQueryDto["sort"], Prisma.ProductOrderByWithRelationInput[]> = {
      featured: [{ featured: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      newest: [{ createdAt: "desc" }, { id: "asc" }],
      "name-asc": [{ name: "asc" }, { id: "asc" }],
      "name-desc": [{ name: "desc" }, { id: "asc" }],
      "price-asc": [{ wholesalePrice: { sort: "asc", nulls: "last" } }, { name: "asc" }, { id: "asc" }],
      "price-desc": [{ wholesalePrice: { sort: "desc", nulls: "last" } }, { name: "asc" }, { id: "asc" }],
    };
    const orderBy = wholesaleSort[query.sort];

    const useEffectivePrice = query.sort.startsWith("price-") || query.minPrice !== undefined || query.maxPrice !== undefined;
    const priceQuery = wholesalePriceQuery(query);
    const [countResult, categories, stoneTypes, origins] = await this.prisma.$transaction([
      useEffectivePrice
        ? this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM (${priceQuery.rows}) matches`)
        : this.prisma.product.count({ where }),
      this.prisma.category.findMany({
        where: { isActive: true, products: { some: baseWhere } },
        select: {
          slug: true,
          name: true,
          _count: { select: { products: { where: baseWhere } } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.prisma.product.groupBy({ by: ["stoneType"], where: baseWhere, orderBy: { stoneType: "asc" } }),
      this.prisma.product.groupBy({ by: ["origin"], where: baseWhere, orderBy: { origin: "asc" } }),
    ]);

    const total = typeof countResult === "number" ? countResult : Number(countResult[0]?.total ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, pageCount);
    const ranked = useEffectivePrice ? await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`${priceQuery.rows} ORDER BY ${priceQuery.ordering} OFFSET ${(page - 1) * query.pageSize} LIMIT ${query.pageSize}`) : null;
    const pageProducts = await this.prisma.product.findMany({
      where: ranked ? { ...where, id: { in: ranked.map((row) => row.id) } } : where,
      include: checkoutProductInclude,
      orderBy,
      ...(ranked ? {} : { skip: (page - 1) * query.pageSize, take: query.pageSize }),
    });
    const products = ranked ? ranked.flatMap(({ id }) => { const product = pageProducts.find((entry) => entry.id === id); return product ? [product] : []; }) : pageProducts;
    return {
      items: products.map((product) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        sku: product.sku,
        categorySlug: product.category.slug,
        categoryName: product.category.name,
        stoneType: product.stoneType,
        origin: product.origin,
        condition: product.condition,
        tone: product.tone,
        description: product.description,
        unit: product.unit,
        stockModel: product.stockModel,
        weightGram: product.weightGram,
        shippingClass: product.shippingClass,
        fragile: product.fragile,
        availableQuantity: product.variants.length
          ? product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0)
          : product.stockModel === "Unique" ? 1 : product.stockQuantity ?? 0,
        imageUrl: product.images[0]?.url ?? null,
        wholesalePrice: product.wholesalePrice === null ? null : Number(product.wholesalePrice),
        wholesaleFromPrice: product.variants.length
          ? product.variants.reduce<number | null>((minimum, variant) => {
            const price = variant.wholesalePrice ?? product.wholesalePrice;
            return price === null ? minimum : minimum === null ? Number(price) : Math.min(minimum, Number(price));
          }, null)
          : product.wholesalePrice === null ? null : Number(product.wholesalePrice),
        wholesalePiecesPerUnit: product.wholesalePiecesPerUnit,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          availableQuantity: variant.stockQuantity,
          weightGram: variant.weightGram,
          wholesalePrice: variant.wholesalePrice === null ? (product.wholesalePrice === null ? null : Number(product.wholesalePrice)) : Number(variant.wholesalePrice),
          wholesalePiecesPerUnit: variant.wholesalePiecesPerUnit ?? product.wholesalePiecesPerUnit ?? (product.unit === "piece" ? 1 : null),
        })),
      })),
      categories: categories.map((category) => ({ slug: category.slug, name: category.name, count: category._count.products })),
      stoneTypes: stoneTypes.map((entry) => entry.stoneType),
      origins: origins.map((entry) => entry.origin),
      total,
      page,
      pageSize: query.pageSize,
      pageCount,
    };
  }

  async quoteWholesale(dto: CreateOrderDto, customerId: string) {
    const customer = await this.requireWholesaleCustomer(customerId);
    return this.create({ ...dto, email: customer.email }, true, { source: "Wholesale", customerId });
  }

  async createWholesale(dto: CreateOrderDto, customerId: string) {
    const customer = await this.requireWholesaleCustomer(customerId);
    return this.create({ ...dto, email: customer.email }, false, { source: "Wholesale", customerId });
  }

  async create(dto: CreateOrderDto, quoteOnly = false, channel?: { source: "Online" | "Wholesale"; customerId: string }) {
    const email = dto.email.trim().toLowerCase();
    const source = channel?.source ?? "Online";
    const paymentMethod = dto.paymentMethod ?? "PayPal";
    if (channel?.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: channel.customerId },
        select: { email: true, emailVerifiedAt: true },
      });
      if (!customer?.emailVerifiedAt || customer.email !== email) {
        throw new BadRequestException("The signed-in customer account does not match this checkout email");
      }
    }
    if (source === "Wholesale" && dto.discountCode?.trim()) {
      throw new BadRequestException("Online discount codes cannot be used on Wholesale orders");
    }
    const requestFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
              checkoutKey: dto.checkoutKey ?? null,
          source,
          customerId: channel?.customerId ?? null,
              email,
              customerName: dto.customerName.trim(),
              phone: dto.phone?.trim() || null,
              shippingAddress: {
                line1: dto.shippingAddress.line1.trim(),
                line2: dto.shippingAddress.line2?.trim() || null,
                city: dto.shippingAddress.city.trim(),
                state: dto.shippingAddress.state?.trim() || null,
                postalCode: dto.shippingAddress.postalCode?.trim() || null,
                country: dto.shippingAddress.country.trim(),
                countryCode: dto.shippingAddress.countryCode?.trim().toUpperCase() || null,
              },
              customerNote: dto.customerNote?.trim() || null,
              shippingRateId: dto.shippingRateId ?? null,
              discountCode: dto.discountCode?.trim().toUpperCase() || null,
              paymentMethod,
              items: dto.items.map(({ productId, variantId, quantity }) => ({ productId, variantId: variantId ?? null, quantity })),
        }),
      )
      .digest("hex");
    const checkoutFingerprint = dto.checkoutKey ? requestFingerprint : null;

    if (!quoteOnly && dto.checkoutKey && checkoutFingerprint) {
      const previous = await this.prisma.order.findUnique({ where: { checkoutKey: dto.checkoutKey }, include: orderInclude });
      if (previous) {
        if (previous.checkoutFingerprint !== checkoutFingerprint) {
          throw new ConflictException("This checkout was already submitted with different details. Reload to recover the earlier order.");
        }
        return this.toApiOrder(previous);
      }
    }

    const paymentSettings = await this.settings.getPaymentSettings();
    if (paymentMethod === "BankTransfer") {
      if (!paymentSettings.bankTransferEnabled) throw new BadRequestException("Bank transfer is currently unavailable");
      if (!paymentSettings.bankName || !paymentSettings.bankAccountNumber || !paymentSettings.bankSwiftCode) {
        throw new BadRequestException("Bank transfer details are incomplete");
      }
      if (paymentSettings.currency.trim().toUpperCase() !== "USD") {
        throw new BadRequestException("Bank transfer checkout is currently available in USD only");
      }
    } else {
      if (!paymentSettings.paypalEnabled) throw new ServiceUnavailableException("PayPal is currently unavailable");
      const hasPaypalCredentials = paypalCredentialsConfigured(
        this.config.get<string>("PAYPAL_CLIENT_ID"),
        this.config.get<string>("PAYPAL_CLIENT_SECRET"),
      );
      if (!hasPaypalCredentials) throw new ServiceUnavailableException("PayPal is not configured on the server");
    }

    const productIds = [...new Set(dto.items.map((item) => item.productId))];

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: checkoutProductInclude,
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    const lines: CheckoutLine[] = [];
    for (const item of dto.items) {
      const product = productById.get(item.productId);
      if (!product) throw new BadRequestException(`Product "${item.productId}" was not found`);
      if (product.isBulkMaterial || product.status !== "Published" || (source === "Wholesale" ? !product.sellInWholesale : !product.sellOnWeb)) {
        throw new BadRequestException(`"${product.name}" is not available`);
      }

      if (product.variants.length > 0 && !item.variantId) {
        throw new BadRequestException(`Select a variant of "${product.name}" before ordering`);
      }
      const variant = item.variantId ? (product.variants.find((entry) => entry.id === item.variantId) ?? null) : null;
      if (item.variantId && !variant) throw new BadRequestException(`The selected variant of "${product.name}" was not found`);
      if (product.stockModel === "Unique" && product.variants.length > 0) {
        throw new BadRequestException(`Unique-piece product "${product.name}" cannot have variants. Please contact the store.`);
      }

      const shippingClass = variant?.shippingClass ?? product.shippingClass;
      const wholesalePrice = variant?.wholesalePrice ?? product.wholesalePrice;
      if (source === "Wholesale" && wholesalePrice === null) {
        throw new BadRequestException(`A Wholesale price is not configured for "${product.name}"`);
      }

      lines.push({
        product,
        variant,
        quantity: item.quantity,
        unitPrice: source === "Wholesale" ? wholesalePrice! : variant ? variant.price : product.price,
        weightGram: variant ? variant.weightGram : product.weightGram,
        sku: variant ? variant.sku : product.sku,
        name: variant ? `${product.name} — ${variant.name}` : product.name,
        imageUrl: product.images[0]?.url ?? null,
        fragile: product.fragile,
        oversized: shippingClass === "Oversized",
      });
    }

    const currencies = new Set(lines.map((line) => line.product.currency.trim().toUpperCase()));
    if (currencies.size !== 1 || !currencies.has("USD")) {
      throw new BadRequestException("Checkout currently supports USD products only. Please contact the store for help.");
    }

    const quantityByProduct = new Map<string, number>();
    for (const line of lines) {
      quantityByProduct.set(line.product.id, (quantityByProduct.get(line.product.id) ?? 0) + line.quantity);
    }
    for (const [productId, quantity] of quantityByProduct) {
      const product = productById.get(productId);
      if (product && product.stockModel === "Unique" && quantity > 1) {
        throw new BadRequestException(`"${product.name}" is a unique piece and can only be ordered once`);
      }
    }

    const quantityByStockKey = new Map<string, { line: CheckoutLine; quantity: number }>();
    for (const line of lines) {
      if (line.product.stockModel !== "Quantity") continue;
      const key = `${line.product.id}:${line.variant?.id ?? ""}`;
      const entry = quantityByStockKey.get(key);
      if (entry) entry.quantity += line.quantity;
      else quantityByStockKey.set(key, { line, quantity: line.quantity });
    }
    for (const { line, quantity } of quantityByStockKey.values()) {
      const available = line.variant ? line.variant.stockQuantity : (line.product.stockQuantity ?? 0);
      if (available < quantity) throw new BadRequestException(`"${line.product.name}" does not have enough stock`);
    }

    let subtotal = new Prisma.Decimal(0);
    let totalWeightGram = 0;
    for (const line of lines) {
      subtotal = subtotal.plus(line.unitPrice.mul(line.quantity));
      totalWeightGram += line.weightGram * line.quantity;
    }
    subtotal = subtotal.toDecimalPlaces(2);

    const fragile = lines.some((line) => line.fragile);
    const oversized = lines.some((line) => line.oversized);
    const shippingResult = await this.resolveShipping(
      dto.shippingRateId,
      subtotal,
      totalWeightGram,
      dto.shippingAddress.countryCode,
      fragile,
      oversized,
    );
    const baseShippingCost = shippingResult.shippingCost;
    const wholesaleMinimums = source === "Wholesale" ? await this.wholesaleMinimums() : null;
    if (wholesaleMinimums) {
      const pieces = lines.reduce((sum, line) => {
        const factor = line.variant?.wholesalePiecesPerUnit ?? line.product.wholesalePiecesPerUnit ?? (line.product.unit === "piece" ? 1 : null);
        return sum + (factor ? factor * line.quantity : 0);
      }, 0);
      if (subtotal.lessThan(wholesaleMinimums.minimumSubtotalUsd) && pieces < wholesaleMinimums.minimumPieces) {
        throw new BadRequestException(
          `Wholesale checkout requires either USD ${wholesaleMinimums.minimumSubtotalUsd.toFixed(2)} in merchandise or ${wholesaleMinimums.minimumPieces} pieces; this cart has USD ${subtotal.toFixed(2)} and ${pieces} pieces`,
        );
      }
    }
    const discountResult = source === "Wholesale" ? null : await this.resolveDiscount(dto.discountCode, lines, subtotal, baseShippingCost, email);

    const shippingCost = discountResult?.shippingCost ?? baseShippingCost;
    const discountTotal = discountResult?.discountTotal ?? new Prisma.Decimal(0);
    const total = subtotal.minus(discountTotal).plus(shippingCost).toDecimalPlaces(2);
    const currency = "USD";

    const preparedOrder: PreparedOrder = {
      checkoutKey: dto.checkoutKey,
      checkoutFingerprint,
      source,
      customerId: channel?.customerId ?? null,
      email,
      customerName: dto.customerName,
      phone: dto.phone ?? null,
      shippingAddress: dto.shippingAddress,
      customerNote: dto.customerNote ?? null,
      paymentMethod,
      currency,
      subtotal,
      shippingCost,
      discountTotal,
      total,
      discountId: discountResult?.discount.id ?? null,
      discountCode: discountResult?.discount.code ?? null,
      shippingName: shippingResult.name,
      carrier: shippingResult.carrier,
      totalWeightGram,
      items: lines.map((line) => ({
        productId: line.product.id,
        variantId: line.variant?.id ?? null,
        name: line.name,
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.unitPrice.mul(line.quantity).toDecimalPlaces(2),
        weightGram: line.weightGram,
        imageUrl: line.imageUrl,
        stockModel: line.product.stockModel,
      })),
    };

    if (quoteOnly) return this.createCheckoutQuote(preparedOrder, requestFingerprint);
    if (!this.isCheckoutQuoteValid(dto.quoteToken, preparedOrder, requestFingerprint)) {
      return { quoteChanged: true, quote: this.createCheckoutQuote(preparedOrder, requestFingerprint) };
    }

    let order: OrderWithRelations;
    try {
      order = await this.lifecycle.createReservedOrder(preparedOrder);
    } catch (error) {
      if (dto.checkoutKey && checkoutFingerprint) {
        const previous = await this.prisma.order.findUnique({ where: { checkoutKey: dto.checkoutKey }, include: orderInclude });
        if (previous) {
          if (previous.checkoutFingerprint !== checkoutFingerprint) {
            throw new ConflictException("This checkout was already submitted with different details. Reload to recover the earlier order.");
          }
          return this.toApiOrder(previous);
        }
      }
      throw error;
    }

    return this.toApiOrder(order);
  }

  private checkoutQuoteSnapshot(prepared: PreparedOrder) {
    return {
      currency: prepared.currency,
      subtotal: prepared.subtotal.toFixed(2),
      shippingCost: prepared.shippingCost.toFixed(2),
      discountTotal: prepared.discountTotal.toFixed(2),
      total: prepared.total.toFixed(2),
      shippingName: prepared.shippingName,
      carrier: prepared.carrier,
      totalWeightGram: prepared.totalWeightGram,
      discountCode: prepared.discountCode ?? null,
      items: prepared.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        lineTotal: item.lineTotal.toFixed(2),
      })),
    };
  }

  private createCheckoutQuote(prepared: PreparedOrder, requestFingerprint: string) {
    const snapshot = this.checkoutQuoteSnapshot(prepared);
    const priceFingerprint = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const payload = Buffer.from(JSON.stringify({ requestFingerprint, priceFingerprint, expiresAt: expiresAt.getTime() })).toString("base64url");
    const signature = createHmac("sha256", this.magicSecret).update(payload).digest("base64url");
    return {
      quoteToken: `${payload}.${signature}`,
      expiresAt: expiresAt.toISOString(),
      currency: prepared.currency,
      subtotal: prepared.subtotal.toNumber(),
      shippingCost: prepared.shippingCost.toNumber(),
      discountTotal: prepared.discountTotal.toNumber(),
      total: prepared.total.toNumber(),
      shippingName: prepared.shippingName,
      items: prepared.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
      })),
    };
  }

  private isCheckoutQuoteValid(token: string | undefined, prepared: PreparedOrder, requestFingerprint: string): boolean {
    if (!token) return false;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return false;
    const expected = createHmac("sha256", this.magicSecret).update(payload).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, "base64url");
    } catch {
      return false;
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
        requestFingerprint?: string;
        priceFingerprint?: string;
        expiresAt?: number;
      };
      const currentPriceFingerprint = createHash("sha256")
        .update(JSON.stringify(this.checkoutQuoteSnapshot(prepared)))
        .digest("hex");
      return parsed.requestFingerprint === requestFingerprint &&
        parsed.priceFingerprint === currentPriceFingerprint &&
        typeof parsed.expiresAt === "number" &&
        parsed.expiresAt > Date.now();
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------ order history (magic link)

  async requestHistoryLink(email: string): Promise<{ ok: true }> {
    const normalized = email.trim().toLowerCase();
    const orderCount = await this.prisma.order.count({ where: { email: normalized } });

    // Always answer the same way so the endpoint cannot be used to probe emails.
    if (orderCount === 0) {
      this.logger.log(`Order history link requested for unknown email ${normalized}`);
      return { ok: true };
    }

    const ttlMinutes = 30;
    const token = signMagicToken({ email: normalized, exp: Date.now() + ttlMinutes * 60_000 }, this.magicSecret);
    const origin = (this.config.get<string>("APP_ORIGIN") ?? "http://localhost:3000")
      .split(",")[0]
      .trim()
      .replace(/\/+$/, "");
    const link = `${origin}/orders?token=${encodeURIComponent(token)}`;

    await this.email.send({
      to: normalized,
      subject: "Your RENDI VIRGO order history link",
      html: renderOrdersLinkEmail({ link, expiresMinutes: ttlMinutes }),
    });

    return { ok: true };
  }

  async history(token: string) {
    const payload = verifyMagicToken(token.trim(), this.magicSecret);
    if (!payload) throw new BadRequestException("This link is invalid or has expired");

    const orders = await this.prisma.order.findMany({
      where: { email: payload.email },
      orderBy: { placedAt: "desc" },
      take: 50,
      include: { items: { select: { name: true, quantity: true, lineTotal: true, imageUrl: true } } },
    });

    return {
      email: payload.email,
      expiresAt: new Date(payload.exp).toISOString(),
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        currency: order.currency,
        total: order.total,
        placedAt: order.placedAt,
        shippingName: order.shippingName,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          imageUrl: item.imageUrl,
        })),
      })),
    };
  }

  async track(orderNumber: string, email?: string) {    const normalized = email?.trim().toLowerCase();
    const order = await this.prisma.order.findUnique({ where: { orderNumber }, include: { items: true } });
    if (!order || !normalized || !order.email || order.email.toLowerCase() !== normalized) {
      throw new NotFoundException("Order not found");
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      shippingCost: order.shippingCost,
      total: order.total,
      customerName: order.customerName,
      shippingName: order.shippingName,
      items: order.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        imageUrl: item.imageUrl,
      })),
      tracking: {
        carrier: order.carrier,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
      },
      shippingAddress: {
        city: order.shippingCity,
        state: order.shippingState,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry,
      },
      placedAt: order.placedAt,
      paidAt: order.paidAt,
      packedAt: order.packedAt,
      shippedAt: order.shippedAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
    };
  }

  // ------------------------------------------------------------ admin queries

  private buildAdminWhere(query: OrderQueryDto): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.source) where.source = query.source;
    if (query.proofQueue === "true") {
      where.paymentMethod = "BankTransfer";
      where.paymentStatus = "Pending";
      where.paymentProofUploadedAt = { not: null };
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (query.from || query.to) {
      where.placedAt = {
        ...(query.from ? { gte: this.parseDate(query.from) } : {}),
        ...(query.to ? { lte: this.parseDate(query.to, true) } : {}),
      };
    }

    return where;
  }

  async listAdmin(query: OrderQueryDto) {
    const where = this.buildAdminWhere(query);
    const orderBy: Prisma.OrderOrderByWithRelationInput = query.proofQueue === "true"
      ? { paymentProofUploadedAt: "asc" }
      : { placedAt: query.order === "asc" ? "asc" : "desc" };
    const paidWhere: Prisma.OrderWhereInput = { AND: [where, { paymentStatus: { in: ["Paid", "PartiallyRefunded"] } }] };
    const pendingWhere: Prisma.OrderWhereInput = { AND: [where, { paymentStatus: "Pending" }] };

    const [total, orders, pending, paid, paidGroups] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({ where, orderBy, include: orderListInclude, ...skipTake(query.page, query.pageSize) }),
      this.prisma.order.count({ where: pendingWhere }),
      this.prisma.order.count({ where: paidWhere }),
      this.prisma.order.groupBy({ by: ["currency"], where: paidWhere, _sum: { total: true, refundedAmount: true } }),
    ]);

    const revenueByCurrency = Object.fromEntries(paidGroups.map((group) => [
      group.currency,
      Number(group._sum.total ?? 0) - Number(group._sum.refundedAmount ?? 0),
    ]));
    const revenue = revenueByCurrency.USD ?? 0;

    return {
      ...paginated(orders.map((order) => this.toApiOrderSummary(order)), total, query.page, query.pageSize),
      summary: { count: total, revenue, revenueByCurrency, pending, paid },
    };
  }

  async getAdminById(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException("Order not found");
    return this.toApiOrder(order);
  }

  // ------------------------------------------------------------ admin mutations

  async update(id: string, dto: UpdateOrderDto, context: AuditContext) {
    const existing = await this.prisma.order.findUnique({ where: { id }, select: { id: true, orderNumber: true } });
    if (!existing) throw new NotFoundException("Order not found");

    const data: Prisma.OrderUpdateInput = {};
    if (dto.carrier !== undefined) data.carrier = dto.carrier;
    if (dto.trackingNumber !== undefined) data.trackingNumber = dto.trackingNumber;
    if (dto.trackingUrl !== undefined) data.trackingUrl = dto.trackingUrl;
    if (dto.internalNote !== undefined) data.internalNote = dto.internalNote;
    if (dto.customerNote !== undefined) data.customerNote = dto.customerNote;

    const updated = await this.prisma.order.update({ where: { id }, data, include: orderInclude });
    await this.audit.log({
      adminId: context.adminId,
      action: "order.update",
      entityType: "Order",
      entityId: updated.id,
      summary: "Updated order " + updated.orderNumber,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return this.toApiOrder(updated);
  }

  async advanceFulfillment(id: string, status: OrderStatus, context: AuditContext) {
    const updated = await this.lifecycle.advanceFulfillment(id, status, context.adminId ?? undefined);
    await this.audit.log({
      adminId: context.adminId,
      action: "order.update",
      entityType: "Order",
      entityId: updated.id,
      summary: "Changed order " + updated.orderNumber + " to " + status,
      metadata: { status },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return this.toApiOrder(updated);
  }

  async cancelOrder(id: string, context: AuditContext) {
    const updated = await this.lifecycle.cancelOrder(id, context.adminId ?? undefined);
    await this.audit.log({
      adminId: context.adminId,
      action: "order.update",
      entityType: "Order",
      entityId: updated.id,
      summary: "Cancelled order " + updated.orderNumber,
      metadata: { status: "Cancelled" },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return this.toApiOrder(updated);
  }

  async returnOrder(id: string, context: AuditContext) {
    const updated = await this.lifecycle.returnOrder(id, context.adminId ?? undefined);
    await this.audit.log({
      adminId: context.adminId,
      action: "order.update",
      entityType: "Order",
      entityId: updated.id,
      summary: "Returned order " + updated.orderNumber,
      metadata: { status: "Returned" },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return this.toApiOrder(updated);
  }

  async restockReturnedInventory(id: string, context: AuditContext) {
    const updated = await this.lifecycle.restockReturnedInventory(id, context.adminId ?? undefined);
    await this.audit.log({
      adminId: context.adminId,
      action: "order.inventory.restock",
      entityType: "Order",
      entityId: updated.id,
      summary: "Restocked inspected items from returned order " + updated.orderNumber,
      metadata: { status: updated.status, itemCount: updated.items.length },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return this.toApiOrder(updated);
  }

  async confirmPayment(id: string, context: AuditContext) {
    const result = await this.lifecycle.confirmManualPayment(id, context.adminId ?? undefined);
    await this.audit.log({
      adminId: context.adminId ?? undefined,
      action: "order.payment.confirm",
      entityType: "Order",
      entityId: result.order.id,
      summary: "Confirmed payment for order " + result.order.orderNumber,
      metadata: { outcome: result.outcome, paymentMethod: result.order.paymentMethod },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return { ...this.toApiOrder(result.order), settlementOutcome: result.outcome };
  }

  async addEvent(id: string, dto: CreateOrderEventDto, context: AuditContext) {    const order = await this.prisma.order.findUnique({ where: { id }, select: { id: true, orderNumber: true } });
    if (!order) throw new NotFoundException("Order not found");

    const event = await this.prisma.orderEvent.create({
      data: {
        orderId: id,
        adminId: context.adminId ?? null,
        type: dto.type?.trim() || "note",
        message: dto.message,
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "order.event.create",
      entityType: "Order",
      entityId: id,
      summary: `Added event to order ${order.orderNumber}`,
      metadata: { type: event.type, message: event.message },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiEvent(event);
  }

  async invoice(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException("Order not found");

    const store = await this.settings.getPublicSettings();
    const text = (key: string, fallback: string): string => {
      const value = store[key];
      return typeof value === "string" && value.trim() ? value.trim() : fallback;
    };

    return {
      invoiceNumber: `INV-${order.orderNumber}`,
      orderNumber: order.orderNumber,
      issuedAt: new Date(),
      placedAt: order.placedAt,
      source: order.source,
      fulfillmentMethod: order.fulfillmentMethod,
      currency: order.currency,
      exchangeRate: order.exchangeRate,
      seller: {
        name: text("store.name", SELLER_FALLBACK.name),
        address: text("store.address", SELLER_FALLBACK.address),
        email: text("store.email", SELLER_FALLBACK.email),
        phone: text("store.whatsapp", SELLER_FALLBACK.phone),
      },
      buyer: {
        name: order.customerName,
        email: order.email,
        phone: order.phone,
        address: {
          line1: order.shippingLine1,
          line2: order.shippingLine2,
          city: order.shippingCity,
          state: order.shippingState,
          postalCode: order.shippingPostalCode,
          country: order.shippingCountry,
          countryCode: order.shippingCountryCode,
        },
      },
      items: order.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subtotal: order.subtotal,
      discountCode: order.discountCode,
      discountReason: order.discountReason,
      discountTotal: order.discountTotal,
      shippingName: order.shippingName,
      shippingCost: order.shippingCost,
      taxTotal: order.taxTotal,
      total: order.total,
      refundedAmount: order.refundedAmount,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentRef: order.paymentRef,
      paidAt: order.paidAt,
    };
  }

  async refund(id: string, dto: RefundOrderDto, context: AuditContext) {
    const orderForRefund = await this.prisma.order.findUnique({ where: { id }, select: { currency: true } });
    if (!orderForRefund) throw new NotFoundException("Order not found");
    if (orderForRefund.currency === "IDR" && !Number.isInteger(dto.amount)) {
      throw new BadRequestException("IDR refunds must use whole rupiah amounts");
    }
    const updated = await this.lifecycle.recordRefund({
      orderId: id,
      amount: dto.amount,
      reason: dto.reason,
      externalReference: dto.externalReference,
      adminId: context.adminId ?? undefined,
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "order.refund",
      entityType: "Order",
      entityId: id,
      summary: "Refunded " + updated.currency + " " + Number(dto.amount).toFixed(2) + " on order " + updated.orderNumber,
      metadata: {
        amount: dto.amount,
        reason: dto.reason ?? null,
        externalReference: dto.externalReference?.trim() || null,
        paymentStatus: updated.paymentStatus,
        fundsSentByThisAction: false,
      },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiOrder(updated);
  }
}
