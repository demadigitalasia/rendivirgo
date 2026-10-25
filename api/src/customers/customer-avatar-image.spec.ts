import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { prepareCustomerAvatar } from "./customer-avatar-image";

function jpegFixture(width = 32, height = 24): Buffer {
  const exif = Buffer.from([0xff, 0xe1, 0x00, 0x06, 0x45, 0x58, 0x49, 0x46]);
  const frame = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00]);
  const scan = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), exif, frame, scan]);
}

test("prepares a JPEG avatar and removes EXIF segments", () => {
  const prepared = prepareCustomerAvatar(jpegFixture(), "image/jpeg");
  assert.equal(prepared.mime, "image/jpeg");
  assert.equal(prepared.extension, ".jpg");
  assert.equal(prepared.buffer.includes(Buffer.from("EXIF")), false);
});

test("rejects a declared MIME that does not match the file signature", () => {
  assert.throws(() => prepareCustomerAvatar(jpegFixture(), "image/png"), BadRequestException);
});

test("rejects oversized avatar dimensions", () => {
  assert.throws(() => prepareCustomerAvatar(jpegFixture(5000, 24), "image/jpeg"), BadRequestException);
});

test("rejects unsupported and non-image files", () => {
  assert.throws(() => prepareCustomerAvatar(Buffer.from("<svg/>", "utf8"), "image/png"), BadRequestException);
});
