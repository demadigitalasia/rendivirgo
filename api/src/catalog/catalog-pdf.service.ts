import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ProductWithRelations } from "./products.service";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const INK = "#1c201d";
const MUTED = "#6b7069";
const FOREST = "#103b2c";
const FOREST_DEEP = "#08261d";
const JADE = "#477d68";
const BRONZE = "#b08a53";
const LINE = "#ddd7cb";
const SURFACE = "#fffefa";
const BG = "#f2f0ea";

export type CatalogPdfOptions = {
  includePrice: boolean;
};

@Injectable()
export class CatalogPdfService {
  async generate(products: ProductWithRelations[], options: CatalogPdfOptions): Promise<Buffer> {
    const document = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, compress: true });
    const chunks: Buffer[] = [];

    document.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));

    const finished = new Promise<Buffer>((resolvePromise, reject) => {
      document.on("end", () => resolvePromise(Buffer.concat(chunks)));
      document.on("error", reject);
    });

    this.drawCover(document, products.length);
    const productsPerPage = 4;
    const pageCount = Math.max(1, Math.ceil(products.length / productsPerPage));

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      document.addPage({ size: "A4", margin: 0 });
      this.drawCollectionHeader(document, pageIndex + 2, pageCount + 1);
      const pageProducts = products.slice(pageIndex * productsPerPage, pageIndex * productsPerPage + productsPerPage);
      for (let index = 0; index < pageProducts.length; index += 1) {
        await this.drawProductCard(document, pageProducts[index], 84 + index * 171, options.includePrice);
      }
      this.drawFooter(document, pageIndex + 2, pageCount + 1);
    }

    document.end();
    return finished;
  }

  private drawCover(document: PDFKit.PDFDocument, productCount: number) {
    document.addPage({ size: "A4", margin: 0 });
    document.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(BG);
    document.rect(0, 0, PAGE_WIDTH, 210).fill(FOREST_DEEP);
    document.rect(42, 52, 44, 44).fill(BRONZE);
    document.fillColor(FOREST_DEEP).font("Helvetica-Bold").fontSize(22).text("RV", 50, 62, { width: 28, align: "center" });

    document.fillColor(FOREST).font("Helvetica-Bold").fontSize(24).text("RENDI VIRGO", 42, 246);
    document.fillColor(JADE).font("Helvetica").fontSize(11).text("SELECTED GEMSTONE COLLECTION", 44, 284, { characterSpacing: 1.2 });
    document.moveTo(44, 315).lineTo(190, 315).lineWidth(2).strokeColor(BRONZE).stroke();
    document.fillColor(INK).font("Helvetica").fontSize(12).text(
      "A curated collection prepared from currently available pieces in the RENDI VIRGO catalog.",
      44,
      350,
      { width: 390, lineGap: 5 },
    );

    document.roundedRect(44, 465, 507, 126, 10).fill(SURFACE);
    document.fillColor(MUTED).font("Helvetica").fontSize(9).text("AVAILABLE COLLECTION", 70, 496, { characterSpacing: 1 });
    document.fillColor(FOREST).font("Helvetica-Bold").fontSize(34).text(String(productCount), 70, 518);
    document.fillColor(MUTED).font("Helvetica").fontSize(11).text(productCount === 1 ? "available piece" : "available pieces", 126, 536);
    document.fillColor(MUTED).fontSize(9).text("Generated from live published stock", 70, 566);

    document.fillColor(MUTED).font("Helvetica").fontSize(9).text("Prepared for client presentation", 44, PAGE_HEIGHT - 58);
    document.fillColor(BRONZE).font("Helvetica-Bold").fontSize(9).text("RENDI VIRGO", PAGE_WIDTH - 150, PAGE_HEIGHT - 58, { width: 106, align: "right" });
  }

  private drawCollectionHeader(document: PDFKit.PDFDocument, page: number, totalPages: number) {
    document.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(SURFACE);
    document.fillColor(FOREST).font("Helvetica-Bold").fontSize(15).text("RENDI VIRGO", 42, 32);
    document.fillColor(MUTED).font("Helvetica").fontSize(9).text("Available gemstone collection", 42, 54);
    document.fillColor(BRONZE).font("Helvetica-Bold").fontSize(9).text(`${page}/${totalPages}`, PAGE_WIDTH - 92, 38, { width: 50, align: "right" });
    document.moveTo(42, 73).lineTo(PAGE_WIDTH - 42, 73).lineWidth(0.7).strokeColor(LINE).stroke();
  }

  private async drawProductCard(document: PDFKit.PDFDocument, product: ProductWithRelations, top: number, includePrice: boolean) {
    const x = 42;
    const width = PAGE_WIDTH - 84;
    const imageX = x + 18;
    const imageY = top + 23;
    const imageWidth = 84;
    const imageHeight = 118;
    const textX = imageX + imageWidth + 16;
    const textWidth = width - (textX - x) - 18;

    document.roundedRect(x, top, width, 165, 10).fillAndStroke(BG, LINE);
    document.roundedRect(imageX, imageY, imageWidth, imageHeight, 7).fill("#ebe7dc");
    await this.drawProductImage(document, product.images[0]?.url, imageX, imageY, imageWidth, imageHeight);

    document.fillColor(BRONZE).font("Helvetica-Bold").fontSize(7.5).text(product.category.name.toUpperCase(), textX, top + 14, { width: textWidth, characterSpacing: 0.7 });
    document.fillColor(FOREST).font("Helvetica-Bold").fontSize(12.5).text(this.truncate(this.clean(product.name), 60), textX, top + 29, { width: textWidth, height: 17, lineGap: 1 });
    document.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(`SKU ${this.clean(product.sku)}`, textX, top + 50, { width: textWidth });

    let cursor = top + 68;
    const details = [
      ["Stone", product.stoneType],
      ["Origin", product.origin],
      ["Condition", product.condition],
      ["Weight", `${product.weightGram} g${product.weightCarat ? ` · ${product.weightCarat} ct` : ""}`],
      ["Size", this.dimensions(product)],
    ];

    for (const [label, value] of details) {
      document.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(label.toUpperCase(), textX, cursor, { width: 58, characterSpacing: 0.4 });
      document.fillColor(INK).font("Helvetica").fontSize(7.7).text(this.clean(value), textX + 60, cursor, { width: textWidth - 60 });
      cursor += 10.5;
    }

    document.moveTo(textX, top + 116).lineTo(x + width - 18, top + 116).lineWidth(0.5).strokeColor(LINE).stroke();
    const description = this.clean(product.description).trim();
    if (description) {
      document.fillColor(MUTED).font("Helvetica").fontSize(6.8).text(this.truncate(description, 180), textX, top + 122, { width: textWidth, height: 12, lineGap: 1 });
    }
    document.fillColor(JADE).font("Helvetica-Bold").fontSize(7.5).text(this.stockLabel(product), textX, top + 140, { width: textWidth });
    if (includePrice) {
      document.fillColor(FOREST).font("Helvetica-Bold").fontSize(11).text(this.price(product), textX, top + 151);
    }
  }

  private async drawProductImage(document: PDFKit.PDFDocument, url: string | undefined, x: number, y: number, width: number, height: number) {
    if (!url) {
      this.drawImageFallback(document, x, y, width, height);
      return;
    }

    try {
      const buffer = await this.readAsset(url);
      if (!buffer) {
        this.drawImageFallback(document, x, y, width, height);
        return;
      }
      const text = buffer.toString("utf8");
      if (/^\s*(<\?xml|<svg[\s>])/i.test(text)) {
        SVGtoPDF(document, text, x, y, { width, height, preserveAspectRatio: "xMidYMid meet" });
        return;
      }
      document.image(buffer, x, y, { fit: [width, height], align: "center", valign: "center" });
    } catch {
      this.drawImageFallback(document, x, y, width, height);
    }
  }

  private async readAsset(url: string): Promise<Buffer | null> {
    if (url.startsWith("data:")) {
      const [, encoded] = url.split(",", 2);
      return encoded ? Buffer.from(encoded, "base64") : null;
    }

    if (/^https?:\/\//i.test(url)) {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    }

    const relative = url.replace(/^\/+/, "");
    const candidates = [
      resolve(process.cwd(), "public", relative),
      resolve(process.cwd(), relative),
      resolve(process.cwd(), "..", "public", relative),
      resolve(process.cwd(), "uploads", relative.replace(/^uploads\/+/, "")),
    ];

    for (const candidate of candidates) {
      try {
        return await readFile(candidate);
      } catch {
        // Try the next known application root.
      }
    }
    return null;
  }

  private drawImageFallback(document: PDFKit.PDFDocument, x: number, y: number, width: number, height: number) {
    document.fillColor("#d8d2c5").font("Helvetica-Bold").fontSize(10).text("RENDI VIRGO", x, y + height / 2 - 8, { width, align: "center" });
  }

  private drawFooter(document: PDFKit.PDFDocument, page: number, totalPages: number) {
    document.moveTo(42, PAGE_HEIGHT - 48).lineTo(PAGE_WIDTH - 42, PAGE_HEIGHT - 48).lineWidth(0.5).strokeColor(LINE).stroke();
    document.fillColor(MUTED).font("Helvetica").fontSize(8).text("Prices and availability are subject to change.", 42, PAGE_HEIGHT - 34);
    document.fillColor(MUTED).fontSize(8).text(`Page ${page} of ${totalPages}`, PAGE_WIDTH - 110, PAGE_HEIGHT - 34, { width: 68, align: "right" });
  }

  private stockLabel(product: ProductWithRelations) {
    if (product.stockModel === "Unique") return "AVAILABLE · UNIQUE PIECE";
    const quantity = product.stockQuantity ?? 0;
    return `AVAILABLE · ${quantity} IN STOCK`;
  }

  private price(product: ProductWithRelations) {
    return `${product.currency} ${Number(product.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private dimensions(product: ProductWithRelations) {
    const values = [product.lengthMm, product.widthMm, product.heightMm].filter((value): value is number => value !== null);
    return values.length ? `${values.join(" × ")} mm` : "Not specified";
  }

  private clean(value: string | number) {
    return String(value).replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1).trim()}...` : value;
  }
}
