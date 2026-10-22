import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ShippingClass } from "../../generated/prisma";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateShippingProfileDto,
  CreateShippingRateDto,
  ShippingQuoteDto,
  ShippingRateQueryDto,
  UpdateShippingProfileDto,
  UpdateShippingRateDto,
} from "./dto/settings.dto";
import { SettingsService } from "./settings.service";
import { createXlsxBuffer, parseXlsxTable, type XlsxRow } from "./xlsx";

export type ShippingQuoteBreakdown = {
  base: number;
  handling: number;
  insurance: number;
  fragile: number;
  oversized: number;
  total: number;
};

export type ShippingQuoteOption = {
  id: string;
  name: string;
  carrier: string | null;
  price: number;
  breakdown: ShippingQuoteBreakdown;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
};

export type ShippingQuoteSource = "CarrierAPI" | "AdminOverride" | "FreeShipping";

export type ShippingQuote = {
  options: ShippingQuoteOption[];
  source: ShippingQuoteSource;
  overrideApplied: boolean;
};

export type ResolvedOrderShipping = {
  name: string;
  carrier: string | null;
  shippingCost: Prisma.Decimal;
  source: ShippingQuoteSource;
};

type ShippingImportMode = "merge" | "replace";
type ShippingImportData = Omit<CreateShippingRateDto, "carrier"> & {
  carrier: string | null;
  region: string;
  minWeightGram: number;
  maxWeightGram: number | null;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  handlingFee: number;
  insuranceFee: number;
  fragileFee: number;
  oversizedFee: number;
  isActive: boolean;
  sortOrder: number;
};
type ParsedShippingImportRow = { rowNumber: number; id: string | null; data: ShippingImportData };
type ShippingImportIssue = { row: number; messages: string[] };
type ShippingImportPreview = {
  sheetName: string;
  carrier: { key: string; label: string; values: string[] } | null;
  rowCount: number;
  validCount: number;
  invalidCount: number;
  totalIssues: number;
  issues: ShippingImportIssue[];
  createdCount: number;
  updatedCount: number;
  canImport: boolean;
};

const IMPORT_ROW_LIMIT = 10_000;

export type ShippingCarrierExport = "all" | "dhl" | "fedex" | "post-office";

const SHIPPING_CARRIER_LABELS: Record<Exclude<ShippingCarrierExport, "all">, string> = {
  dhl: "DHL",
  fedex: "FedEx",
  "post-office": "Post Office (Pos Indonesia)",
};

function shippingCarrierKey(carrier: string | null | undefined): string | null {
  const normalized = carrier
    ?.trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  if (!normalized) return null;
  if (normalized.includes("dhl")) return "dhl";
  if (normalized.includes("fedex")) return "fedex";
  if (normalized === "pos" || normalized.includes("posindonesia") || normalized.includes("postoffice")) return "post-office";
  return `custom:${normalized}`;
}

function shippingCarrierLabel(key: string, values: string[]): string {
  if (key in SHIPPING_CARRIER_LABELS) return SHIPPING_CARRIER_LABELS[key as keyof typeof SHIPPING_CARRIER_LABELS];
  return values[0] ?? key.replace(/^custom:/, "");
}

function parseShippingCarrierExport(value: string | undefined): ShippingCarrierExport {
  if (!value || value === "all") return "all";
  if (value === "dhl" || value === "fedex" || value === "post-office") return value;
  throw new BadRequestException("Carrier export must be all, dhl, fedex, or post-office.");
}

function shippingRateKey(rate: Pick<ShippingImportData, "name" | "carrier" | "region" | "minWeightGram" | "maxWeightGram">) {
  return [
    rate.name.trim().toLocaleLowerCase(),
    shippingCarrierKey(rate.carrier) ?? "",
    rate.region.trim().toLocaleLowerCase(),
    rate.minWeightGram,
    rate.maxWeightGram ?? "none",
  ].join("\u001f");
}

function cellAsText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const cell = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: string }> };
    if (typeof cell.text === "string") return cell.text;
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text ?? "").join("");
    if (cell.result !== undefined) return cellAsText(cell.result);
  }
  return String(value);
}

const round = (value: number): number => Math.round(value * 100) / 100;

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------ quote

  private ratesForDestination<T extends { region: string }>(rates: T[], destination: string): T[] {
    const countryCode = destination.trim().toLowerCase();
    if (!countryCode) return rates.filter((rate) => rate.region.trim().toLowerCase() === "worldwide");

    const countryRates = rates.filter((rate) => rate.region.trim().toLowerCase() === countryCode);
    return countryRates.length
      ? countryRates
      : rates.filter((rate) => rate.region.trim().toLowerCase() === "worldwide");
  }

  private findRates(weightGram: number, destination: string) {
    const regionFilter: Prisma.ShippingRateWhereInput = destination
      ? {
          OR: [
            { region: { equals: "Worldwide", mode: "insensitive" } },
            { region: { equals: destination, mode: "insensitive" } },
          ],
        }
      : { region: { equals: "Worldwide", mode: "insensitive" } };

    return this.prisma.shippingRate.findMany({
      where: {
        isActive: true,
        minWeightGram: { lte: weightGram },
        AND: [{ OR: [{ maxWeightGram: null }, { maxWeightGram: { gte: weightGram } }] }, regionFilter],
      },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    });
  }

  private feeBreakdown(
    rate: {
      price: Prisma.Decimal;
      handlingFee: Prisma.Decimal;
      insuranceFee: Prisma.Decimal;
      fragileFee: Prisma.Decimal;
      oversizedFee: Prisma.Decimal;
    },
    fragile: boolean,
    oversized: boolean,
  ): ShippingQuoteBreakdown {
    const base = round(Number(rate.price));
    const handling = round(Number(rate.handlingFee));
    const insurance = round(Number(rate.insuranceFee));
    const fragileFee = fragile ? round(Number(rate.fragileFee)) : 0;
    const oversizedFee = oversized ? round(Number(rate.oversizedFee)) : 0;
    return {
      base,
      handling,
      insurance,
      fragile: fragileFee,
      oversized: oversizedFee,
      total: round(base + handling + insurance + fragileFee + oversizedFee),
    };
  }

  private toOption(
    rate: {
      id: string;
      name: string;
      carrier: string | null;
      price: Prisma.Decimal;
      handlingFee: Prisma.Decimal;
      insuranceFee: Prisma.Decimal;
      fragileFee: Prisma.Decimal;
      oversizedFee: Prisma.Decimal;
      deliveryMinDays: number;
      deliveryMaxDays: number;
    },
    fragile: boolean,
    oversized: boolean,
  ): ShippingQuoteOption {
    const breakdown = this.feeBreakdown(rate, fragile, oversized);
    return {
      id: rate.id,
      name: rate.name,
      carrier: rate.carrier,
      price: breakdown.total,
      breakdown,
      deliveryMinDays: rate.deliveryMinDays,
      deliveryMaxDays: rate.deliveryMaxDays,
    };
  }

  async quote(dto: ShippingQuoteDto): Promise<ShippingQuote> {
    const settings = await this.settings.getShippingSettings();
    const fragile = dto.fragile ?? dto.shippingClass === "Fragile";
    const oversized = dto.oversized ?? dto.shippingClass === "Oversized";

    if (settings.overrideEnabled) {
      const price = round(settings.overrideAmount);
      return {
        options: [
          {
            id: "admin-override",
            name: "Admin override",
            carrier: null,
            price,
            breakdown: { base: price, handling: 0, insurance: 0, fragile: 0, oversized: 0, total: price },
            deliveryMinDays: null,
            deliveryMaxDays: null,
          },
        ],
        source: "AdminOverride",
        overrideApplied: true,
      };
    }

    const subtotal = dto.subtotal ?? 0;
    if (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold) {
      return {
        options: [
          {
            id: "free-shipping",
            name: "Free shipping",
            carrier: null,
            price: 0,
            breakdown: { base: 0, handling: 0, insurance: 0, fragile: 0, oversized: 0, total: 0 },
            deliveryMinDays: null,
            deliveryMaxDays: null,
          },
        ],
        source: "FreeShipping",
        overrideApplied: false,
      };
    }

    const destination = dto.countryCode?.trim() ?? "";
    const rates = await this.findRates(dto.weightGram, destination);
    const sorted = this.ratesForDestination(rates, destination);

    return {
      options: sorted.map((rate) => this.toOption(rate, fragile, oversized)),
      source: "CarrierAPI",
      overrideApplied: false,
    };
  }

  // ------------------------------------------------------------ order pricing
  // Single source of truth used by checkout order creation: honours admin
  // override, free-shipping threshold, region and weight constraints, and the
  // same fragile/oversized/insurance fees the quote returned.

  async resolveOrderShipping(params: {
    shippingRateId?: string;
    subtotal: Prisma.Decimal;
    weightGram: number;
    countryCode?: string;
    fragile: boolean;
    oversized: boolean;
  }): Promise<ResolvedOrderShipping> {
    const settings = await this.settings.getShippingSettings();
    const selected = params.shippingRateId?.trim() || undefined;

    if (settings.overrideEnabled) {
      if (selected && selected !== "admin-override") {
        throw new BadRequestException("The selected shipping rate is not available");
      }
      const price = new Prisma.Decimal(round(settings.overrideAmount));
      return { name: "Admin override", carrier: null, shippingCost: price, source: "AdminOverride" };
    }

    const threshold = new Prisma.Decimal(settings.freeShippingThreshold);
    if (settings.freeShippingThreshold > 0 && params.subtotal.greaterThanOrEqualTo(threshold)) {
      if (selected && selected !== "free-shipping") {
        throw new BadRequestException("Free shipping applies to this order");
      }
      return { name: "Free shipping", carrier: null, shippingCost: new Prisma.Decimal(0), source: "FreeShipping" };
    }

    const destination = params.countryCode?.trim() ?? "";
    const rates = (await this.findRates(params.weightGram, destination)).filter(
      (candidate) =>
        candidate.isActive &&
        candidate.minWeightGram <= params.weightGram &&
        (candidate.maxWeightGram === null || candidate.maxWeightGram >= params.weightGram),
    );
    const availableRates = this.ratesForDestination(rates, destination);
    let rate: Prisma.ShippingRateGetPayload<Record<never, never>> | null = null;

    if (selected) {
      if (selected === "admin-override" || selected === "free-shipping") {
        throw new BadRequestException("The selected shipping rate is not available");
      }
      rate = availableRates.find((candidate) => candidate.id === selected) ?? null;
      if (!rate) throw new BadRequestException("The selected shipping rate is not available");
    } else {
      rate = availableRates[0] ?? null;
      if (!rate) throw new BadRequestException("No shipping rate is available for this order");
    }

    const breakdown = this.feeBreakdown(rate, params.fragile, params.oversized);
    return {
      name: rate.name,
      carrier: rate.carrier,
      shippingCost: new Prisma.Decimal(breakdown.total),
      source: "CarrierAPI",
    };
  }

  // ------------------------------------------------------------ rates (admin)

  private toApiRate(rate: {
    id: string;
    name: string;
    carrier: string | null;
    region: string;
    minWeightGram: number;
    maxWeightGram: number | null;
    deliveryMinDays: number;
    deliveryMaxDays: number;
    price: Prisma.Decimal;
    handlingFee: Prisma.Decimal;
    insuranceFee: Prisma.Decimal;
    fragileFee: Prisma.Decimal;
    oversizedFee: Prisma.Decimal;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: rate.id,
      name: rate.name,
      carrier: rate.carrier,
      region: rate.region,
      minWeightGram: rate.minWeightGram,
      maxWeightGram: rate.maxWeightGram,
      deliveryMinDays: rate.deliveryMinDays,
      deliveryMaxDays: rate.deliveryMaxDays,
      price: Number(rate.price),
      handlingFee: Number(rate.handlingFee),
      insuranceFee: Number(rate.insuranceFee),
      fragileFee: Number(rate.fragileFee),
      oversizedFee: Number(rate.oversizedFee),
      isActive: rate.isActive,
      sortOrder: rate.sortOrder,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    };
  }

  async listRates(query: ShippingRateQueryDto) {
    const where: Prisma.ShippingRateWhereInput = {};

    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.region) where.region = { equals: query.region, mode: "insensitive" };

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { carrier: { contains: search, mode: "insensitive" } },
        { region: { contains: search, mode: "insensitive" } },
      ];
    }

    const rates = await this.prisma.shippingRate.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    });

    return rates.map((rate) => this.toApiRate(rate));
  }

  async exportRatesXlsx(carrierValue?: string): Promise<{ buffer: Buffer; carrier: ShippingCarrierExport }> {
    const carrier = parseShippingCarrierExport(carrierValue);
    const allRates = await this.prisma.shippingRate.findMany({
      orderBy: [{ sortOrder: "asc" }, { carrier: "asc" }, { region: "asc" }, { minWeightGram: "asc" }],
    });
    const rates = carrier === "all"
      ? allRates
      : allRates.filter((rate) => shippingCarrierKey(rate.carrier) === carrier);
    const headers = [
      "name",
      "carrier",
      "region",
      "minWeightGram",
      "maxWeightGram",
      "deliveryMinDays",
      "deliveryMaxDays",
      "price",
      "handlingFee",
      "insuranceFee",
      "fragileFee",
      "oversizedFee",
      "isActive",
      "sortOrder",
      "id",
      "importStatus",
    ];
    const dataRows = rates.map((rate) => [
      rate.name,
      rate.carrier,
      rate.region,
      rate.minWeightGram,
      rate.maxWeightGram,
      rate.deliveryMinDays,
      rate.deliveryMaxDays,
      Number(rate.price),
      Number(rate.handlingFee),
      Number(rate.insuranceFee),
      Number(rate.fragileFee),
      Number(rate.oversizedFee),
      rate.isActive,
      rate.sortOrder,
      rate.id,
      "OK",
    ]);

    const buffer = createXlsxBuffer([
      { name: "Data Impor", headers, rows: dataRows },
      {
        name: "Petunjuk",
        headers: ["Panduan", "Keterangan"],
        rows: [
          ["Format", "Edit baris pada sheet Data Impor, lalu simpan sebagai XLSX. Ekspor kurir hanya memuat satu kelompok kurir."],
          ["Impor", "Gunakan pratinjau di halaman Shipping sebelum menerapkan perubahan."],
          ["Kunci tarif", "Impor gabung mencocokkan ID; jika tidak ada, nama, kelompok kurir, wilayah, dan rentang berat."],
          ["Status", "Kolom importStatus harus OK. Perbaiki atau tinjau catatan yang belum OK sebelum impor."],
          ["Ganti kurir", "Mode Ganti kurir hanya menghapus tarif aktif dan nonaktif milik kelompok kurir pada file ini."],
        ],
      },
    ]);
    return { buffer, carrier };
  }

  private importMode(value: string): ShippingImportMode {
    if (value === "merge" || value === "replace") return value;
    throw new BadRequestException("Import mode must be merge or replace.");
  }

  private parseRateImport(buffer: Buffer) {
    const table = parseXlsxTable(buffer, "Data Impor");
    if (table.sheetName.toLocaleLowerCase() !== "data impor") {
      throw new BadRequestException("The workbook must contain a Data Impor worksheet.");
    }
    const headerIndexes = new Map<string, number>();
    table.headers.forEach((value, index) => {
      const key = cellAsText(value).trim().toLowerCase();
      if (key) headerIndexes.set(key, index);
    });

    const requiredHeaders = ["name", "carrier", "region", "price", "importStatus"];
    const missingHeaders = requiredHeaders.filter((header) => !headerIndexes.has(header.toLowerCase()));
    if (missingHeaders.length) {
      throw new BadRequestException(`Missing required columns: ${missingHeaders.join(", ")}.`);
    }

    const issues = new Map<number, string[]>();
    const addIssue = (rowNumber: number, message: string) => {
      const messages = issues.get(rowNumber) ?? [];
      messages.push(message);
      issues.set(rowNumber, messages);
    };
    const rows: ParsedShippingImportRow[] = [];
    let rowCount = 0;

    for (const row of table.rows) {
      const isBlank = row.values.every((value) => cellAsText(value).trim() === "");
      if (isBlank) continue;
      rowCount += 1;
      if (rowCount > IMPORT_ROW_LIMIT) {
        throw new BadRequestException(`A workbook can contain up to ${IMPORT_ROW_LIMIT.toLocaleString()} shipping rates.`);
      }

      const valueFor = (key: string) => {
        const index = headerIndexes.get(key.toLowerCase());
        return index === undefined ? "" : row.values[index];
      };
      const textFor = (key: string) => cellAsText(valueFor(key)).trim();
      const integerFor = (key: string, label: string, defaultValue: number, minimum: number, maximum: number) => {
        const text = textFor(key);
        if (!text) return defaultValue;
        const number = Number(text);
        if (!Number.isInteger(number) || number < minimum || number > maximum) {
          addIssue(row.rowNumber, `${label} must be a whole number from ${minimum} to ${maximum}.`);
          return defaultValue;
        }
        return number;
      };
      const moneyFor = (key: string, label: string, required: boolean) => {
        const text = textFor(key);
        if (!text) {
          if (required) addIssue(row.rowNumber, `${label} is required.`);
          return 0;
        }
        const number = Number(text);
        if (!Number.isFinite(number) || number < 0 || number > 9_999_999_999.99 || Math.abs(number * 100 - Math.round(number * 100)) > 1e-7) {
          addIssue(row.rowNumber, `${label} must be a non-negative amount with up to two decimal places.`);
          return 0;
        }
        return number;
      };

      const name = textFor("name");
      if (name.length < 2 || name.length > 160) addIssue(row.rowNumber, "Name must contain 2 to 160 characters.");
      const carrierValue = textFor("carrier");
      if (!carrierValue) addIssue(row.rowNumber, "Carrier is required so this workbook can be kept separate by carrier.");
      if (carrierValue.length > 120) addIssue(row.rowNumber, "Carrier must be 120 characters or fewer.");
      const regionRaw = textFor("region");
      if (!regionRaw || regionRaw.length > 120) addIssue(row.rowNumber, "Region is required and must be 120 characters or fewer.");
      const region = regionRaw.toLowerCase() === "worldwide" ? "Worldwide" : regionRaw.toUpperCase();

      const minWeightGram = integerFor("minWeightGram", "Minimum weight", 0, 0, 2_147_483_647);
      const maxWeightText = textFor("maxWeightGram");
      const maxWeightGram = maxWeightText
        ? integerFor("maxWeightGram", "Maximum weight", 0, 0, 2_147_483_647)
        : null;
      const deliveryMinDays = integerFor("deliveryMinDays", "Minimum delivery days", 3, 1, 365);
      const deliveryMaxDays = integerFor("deliveryMaxDays", "Maximum delivery days", 7, 1, 365);
      if (maxWeightGram !== null && maxWeightGram < minWeightGram) {
        addIssue(row.rowNumber, "Maximum weight must be greater than or equal to minimum weight.");
      }
      if (deliveryMaxDays < deliveryMinDays) {
        addIssue(row.rowNumber, "Maximum delivery days must be greater than or equal to minimum delivery days.");
      }

      const activeText = textFor("isActive").toLowerCase();
      let isActive = true;
      if (activeText) {
        if (["true", "1", "yes", "y", "active"].includes(activeText)) isActive = true;
        else if (["false", "0", "no", "n", "inactive"].includes(activeText)) isActive = false;
        else addIssue(row.rowNumber, "isActive must be true or false.");
      }

      const sourceStatus = textFor("importStatus");
      if (sourceStatus.toUpperCase() !== "OK") {
        addIssue(row.rowNumber, sourceStatus ? `Review importStatus: ${sourceStatus}` : "importStatus must be OK after the row has been reviewed.");
      }

      rows.push({
        rowNumber: row.rowNumber,
        id: textFor("id") || null,
        data: {
          name,
          carrier: carrierValue || null,
          region,
          minWeightGram,
          maxWeightGram,
          deliveryMinDays,
          deliveryMaxDays,
          price: moneyFor("price", "Price", true),
          handlingFee: moneyFor("handlingFee", "Handling fee", false),
          insuranceFee: moneyFor("insuranceFee", "Insurance fee", false),
          fragileFee: moneyFor("fragileFee", "Fragile fee", false),
          oversizedFee: moneyFor("oversizedFee", "Oversized fee", false),
          isActive,
          sortOrder: integerFor("sortOrder", "Sort order", 0, -2_147_483_648, 2_147_483_647),
        },
      });
    }

    if (!rowCount) throw new BadRequestException("The selected worksheet does not contain any shipping-rate rows.");

    const carrierValues = [...new Set(rows.map((row) => row.data.carrier).filter((value): value is string => Boolean(value)))];
    const carrierKeys = [...new Set(carrierValues.map((value) => shippingCarrierKey(value)).filter((value): value is string => value !== null))];
    if (carrierKeys.length > 1) {
      rows.forEach((row) => {
        if (row.data.carrier) addIssue(row.rowNumber, "A workbook may contain only one carrier group. Export each carrier to its own XLSX file.");
      });
    }

    const candidateRows = rows.filter((row) => !issues.has(row.rowNumber));
    const rowsByKey = new Map<string, ParsedShippingImportRow[]>();
    const rowsById = new Map<string, ParsedShippingImportRow[]>();
    for (const row of candidateRows) {
      const key = shippingRateKey(row.data);
      rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), row]);
      if (row.id) rowsById.set(row.id, [...(rowsById.get(row.id) ?? []), row]);
    }
    for (const duplicates of rowsByKey.values()) {
      if (duplicates.length > 1) duplicates.forEach((row) => addIssue(row.rowNumber, "Duplicate rate key in this workbook."));
    }
    for (const duplicates of rowsById.values()) {
      if (duplicates.length > 1) duplicates.forEach((row) => addIssue(row.rowNumber, "Duplicate rate ID in this workbook."));
    }

    const carrierKey = carrierKeys.length === 1 ? carrierKeys[0] : null;
    const carrier = carrierKey
      ? { key: carrierKey, label: shippingCarrierLabel(carrierKey, carrierValues), values: carrierValues }
      : null;
    return { sheetName: table.sheetName, carrier, rowCount, rows, issues, addIssue };
  }

  private async previewRateImport(buffer: Buffer, mode: ShippingImportMode): Promise<ShippingImportPreview> {
    const parsed = this.parseRateImport(buffer);
    const existingRates = await this.prisma.shippingRate.findMany();
    const ratesById = new Map(existingRates.map((rate) => [rate.id, rate]));
    const ratesByKey = new Map<string, typeof existingRates>();
    for (const rate of existingRates) {
      const key = shippingRateKey(rate);
      ratesByKey.set(key, [...(ratesByKey.get(key) ?? []), rate]);
    }

    let createdCount = 0;
    let updatedCount = 0;
    for (const row of parsed.rows) {
      if (parsed.issues.has(row.rowNumber)) continue;
      if (mode === "replace") {
        createdCount += 1;
        continue;
      }
      if (row.id && ratesById.has(row.id)) {
        const existing = ratesById.get(row.id)!;
        if (shippingCarrierKey(existing.carrier) !== shippingCarrierKey(row.data.carrier)) {
          parsed.addIssue(row.rowNumber, "This rate ID belongs to a different carrier group. Remove the ID or use the matching carrier export.");
          continue;
        }
        updatedCount += 1;
        continue;
      }
      const matches = ratesByKey.get(shippingRateKey(row.data)) ?? [];
      if (matches.length > 1) {
        parsed.addIssue(row.rowNumber, "More than one current rate matches this row; resolve duplicates first.");
      } else if (matches.length === 1) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
    }

    const invalidCount = parsed.issues.size;
    const issueRows = [...parsed.issues.entries()].sort(([left], [right]) => left - right);
    return {
      sheetName: parsed.sheetName,
      carrier: parsed.carrier,
      rowCount: parsed.rowCount,
      validCount: parsed.rows.filter((row) => !parsed.issues.has(row.rowNumber)).length,
      invalidCount,
      totalIssues: invalidCount,
      issues: issueRows.slice(0, 30).map(([row, messages]) => ({ row, messages })),
      createdCount,
      updatedCount,
      canImport: Boolean(parsed.carrier)
        && parsed.rows.some((row) => !parsed.issues.has(row.rowNumber))
        && (mode === "merge" || invalidCount === 0),
    };
  }

  async previewRatesXlsx(buffer: Buffer, mode: string) {
    return this.previewRateImport(buffer, this.importMode(mode));
  }

  async importRatesXlsx(buffer: Buffer, modeValue: string, context: AuditContext) {
    const mode = this.importMode(modeValue);
    const preview = await this.previewRateImport(buffer, mode);
    if (!preview.canImport) {
      throw new BadRequestException(`Import is blocked by ${preview.invalidCount} row(s). Fix the workbook and run the preview again.`);
    }

    const parsed = this.parseRateImport(buffer);
    if (!parsed.carrier) {
      throw new BadRequestException("Import requires a workbook containing exactly one non-empty carrier group.");
    }
    const importCarrier = parsed.carrier;
    const importRows = parsed.rows.filter((row) => !parsed.issues.has(row.rowNumber));
    let skippedCount = parsed.issues.size;
    const dataFor = (data: ShippingImportData): Prisma.ShippingRateCreateManyInput => ({
      name: data.name,
      carrier: data.carrier,
      region: data.region,
      minWeightGram: data.minWeightGram,
      maxWeightGram: data.maxWeightGram,
      deliveryMinDays: data.deliveryMinDays,
      deliveryMaxDays: data.deliveryMaxDays,
      price: new Prisma.Decimal(data.price),
      handlingFee: new Prisma.Decimal(data.handlingFee),
      insuranceFee: new Prisma.Decimal(data.insuranceFee),
      fragileFee: new Prisma.Decimal(data.fragileFee),
      oversizedFee: new Prisma.Decimal(data.oversizedFee),
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      let deletedCount = 0;
      if (mode === "replace") {
        const currentRates = await tx.shippingRate.findMany({ select: { id: true, carrier: true } });
        const idsToDelete = currentRates
          .filter((rate) => shippingCarrierKey(rate.carrier) === importCarrier.key)
          .map((rate) => rate.id);
        if (idsToDelete.length) {
          const deleted = await tx.shippingRate.deleteMany({ where: { id: { in: idsToDelete } } });
          deletedCount = deleted.count;
        }
        await tx.shippingRate.createMany({ data: importRows.map((row) => dataFor(row.data)) });
        return { carrier: importCarrier.label, createdCount: importRows.length, updatedCount: 0, deletedCount };
      }

      const existingRates = await tx.shippingRate.findMany();
      const ratesById = new Map(existingRates.map((rate) => [rate.id, rate]));
      const ratesByKey = new Map<string, typeof existingRates>();
      for (const rate of existingRates) {
        const key = shippingRateKey(rate);
        ratesByKey.set(key, [...(ratesByKey.get(key) ?? []), rate]);
      }

      let createdCount = 0;
      let updatedCount = 0;
      const toCreate: Prisma.ShippingRateCreateManyInput[] = [];
      for (const row of importRows) {
        const matchById = row.id ? ratesById.get(row.id) : undefined;
        if (matchById && shippingCarrierKey(matchById.carrier) !== shippingCarrierKey(row.data.carrier)) {
          skippedCount += 1;
          continue;
        }
        const matches = ratesByKey.get(shippingRateKey(row.data)) ?? [];
        const existing = matchById ?? (matches.length === 1 ? matches[0] : undefined);
        if (matches.length > 1 && !matchById) {
          skippedCount += 1;
          continue;
        }
        if (!existing) {
          toCreate.push(dataFor(row.data));
          createdCount += 1;
          continue;
        }

        await tx.shippingRate.update({
          where: { id: existing.id },
          data: {
            ...dataFor(row.data),
            price: new Prisma.Decimal(row.data.price),
            handlingFee: new Prisma.Decimal(row.data.handlingFee),
            insuranceFee: new Prisma.Decimal(row.data.insuranceFee),
            fragileFee: new Prisma.Decimal(row.data.fragileFee),
            oversizedFee: new Prisma.Decimal(row.data.oversizedFee),
          },
        });
        updatedCount += 1;
      }
      if (toCreate.length) await tx.shippingRate.createMany({ data: toCreate });
      return { createdCount, updatedCount, deletedCount };
    }, { maxWait: 10_000, timeout: 60_000 });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_rate.import",
      entityType: "ShippingRate",
      summary: `Imported ${result.createdCount + result.updatedCount} ${importCarrier.label} shipping rate(s)${skippedCount ? `; skipped ${skippedCount} row(s) for review` : ""}`,
      metadata: { mode, carrier: importCarrier.label, ...result, rowCount: parsed.rowCount, importedCount: result.createdCount + result.updatedCount, skippedCount },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { importedCount: result.createdCount + result.updatedCount, skippedCount, mode, ...result, carrier: importCarrier.label };
  }

  private assertWeightRange(minWeightGram: number, maxWeightGram: number | null | undefined) {
    if (maxWeightGram !== null && maxWeightGram !== undefined && maxWeightGram < minWeightGram) {
      throw new BadRequestException("maxWeightGram must be greater than or equal to minWeightGram");
    }
  }

  private assertDeliveryWindow(deliveryMinDays: number, deliveryMaxDays: number) {
    if (deliveryMinDays < 1 || deliveryMaxDays < deliveryMinDays || deliveryMaxDays > 365) {
      throw new BadRequestException("Delivery estimates must be from 1 to 365 business days, with the maximum at least the minimum.");
    }
  }

  async createRate(dto: CreateShippingRateDto, context: AuditContext) {
    const minWeightGram = dto.minWeightGram ?? 0;
    const deliveryMinDays = dto.deliveryMinDays ?? 3;
    const deliveryMaxDays = dto.deliveryMaxDays ?? 7;
    this.assertWeightRange(minWeightGram, dto.maxWeightGram);
    this.assertDeliveryWindow(deliveryMinDays, deliveryMaxDays);

    const rate = await this.prisma.shippingRate.create({
      data: {
        name: dto.name,
        carrier: dto.carrier ?? null,
        region: dto.region ?? "Worldwide",
        minWeightGram,
        maxWeightGram: dto.maxWeightGram ?? null,
        deliveryMinDays,
        deliveryMaxDays,
        price: new Prisma.Decimal(dto.price),
        handlingFee: new Prisma.Decimal(dto.handlingFee ?? 0),
        insuranceFee: new Prisma.Decimal(dto.insuranceFee ?? 0),
        fragileFee: new Prisma.Decimal(dto.fragileFee ?? 0),
        oversizedFee: new Prisma.Decimal(dto.oversizedFee ?? 0),
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_rate.create",
      entityType: "ShippingRate",
      entityId: rate.id,
      summary: `Created shipping rate "${rate.name}"`,
      metadata: { region: rate.region, price: Number(rate.price) },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiRate(rate);
  }

  async updateRate(id: string, dto: UpdateShippingRateDto, context: AuditContext) {
    const existing = await this.prisma.shippingRate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Shipping rate not found");

    const minWeightGram = dto.minWeightGram ?? existing.minWeightGram;
    const maxWeightGram = dto.maxWeightGram !== undefined ? dto.maxWeightGram : existing.maxWeightGram;
    const deliveryMinDays = dto.deliveryMinDays ?? existing.deliveryMinDays;
    const deliveryMaxDays = dto.deliveryMaxDays ?? existing.deliveryMaxDays;
    this.assertWeightRange(minWeightGram, maxWeightGram);
    this.assertDeliveryWindow(deliveryMinDays, deliveryMaxDays);

    const rate = await this.prisma.shippingRate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.carrier !== undefined ? { carrier: dto.carrier } : {}),
        ...(dto.region !== undefined ? { region: dto.region } : {}),
        ...(dto.minWeightGram !== undefined ? { minWeightGram: dto.minWeightGram } : {}),
        ...(dto.maxWeightGram !== undefined ? { maxWeightGram: dto.maxWeightGram } : {}),
        ...(dto.deliveryMinDays !== undefined ? { deliveryMinDays: dto.deliveryMinDays } : {}),
        ...(dto.deliveryMaxDays !== undefined ? { deliveryMaxDays: dto.deliveryMaxDays } : {}),
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
        ...(dto.handlingFee !== undefined ? { handlingFee: new Prisma.Decimal(dto.handlingFee) } : {}),
        ...(dto.insuranceFee !== undefined ? { insuranceFee: new Prisma.Decimal(dto.insuranceFee) } : {}),
        ...(dto.fragileFee !== undefined ? { fragileFee: new Prisma.Decimal(dto.fragileFee) } : {}),
        ...(dto.oversizedFee !== undefined ? { oversizedFee: new Prisma.Decimal(dto.oversizedFee) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_rate.update",
      entityType: "ShippingRate",
      entityId: rate.id,
      summary: `Updated shipping rate "${rate.name}"`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiRate(rate);
  }

  async toggleRate(id: string, context: AuditContext) {
    const existing = await this.prisma.shippingRate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Shipping rate not found");

    const rate = await this.prisma.shippingRate.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_rate.toggle",
      entityType: "ShippingRate",
      entityId: rate.id,
      summary: `Shipping rate "${rate.name}" ${rate.isActive ? "activated" : "deactivated"}`,
      metadata: { isActive: rate.isActive },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiRate(rate);
  }

  async removeRate(id: string, context: AuditContext) {
    const rate = await this.prisma.shippingRate.findUnique({ where: { id } });
    if (!rate) throw new NotFoundException("Shipping rate not found");

    await this.prisma.shippingRate.delete({ where: { id } });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_rate.delete",
      entityType: "ShippingRate",
      entityId: id,
      summary: `Deleted shipping rate "${rate.name}"`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }

  // ------------------------------------------------------------ profiles (admin)

  private toApiProfile(profile: {
    id: string;
    name: string;
    packageWeightGram: number;
    packageLengthMm: number | null;
    packageWidthMm: number | null;
    packageHeightMm: number | null;
    shippingClass: ShippingClass;
    calculationMethod: string;
    packageModel: string;
    handlingFee: Prisma.Decimal;
    insuranceFee: Prisma.Decimal;
    fragileFee: Prisma.Decimal;
    oversizedFee: Prisma.Decimal;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: profile.id,
      name: profile.name,
      packageWeightGram: profile.packageWeightGram,
      packageLengthMm: profile.packageLengthMm,
      packageWidthMm: profile.packageWidthMm,
      packageHeightMm: profile.packageHeightMm,
      shippingClass: profile.shippingClass,
      calculationMethod: profile.calculationMethod,
      packageModel: profile.packageModel,
      handlingFee: Number(profile.handlingFee),
      insuranceFee: Number(profile.insuranceFee),
      fragileFee: Number(profile.fragileFee),
      oversizedFee: Number(profile.oversizedFee),
      isDefault: profile.isDefault,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  async listProfiles() {
    const profiles = await this.prisma.shippingProfile.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return profiles.map((profile) => this.toApiProfile(profile));
  }

  async createProfile(dto: CreateShippingProfileDto, context: AuditContext) {
    const profile = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.shippingProfile.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.shippingProfile.create({
        data: {
          name: dto.name,
          packageWeightGram: dto.packageWeightGram,
          packageLengthMm: dto.packageLengthMm ?? null,
          packageWidthMm: dto.packageWidthMm ?? null,
          packageHeightMm: dto.packageHeightMm ?? null,
          shippingClass: dto.shippingClass ?? "Standard",
          calculationMethod: dto.calculationMethod ?? "CarrierAPI",
          packageModel: dto.packageModel ?? "SinglePackageTotalWeight",
          handlingFee: new Prisma.Decimal(dto.handlingFee ?? 0),
          insuranceFee: new Prisma.Decimal(dto.insuranceFee ?? 0),
          fragileFee: new Prisma.Decimal(dto.fragileFee ?? 0),
          oversizedFee: new Prisma.Decimal(dto.oversizedFee ?? 0),
          isDefault: dto.isDefault ?? false,
        },
      });
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_profile.create",
      entityType: "ShippingProfile",
      entityId: profile.id,
      summary: `Created shipping profile "${profile.name}"`,
      metadata: { isDefault: profile.isDefault, shippingClass: profile.shippingClass },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiProfile(profile);
  }

  async updateProfile(id: string, dto: UpdateShippingProfileDto, context: AuditContext) {
    const existing = await this.prisma.shippingProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Shipping profile not found");

    const profile = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.shippingProfile.updateMany({
          where: { id: { not: id }, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.shippingProfile.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.packageWeightGram !== undefined ? { packageWeightGram: dto.packageWeightGram } : {}),
          ...(dto.packageLengthMm !== undefined ? { packageLengthMm: dto.packageLengthMm } : {}),
          ...(dto.packageWidthMm !== undefined ? { packageWidthMm: dto.packageWidthMm } : {}),
          ...(dto.packageHeightMm !== undefined ? { packageHeightMm: dto.packageHeightMm } : {}),
          ...(dto.shippingClass !== undefined ? { shippingClass: dto.shippingClass } : {}),
          ...(dto.calculationMethod !== undefined ? { calculationMethod: dto.calculationMethod } : {}),
          ...(dto.packageModel !== undefined ? { packageModel: dto.packageModel } : {}),
          ...(dto.handlingFee !== undefined ? { handlingFee: new Prisma.Decimal(dto.handlingFee) } : {}),
          ...(dto.insuranceFee !== undefined ? { insuranceFee: new Prisma.Decimal(dto.insuranceFee) } : {}),
          ...(dto.fragileFee !== undefined ? { fragileFee: new Prisma.Decimal(dto.fragileFee) } : {}),
          ...(dto.oversizedFee !== undefined ? { oversizedFee: new Prisma.Decimal(dto.oversizedFee) } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        },
      });
    });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_profile.update",
      entityType: "ShippingProfile",
      entityId: profile.id,
      summary: `Updated shipping profile "${profile.name}"`,
      metadata: dto,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.toApiProfile(profile);
  }

  async removeProfile(id: string, context: AuditContext) {
    const profile = await this.prisma.shippingProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException("Shipping profile not found");

    await this.prisma.shippingProfile.delete({ where: { id } });

    await this.audit.log({
      adminId: context.adminId,
      action: "shipping_profile.delete",
      entityType: "ShippingProfile",
      entityId: id,
      summary: `Deleted shipping profile "${profile.name}"`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { ok: true };
  }
}
