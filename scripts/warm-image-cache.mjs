#!/usr/bin/env node
/**
 * Warm the next/image optimizer cache after a deploy: pre-generate the common
 * device-width variants for every active hero slide (and any extra paths passed
 * as arguments) so real visitors never hit the ~1s cold-generation penalty.
 *
 * Usage: node scripts/warm-image-cache.mjs [base-url] [extra-image-path ...]
 * Defaults to https://rendivirgo.com.
 */
const base = (process.argv[2] ?? "https://rendivirgo.com").replace(/\/+$/, "");
const extraPaths = process.argv.slice(3);
const widths = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
const accepts = ["image/avif,image/webp,*/*", "image/webp,*/*"];

const slides = await fetch(`${base}/api/hero-slides`).then(r => r.json()).catch(() => null);
const paths = [
  ...(slides?.slides ?? []).filter(s => s.isActive).flatMap(s => [s.imageUrl, s.mobileImageUrl].filter(Boolean)),
  ...extraPaths,
];

let ok = 0;
let fail = 0;
for (const path of [...new Set(paths)]) {
  const encoded = encodeURIComponent(path);
  for (const width of widths) {
    for (const accept of accepts) {
      const url = `${base}/_next/image?url=${encoded}&w=${width}&q=75`;
      try {
        const response = await fetch(url, { headers: { accept } });
        if (response.ok) ok += 1; else { fail += 1; console.error(`  ${response.status} ${url.slice(0, 90)}`); }
      } catch (error) {
        fail += 1;
        console.error(`  ERR ${url.slice(0, 90)} ${(error).message}`);
      }
    }
  }
}
console.log(`warmed: ${ok} ok, ${fail} failed across ${paths.length} images`);
