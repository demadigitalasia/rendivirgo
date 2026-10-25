import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const names = ["oval", "round", "teardrop", "long-oval", "cushion", "freeform", "pear", "marquise"];
const folder = new URL("../public/images/lapidary/shapes/cad/", import.meta.url);

for (const name of names) {
  const file = new URL(`${name}.png`, folder);
  const rendered = await readFile(file);
  const content = await sharp(rendered).trim().resize(440, 440, { fit: "inside" }).toBuffer();
  const { width, height } = await sharp(content).metadata();
  const left = Math.floor((512 - width) / 2);
  const top = Math.floor((512 - height) / 2);
  const png = await sharp(content).extend({
    left, right: 512 - width - left, top, bottom: 512 - height - top,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png({ compressionLevel: 9 }).toBuffer();
  const metadata = await sharp(png).metadata();
  const stats = await sharp(png).stats();
  if (!metadata.hasAlpha || stats.channels[3]?.min !== 0 || stats.channels[3]?.max !== 255) {
    throw new Error(`${name} must retain transparent and opaque pixels`);
  }
  await writeFile(file, png);
  console.log(`${name}: 512×512 transparent PNG — ${fileURLToPath(file)}`);
}
