import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const socialDir = path.join(root, "public", "social");
const colors = {
  forest: "#103b2c",
  forestDeep: "#08261d",
  jade: "#477d68",
  ivory: "#f7f4ee",
  paper: "#fcfaf6",
  line: "#d8d1c5",
  bronze: "#b08a53",
  bronzeLight: "#d9bc8b",
  ink: "#1c201d",
  muted: "#6b7069",
};

const xml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const svg = (content) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">${content}</svg>`);

const overlay = svg(`
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${colors.ivory}" stop-opacity="0.99" />
      <stop offset="0.78" stop-color="${colors.ivory}" stop-opacity="0.96" />
      <stop offset="1" stop-color="${colors.ivory}" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="imageShade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${colors.forestDeep}" stop-opacity="0.04" />
      <stop offset="1" stop-color="${colors.forestDeep}" stop-opacity="0.32" />
    </linearGradient>
  </defs>
  <rect width="720" height="1080" fill="url(#panel)" />
  <rect width="1080" height="1080" fill="url(#imageShade)" />
  <rect x="36" y="36" width="1008" height="1008" fill="none" stroke="${colors.bronzeLight}" stroke-width="1" opacity="0.32" />
  <text x="60" y="278" fill="${colors.jade}" font-family="Arial, Helvetica, sans-serif" font-size="17px" font-weight="600" letter-spacing="4.5px">THE COLLECTION</text>
  <text x="60" y="388" fill="${colors.forestDeep}" font-family="Georgia, Times New Roman, serif" font-size="64px">Aqua</text>
  <text x="60" y="462" fill="${colors.forestDeep}" font-family="Georgia, Times New Roman, serif" font-size="64px">Cabochons</text>
  <line x1="62" y1="506" x2="124" y2="506" stroke="${colors.bronze}" stroke-width="3" />
  <text x="62" y="560" fill="${colors.ink}" font-family="Georgia, Times New Roman, serif" font-size="24px">Natural color, quiet character.</text>
  <text x="62" y="598" fill="${colors.muted}" font-family="Arial, Helvetica, sans-serif" font-size="16px" letter-spacing="1.5px">SELECTED IN INDONESIA</text>
  <line x1="60" y1="942" x2="1020" y2="942" stroke="${colors.bronzeLight}" stroke-width="1" opacity="0.72" />
  <text x="60" y="981" fill="${colors.forest}" font-family="Arial, Helvetica, sans-serif" font-size="14px" font-weight="600" letter-spacing="2.8px">FROM INDONESIA TO THE WORLD</text>
  <text x="1020" y="981" fill="${colors.bronzeLight}" font-family="Arial, Helvetica, sans-serif" font-size="14px" font-weight="600" letter-spacing="2px" text-anchor="end">RENDI VIRGO</text>
  <rect x="736" y="60" width="264" height="34" rx="2" fill="${colors.forestDeep}" opacity="0.86" />
  <text x="868" y="83" fill="${colors.bronzeLight}" font-family="Arial, Helvetica, sans-serif" font-size="11px" font-weight="600" letter-spacing="2.5px" text-anchor="middle">NATURAL STONES</text>
`);

const logo = await sharp(path.join(root, "public", "brand", "rendi-virgo-logo.png"))
  .resize({ width: 310 })
  .toBuffer();

const background = await sharp(path.join(socialDir, "img-1878-aqua-stones-editorial.png"))
  .resize(1080, 1080, { fit: "cover", position: "center" })
  .modulate({ brightness: 0.94, saturation: 0.88 })
  .toBuffer();

await sharp(background)
  .composite([
    { input: overlay },
    { input: logo, top: 58, left: 58 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(socialDir, "rendi-virgo-post-img1878-aqua-cabochons.png"));

console.log("Created public/social/rendi-virgo-post-img1878-aqua-cabochons.png");
