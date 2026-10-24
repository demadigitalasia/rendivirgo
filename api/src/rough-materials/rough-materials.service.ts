import { internationalWhatsAppNumber } from "../common/utils/whatsapp";
import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { RoughMaterial } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { AuditService } from "../audit/audit.service";
import type { AuditContext } from "../common/types/audit-context";
import { RoughQuoteDto, SaveRoughMaterialDto } from "./rough-materials.dto";
import { calculateRoughQuote, ROUGH_MAX_TYPES, ROUGH_MINIMUM_KG } from "./rough-materials.quote";

@Injectable()
export class RoughMaterialsService {
  constructor(private readonly prisma: PrismaService, private readonly settings: SettingsService, private readonly audit: AuditService) {}

  private publicMaterial(row: RoughMaterial) {
    return { id: row.id, sku: row.sku, name: row.name, stoneType: row.stoneType, origin: row.origin, description: row.description, sizeNotes: row.sizeNotes, images: row.images, pricePerKg: Number(row.pricePerKg), availableKg: row.availableKg === null ? null : Number(row.availableKg), isAvailable: row.isAvailable, currency: "USD" };
  }

  async catalog() {
    const rows = await this.prisma.roughMaterial.findMany({ where: { isPublished: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    return { items: rows.map((row) => this.publicMaterial(row)), minimumKg: ROUGH_MINIMUM_KG, maxTypes: ROUGH_MAX_TYPES };
  }

  async listAdmin() {
    const rows = await this.prisma.roughMaterial.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    return rows.map((row) => ({ ...this.publicMaterial(row), isPublished: row.isPublished, sortOrder: row.sortOrder }));
  }

  async save(id: string | null, input: SaveRoughMaterialDto, context: AuditContext) {
    if (input.isPublished && (!input.images.length || !input.description.trim())) throw new BadRequestException("Add a photo and material information before publishing");
    for (const image of input.images) {
      if (!/^\/(?:uploads|images)\//.test(image) && !/^https?:\/\//.test(image)) throw new BadRequestException("Use an uploaded image or an HTTP(S) image URL");
    }
    if (id && !(await this.prisma.roughMaterial.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException("Material not found");
    try {
      const data = { ...input, sku: input.sku.trim(), name: input.name.trim(), availableKg: input.availableKg ?? null };
      const row = id ? await this.prisma.roughMaterial.update({ where: { id }, data }) : await this.prisma.roughMaterial.create({ data });
      await this.audit.log({ adminId: context.adminId, action: id ? "rough_material.update" : "rough_material.create", entityType: "RoughMaterial", entityId: row.id, summary: `${id ? "Updated" : "Created"} rough material ${row.sku}`, ip: context.ip, userAgent: context.userAgent });
      return { ...this.publicMaterial(row), isPublished: row.isPublished, sortOrder: row.sortOrder };
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException("Material name or SKU already exists");
      throw error;
    }
  }

  async quote(input: RoughQuoteDto) {
    const rows = await this.prisma.roughMaterial.findMany({ where: { id: { in: input.items.map((item) => item.materialId) } } });
    const quote = calculateRoughQuote(input.items, rows.map((row) => ({ ...row, pricePerKg: Number(row.pricePerKg), availableKg: row.availableKg === null ? null : Number(row.availableKg) })));
    const settings = await this.settings.getPublicSettings();
    const whatsapp = [settings["store.whatsapp"], settings["store.whatsappSecondary"]].map(internationalWhatsAppNumber).find((digits) => digits !== null) || null;
    const email = String(settings["store.email"] || "").trim();
    const reference = `RM-${randomUUID().toUpperCase()}`;
    const quotedAt = new Date().toISOString();
    const text = [`Inquiry reference: ${reference}`, `Estimate checked: ${quotedAt}`, "", "Hello RENDI VIRGO, I would like to request a Rough Materials quotation.", "", ...quote.lines.map((line) => `${line.sku} — ${line.name}: ${line.quantityKg.toLocaleString("en-US")} kg × USD ${line.pricePerKg.toFixed(2)}/kg = USD ${line.subtotal.toFixed(2)}`), "", `Total weight: ${quote.totalKg.toLocaleString("en-US")} kg (${quote.totalKg / 1000} metric tons)`, `Estimated material total: USD ${quote.total.toFixed(2)}`, ...(input.country?.trim() ? [`Destination country: ${input.country.trim()}`] : []), ...(input.port?.trim() ? [`Destination port: ${input.port.trim()}`] : []), "", "Please confirm availability, actual weight, shipping and the final price. This is an inquiry, not a confirmed order."].join("\n");
    return { ...quote, reference, quotedAt, requestText: text, whatsappUrl: whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}` : null, emailUrl: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}?subject=${encodeURIComponent("Rough Materials inquiry — RENDI VIRGO")}&body=${encodeURIComponent(text)}` : null, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
  }
}
