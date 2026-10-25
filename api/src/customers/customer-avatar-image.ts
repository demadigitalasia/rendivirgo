import { BadRequestException } from "@nestjs/common";
import { detectImageType } from "../uploads/image-validation";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_DIMENSION = 4096;
const MAX_AVATAR_PIXELS = 16_000_000;

export type PreparedCustomerAvatar = { buffer: Buffer; mime: "image/jpeg" | "image/png"; extension: ".jpg" | ".png" };

function assertDimensions(width: number, height: number): void {
  if (width < 1 || height < 1 || width > MAX_AVATAR_DIMENSION || height > MAX_AVATAR_DIMENSION || width * height > MAX_AVATAR_PIXELS) {
    throw new BadRequestException("Choose an image no larger than 4096 × 4096 pixels.");
  }
}

function prepareJpeg(input: Buffer): Buffer {
  const parts = [input.subarray(0, 2)];
  let offset = 2;
  let dimensions: { width: number; height: number } | undefined;
  let reachedScan = false;

  while (offset < input.length) {
    const start = offset;
    if (input[offset] !== 0xff) throw new BadRequestException("The JPEG image is malformed.");
    while (offset < input.length && input[offset] === 0xff) offset += 1;
    if (offset >= input.length) break;
    const marker = input[offset++];

    if (marker === 0x00) throw new BadRequestException("The JPEG image is malformed.");
    if (marker === 0xd9) {
      parts.push(input.subarray(start, offset));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(input.subarray(start, offset));
      continue;
    }

    if (offset + 2 > input.length) throw new BadRequestException("The JPEG image is malformed.");
    const segmentLength = input.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > input.length) throw new BadRequestException("The JPEG image is malformed.");
    const segmentEnd = offset + segmentLength;

    const isStartOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isStartOfFrame && segmentLength >= 7) {
      const dataOffset = offset + 2;
      dimensions = { height: input.readUInt16BE(dataOffset + 1), width: input.readUInt16BE(dataOffset + 3) };
      assertDimensions(dimensions.width, dimensions.height);
    }

    if (marker === 0xda) {
      parts.push(input.subarray(start));
      reachedScan = true;
      break;
    }
    // EXIF/XMP (APP1), IPTC (APP13), and comments can carry private metadata.
    if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) parts.push(input.subarray(start, segmentEnd));
    offset = segmentEnd;
  }

  if (!dimensions || !reachedScan) throw new BadRequestException("The JPEG image is incomplete or invalid.");
  return Buffer.concat(parts);
}

function preparePng(input: Buffer): Buffer {
  const signature = input.subarray(0, 8);
  const parts = [signature];
  let offset = 8;
  let dimensions: { width: number; height: number } | undefined;
  let reachedEnd = false;

  while (offset + 12 <= input.length) {
    const start = offset;
    const dataLength = input.readUInt32BE(offset);
    const type = input.subarray(offset + 4, offset + 8).toString("ascii");
    const end = offset + 12 + dataLength;
    if (end > input.length) throw new BadRequestException("The PNG image is malformed.");

    if (!dimensions) {
      if (type !== "IHDR" || dataLength !== 13) throw new BadRequestException("The PNG image is malformed.");
      dimensions = { width: input.readUInt32BE(offset + 8), height: input.readUInt32BE(offset + 12) };
      assertDimensions(dimensions.width, dimensions.height);
    }

    // Strip EXIF and text chunks so uploaded avatars do not retain location or comment metadata.
    if (!["eXIf", "tEXt", "zTXt", "iTXt"].includes(type)) parts.push(input.subarray(start, end));
    offset = end;
    if (type === "IEND") {
      reachedEnd = true;
      break;
    }
  }

  if (!dimensions || !reachedEnd) throw new BadRequestException("The PNG image is incomplete or invalid.");
  return Buffer.concat(parts);
}

export function prepareCustomerAvatar(buffer: Buffer, declaredMime: string): PreparedCustomerAvatar {
  if (buffer.length > MAX_AVATAR_BYTES) throw new BadRequestException("The profile photo must be 5 MB or smaller.");
  const detected = detectImageType(buffer);
  if (!detected || detected.mime !== declaredMime || (detected.mime !== "image/jpeg" && detected.mime !== "image/png")) {
    throw new BadRequestException("Choose a valid JPEG or PNG profile photo.");
  }

  return detected.mime === "image/jpeg"
    ? { buffer: prepareJpeg(buffer), mime: "image/jpeg", extension: ".jpg" }
    : { buffer: preparePng(buffer), mime: "image/png", extension: ".png" };
}
