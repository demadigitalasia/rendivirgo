import { BadRequestException } from "@nestjs/common";
import { parseXlsxTable } from "../settings/xlsx";

export const importColumns = ["sku", "name", "categorySlug", "stoneType", "origin", "price", "currency", "unit", "stockModel", "stockQuantity", "weightGram", "weightCarat", "lengthMm", "widthMm", "heightMm", "condition", "description", "featured", "fragile"];
export type ImportRecord = Record<string, string>;

// Parse complete records so quoted descriptions can contain commas and newlines.
export function parseProductCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else if (quoted || !value) quoted = !quoted;
      else throw new BadRequestException("Unexpected quote in CSV");
    } else if (!quoted && (char === "," || char === "\n" || char === "\r")) {
      row.push(value); value = "";
      if (char !== ",") {
        if (row.some(cell => cell.trim())) rows.push(row);
        row = [];
        if (char === "\r" && text[i + 1] === "\n") i++;
      }
    } else value += char;
  }
  if (quoted) throw new BadRequestException("Unclosed quote in CSV");
  row.push(value);
  if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}

export function readProductTable(file: { originalname: string; buffer: Buffer }): ImportRecord[] {
  let headers: unknown[], rows: unknown[][];
  if (/\.xlsx$/i.test(file.originalname)) {
    const table = parseXlsxTable(file.buffer, "Products");
    headers = table.headers; rows = table.rows.map(row => row.values);
  } else if (/\.csv$/i.test(file.originalname)) {
    const table = parseProductCsv(file.buffer.toString("utf8"));
    headers = table[0] ?? []; rows = table.slice(1);
  } else throw new BadRequestException("Choose a .xlsx or .csv file");
  const columns = headers.map(header => String(header ?? "").trim());
  if (!columns.includes("sku")) throw new BadRequestException("The sku column is required");
  if (new Set(columns).size !== columns.length || columns.some(column => !importColumns.includes(column))) {
    throw new BadRequestException("Duplicate or unsupported columns. Use the product template.");
  }
  rows = rows.filter(row => row.some(value => String(value ?? "").trim()));
  if (!rows.length || rows.length > 500) throw new BadRequestException("Import between 1 and 500 products per file");
  return rows.map(row => Object.fromEntries(columns.map((column, i) => [column, String(row[i] ?? "").trim()])));
}

export function matchPhoto(filename: string, skus: string[]): string | undefined {
  const stem = filename.replace(/\.[^.]+$/, "");
  // Exact matches take precedence over numbered photos of a shorter SKU.
  if (skus.includes(stem)) return stem;
  return [...skus].sort((a, b) => b.length - a.length).find(sku =>
    stem.startsWith(`${sku}-`) && /^\d+$/.test(stem.slice(sku.length + 1)));
}
