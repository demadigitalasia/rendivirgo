import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { BadRequestException } from "@nestjs/common";

export type XlsxRow = { rowNumber: number; values: unknown[] };
export type XlsxTable = { sheetName: string; headers: unknown[]; rows: XlsxRow[] };

const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 100;

function attribute(xml: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return xml.match(new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`))?.[1];
}

function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "lt") return "<";
    if (normalized === "gt") return ">";
    if (normalized === "quot") return '"';
    if (normalized === "apos") return "'";
    const point = normalized.startsWith("#x") ? Number.parseInt(normalized.slice(2), 16) : Number.parseInt(normalized.slice(1), 10);
    return Number.isFinite(point) && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return 0;
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

function assertSafeZip(buffer: Buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const searchStart = Math.max(0, buffer.byteLength - 65_557);
  let eocd = -1;
  for (let offset = buffer.byteLength - 22; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new BadRequestException("The uploaded file is not a valid XLSX workbook.");

  const entryCount = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  let cursor = view.getUint32(eocd + 16, true);
  if (entryCount > MAX_ZIP_ENTRIES || cursor + directorySize > buffer.byteLength) {
    throw new BadRequestException("The workbook contains an unsupported number of files.");
  }

  let uncompressedBytes = 0;
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (cursor + 46 > buffer.byteLength || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new BadRequestException("The uploaded file is not a valid XLSX workbook.");
    }
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    uncompressedBytes += uncompressedSize;
    if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new BadRequestException("The uncompressed workbook is too large to import.");
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
}

function normalizeZipPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.replace(/^\//, "").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments.join("/");
}

function getXml(files: Record<string, Uint8Array>, path: string): string {
  const file = files[path];
  if (!file) throw new BadRequestException("The workbook is missing a required XLSX component.");
  return strFromU8(file);
}

function sharedStringsFrom(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<(?:[\w.-]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?si>/g)].map(([, content]) =>
    [...content.matchAll(/<(?:[\w.-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t>/g)].map(([, text]) => decodeXml(text)).join(""),
  );
}

function cellValue(attrs: string, content: string, sharedStrings: string[]): unknown {
  const type = attribute(attrs, "t");
  if (type === "inlineStr") {
    return [...content.matchAll(/<(?:[\w.-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t>/g)]
      .map(([, text]) => decodeXml(text))
      .join("");
  }

  const raw = content.match(/<(?:[\w.-]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?v>/)?.[1];
  if (raw === undefined) return "";
  const value = decodeXml(raw);
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  if (type === "b") return value === "1";
  if (type === "str" || type === "e") return value;
  const numeric = Number(value);
  return value.trim() !== "" && Number.isFinite(numeric) ? numeric : value;
}

function rowsFromWorksheet(xml: string, sharedStrings: string[]): XlsxRow[] {
  const rows: XlsxRow[] = [];
  let fallbackRow = 0;
  for (const match of xml.matchAll(/<(?:[\w.-]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?row>/g)) {
    fallbackRow += 1;
    const rowNumber = Number(attribute(match[1], "r")) || fallbackRow;
    const values: unknown[] = [];
    for (const cell of match[2].matchAll(/<(?:[\w.-]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?c>)/g)) {
      const reference = attribute(cell[1], "r") ?? "";
      const index = columnIndex(reference);
      if (index >= 0) values[index] = cellValue(cell[1], cell[2] ?? "", sharedStrings);
    }
    rows.push({ rowNumber, values });
  }
  return rows;
}

export function parseXlsxTable(buffer: Buffer, preferredSheetName: string): XlsxTable {
  assertSafeZip(buffer);
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buffer);
  } catch {
    throw new BadRequestException("The uploaded file could not be opened as an XLSX workbook.");
  }

  const workbookXml = getXml(files, "xl/workbook.xml");
  const relationshipsXml = getXml(files, "xl/_rels/workbook.xml.rels");
  const relationships = new Map<string, string>();
  for (const [, attrs] of relationshipsXml.matchAll(/<(?:[\w.-]+:)?Relationship\b([^>]*?)\/?\s*>/g)) {
    const id = attribute(attrs, "Id");
    const target = attribute(attrs, "Target");
    if (id && target) relationships.set(id, normalizeZipPath(target.startsWith("/") ? target : `xl/${target}`));
  }

  const sheets = [...workbookXml.matchAll(/<(?:[\w.-]+:)?sheet\b([^>]*?)\/?\s*>/g)].map(([, attrs]) => ({
    name: decodeXml(attribute(attrs, "name") ?? ""),
    path: relationships.get(attribute(attrs, "r:id") ?? ""),
  }));
  const selected = sheets.find((sheet) => sheet.name.toLowerCase() === preferredSheetName.toLowerCase()) ?? sheets[0];
  if (!selected?.path) throw new BadRequestException("The workbook does not contain a readable worksheet.");

  const sharedStrings = sharedStringsFrom(files["xl/sharedStrings.xml"] ? strFromU8(files["xl/sharedStrings.xml"]) : undefined);
  const rows = rowsFromWorksheet(getXml(files, selected.path), sharedStrings);
  if (!rows.length) throw new BadRequestException("The selected worksheet is empty.");
  return { sheetName: selected.name, headers: rows[0].values, rows: rows.slice(1) };
}

export type XlsxSheetData = { name: string; headers: string[]; rows: unknown[][] };

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnLetters(index: number): string {
  let value = index + 1;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function xmlCell(value: unknown, reference: string): string {
  if (value === null || value === undefined || value === "") return `<c r="${reference}"/>`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}" t="n"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(value))}</t></is></c>`;
}

function worksheetXml(sheet: XlsxSheetData, index: number): string {
  const allRows = [sheet.headers, ...sheet.rows];
  const rowsXml = allRows.map((values, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = values.map((value, columnIndexValue) => xmlCell(value, `${columnLetters(columnIndexValue)}${rowNumber}`)).join("");
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join("");
  const lastColumn = columnLetters(Math.max(0, sheet.headers.length - 1));
  const lastRow = Math.max(1, allRows.length);
  const autoFilter = index === 1 && sheet.headers.length ? `<autoFilter ref="A1:${lastColumn}${lastRow}"/>` : "";
  const freezeHeader = index === 1
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/>${freezeHeader}<sheetData>${rowsXml}</sheetData>${autoFilter}</worksheet>`;
}

export function createXlsxBuffer(sheets: XlsxSheetData[]): Buffer {
  const workbookSheets = sheets.map((sheet, index) =>
    `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
  ).join("");
  const relationshipEntries = sheets.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  const overrides = sheets.map((_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationshipEntries}</Relationships>`),
  };

  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet, index + 1));
  });
  return Buffer.from(zipSync(files, { level: 6 }));
}
