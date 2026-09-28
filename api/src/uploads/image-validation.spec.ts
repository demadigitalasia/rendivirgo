import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectImageType } from "./image-validation";

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const gif = Buffer.concat([Buffer.from("GIF89a", "ascii"), Buffer.alloc(16)]);
const webp = Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.alloc(4), Buffer.from("WEBP", "ascii"), Buffer.alloc(8)]);
const avif = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypavif", "ascii"), Buffer.alloc(8)]);

describe("detectImageType", () => {
  it("detects the supported raster formats", () => {
    assert.equal(detectImageType(jpeg)?.mime, "image/jpeg");
    assert.equal(detectImageType(jpeg)?.extension, ".jpg");
    assert.equal(detectImageType(png)?.mime, "image/png");
    assert.equal(detectImageType(gif)?.mime, "image/gif");
    assert.equal(detectImageType(webp)?.mime, "image/webp");
    assert.equal(detectImageType(avif)?.mime, "image/avif");
  });

  it("rejects SVG so it can never be stored and served inline", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.equal(detectImageType(svg), null);
  });

  it("rejects HTML and script payloads disguised as images", () => {
    assert.equal(detectImageType(Buffer.from("<html><body>hi</body></html>")), null);
    assert.equal(detectImageType(Buffer.from("<script>alert(1)</script>")), null);
  });

  it("rejects truncated or empty buffers", () => {
    assert.equal(detectImageType(Buffer.alloc(0)), null);
    assert.equal(detectImageType(Buffer.from([0xff, 0xd8])), null);
    assert.equal(detectImageType(Buffer.from("GIF")), null);
  });

  it("rejects a RIFF container that is not WebP", () => {
    const wav = Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.alloc(4), Buffer.from("WAVE", "ascii"), Buffer.alloc(8)]);
    assert.equal(detectImageType(wav), null);
  });
});
