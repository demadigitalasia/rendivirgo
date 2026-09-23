import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const socialDir = path.join(root, "public", "social");
const brandDir = path.join(root, "public", "brand");
const imageDir = path.join(root, "public", "images");

const colors = {
  forest: "#103b2c",
  forestDeep: "#08261d",
  jade: "#477d68",
  ivory: "#f7f4ee",
  paper: "#fcfaf6",
  sand: "#e6dfd2",
  line: "#d8d1c5",
  bronze: "#b08a53",
  bronzeLight: "#d9bc8b",
  ink: "#1c201d",
  muted: "#6b7069",
};

const escapeXml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const text = (value, x, y, options = {}) => {
  const {
    fill = colors.ink,
    size = 24,
    family = "Georgia, Times New Roman, serif",
    weight = 400,
    letterSpacing = 0,
    anchor = "start",
    style = "normal",
    opacity = 1,
  } = options;
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}px" font-weight="${weight}" letter-spacing="${letterSpacing}px" text-anchor="${anchor}" font-style="${style}" opacity="${opacity}">${escapeXml(value)}</text>`;
};

const line = (x1, y1, x2, y2, stroke = colors.bronzeLight, width = 2, opacity = 1) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}" />`;

const svg = (content) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">${content}</svg>`);

const image = (file) => path.join(root, file);

async function logoPlate({ x, y, width = 318, height = 112, logoWidth = 278 }) {
  const logo = await sharp(path.join(brandDir, "rendi-virgo-logo.webp"))
    .resize({ width: logoWidth })
    .toBuffer();
  const plate = svg(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="${colors.ivory}" opacity="0.97" />`);
  return [
    { input: plate },
    { input: logo, top: y + 18, left: x + Math.round((width - logoWidth) / 2) },
  ];
}

async function createPost01() {
  const background = await sharp(image("public/social/moss-agate-editorial-generated.png"))
    .resize(1080, 1080, { fit: "cover", position: "center" })
    .modulate({ brightness: 0.86, saturation: 0.94 })
    .toBuffer();
  const logoLayers = await logoPlate({ x: 48, y: 44 });
  const overlay = svg(`
    <defs>
      <linearGradient id="post01Shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${colors.forestDeep}" stop-opacity="0.92" />
        <stop offset="0.62" stop-color="${colors.forestDeep}" stop-opacity="0.48" />
        <stop offset="1" stop-color="${colors.forestDeep}" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="post01Bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${colors.forestDeep}" stop-opacity="0" />
        <stop offset="1" stop-color="${colors.forestDeep}" stop-opacity="0.72" />
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#post01Shade)" />
    <rect width="1080" height="1080" fill="url(#post01Bottom)" />
    ${text("THE COLLECTION", 58, 312, { fill: colors.bronzeLight, size: 18, family: "Arial, Helvetica, sans-serif", letterSpacing: 5, weight: 600 })}
    ${text("Forest River", 58, 410, { fill: colors.ivory, size: 64, weight: 400 })}
    ${text("Cabochon", 58, 482, { fill: colors.ivory, size: 64, weight: 400 })}
    ${line(60, 520, 122, 520, colors.bronzeLight, 3)}
    ${text("MOSS AGATE", 60, 566, { fill: colors.ivory, size: 19, family: "Arial, Helvetica, sans-serif", letterSpacing: 4, weight: 600 })}
    ${text("West Java, Indonesia", 60, 603, { fill: colors.ivory, size: 25, style: "italic", opacity: 0.92 })}
    ${line(58, 946, 1022, 946, colors.bronzeLight, 1, 0.72)}
    ${text("NATURAL BEAUTY · TIMELESS VALUE", 58, 984, { fill: colors.ivory, size: 14, family: "Arial, Helvetica, sans-serif", letterSpacing: 3, weight: 600, opacity: 0.9 })}
    ${text("RENDI VIRGO", 1022, 984, { fill: colors.ivory, size: 14, family: "Arial, Helvetica, sans-serif", letterSpacing: 2, weight: 600, anchor: "end", opacity: 0.9 })}
  `);
  await sharp(background)
    .composite([{ input: overlay }, ...logoLayers])
    .png({ compressionLevel: 9 })
    .toFile(path.join(socialDir, "rendi-virgo-post-01-forest-river.png"));
}

async function createPost02() {
  const background = await sharp(image("public/images/rendi-virgo-owner.webp"))
    .resize(1080, 1080, { fit: "cover", position: "center" })
    .modulate({ brightness: 0.88, saturation: 0.9 })
    .toBuffer();
  const logoLayers = await logoPlate({ x: 58, y: 62, width: 310, height: 105, logoWidth: 270 });
  const overlay = svg(`
    <defs>
      <linearGradient id="post02Panel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${colors.ivory}" stop-opacity="0.99" />
        <stop offset="0.77" stop-color="${colors.ivory}" stop-opacity="0.96" />
        <stop offset="1" stop-color="${colors.ivory}" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="post02Shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${colors.forestDeep}" stop-opacity="0.1" />
        <stop offset="1" stop-color="${colors.forestDeep}" stop-opacity="0.46" />
      </linearGradient>
    </defs>
    <rect width="700" height="1080" fill="url(#post02Panel)" />
    <rect width="1080" height="1080" fill="url(#post02Shade)" />
    ${text("THE OWNER'S NOTE", 62, 250, { fill: colors.jade, size: 17, family: "Arial, Helvetica, sans-serif", letterSpacing: 4.5, weight: 600 })}
    ${text("From Indonesia", 62, 354, { fill: colors.forestDeep, size: 58 })}
    ${text("to the world.", 62, 420, { fill: colors.forestDeep, size: 58 })}
    ${line(64, 462, 126, 462, colors.bronze, 3)}
    ${text("A closer relationship with Indonesia's", 64, 520, { fill: colors.ink, size: 25, opacity: 0.9 })}
    ${text("natural beauty — selected with care", 64, 558, { fill: colors.ink, size: 25, opacity: 0.9 })}
    ${text("for collectors and makers worldwide.", 64, 596, { fill: colors.ink, size: 25, opacity: 0.9 })}
    ${line(64, 694, 590, 694, colors.line, 1)}
    ${text("Natural stones", 64, 758, { fill: colors.forest, size: 23, style: "italic" })}
    ${text("Authentic Indonesian material", 64, 800, { fill: colors.muted, size: 17, family: "Arial, Helvetica, sans-serif", letterSpacing: 1.3 })}
    <rect x="0" y="1005" width="1080" height="75" fill="${colors.forestDeep}" opacity="0.96" />
    ${text("RENDI VIRGO", 62, 1052, { fill: colors.ivory, size: 16, family: "Arial, Helvetica, sans-serif", letterSpacing: 3.5, weight: 600 })}
    ${text("rendivirgo.com", 1018, 1052, { fill: colors.bronzeLight, size: 16, family: "Arial, Helvetica, sans-serif", letterSpacing: 2.2, weight: 600, anchor: "end" })}
  `);
  await sharp(background)
    .composite([{ input: overlay }, ...logoLayers])
    .png({ compressionLevel: 9 })
    .toFile(path.join(socialDir, "rendi-virgo-post-02-from-indonesia.png"));
}

async function createPost03() {
  const hero = await sharp(image("public/images/rendi-virgo-hero-stones.webp"))
    .resize(560, 690, { fit: "cover", position: "right" })
    .modulate({ brightness: 0.94, saturation: 0.92 })
    .toBuffer();
  const logoLayers = await logoPlate({ x: 66, y: 64, width: 286, height: 100, logoWidth: 248 });
  const base = svg(`
    <rect width="1080" height="1080" fill="${colors.paper}" />
    <rect x="554" y="0" width="526" height="1080" fill="${colors.forestDeep}" />
    <rect x="554" y="0" width="526" height="1080" fill="${colors.forestDeep}" opacity="0.16" />
    <rect x="64" y="213" width="420" height="1" fill="${colors.line}" />
    ${text("THE JOURNAL", 68, 276, { fill: colors.jade, size: 17, family: "Arial, Helvetica, sans-serif", letterSpacing: 4.5, weight: 600 })}
    ${text("How to look", 68, 392, { fill: colors.forestDeep, size: 56 })}
    ${text("at a stone.", 68, 458, { fill: colors.forestDeep, size: 56 })}
    ${line(70, 500, 132, 500, colors.bronze, 3)}
    ${text("Before the cut, before the setting,", 70, 565, { fill: colors.ink, size: 23, opacity: 0.84 })}
    ${text("there is color, pattern, and place.", 70, 601, { fill: colors.ink, size: 23, opacity: 0.84 })}
    <rect x="68" y="708" width="416" height="56" rx="2" fill="${colors.ivory}" stroke="${colors.line}" />
    ${text("COLOR", 90, 744, { fill: colors.forest, size: 14, family: "Arial, Helvetica, sans-serif", letterSpacing: 2.5, weight: 700 })}
    <rect x="68" y="780" width="416" height="56" rx="2" fill="${colors.ivory}" stroke="${colors.line}" />
    ${text("PATTERN", 90, 816, { fill: colors.forest, size: 14, family: "Arial, Helvetica, sans-serif", letterSpacing: 2.5, weight: 700 })}
    <rect x="68" y="852" width="416" height="56" rx="2" fill="${colors.ivory}" stroke="${colors.line}" />
    ${text("PROVENANCE", 90, 888, { fill: colors.forest, size: 14, family: "Arial, Helvetica, sans-serif", letterSpacing: 2.5, weight: 700 })}
    ${text("Notes from the collection.", 68, 1002, { fill: colors.muted, size: 18, style: "italic" })}
    ${text("RENDI VIRGO", 1014, 1002, { fill: colors.bronzeLight, size: 14, family: "Arial, Helvetica, sans-serif", letterSpacing: 2.4, weight: 600, anchor: "end" })}
  `);
  await sharp(base)
    .composite([
      { input: hero, top: 0, left: 520 },
      { input: svg(`<rect x="520" y="0" width="34" height="1080" fill="${colors.paper}" opacity="0.82" />`) },
      ...logoLayers,
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(socialDir, "rendi-virgo-post-03-the-journal.png"));
}

async function createPreview() {
  const files = [
    "rendi-virgo-post-01-forest-river.png",
    "rendi-virgo-post-02-from-indonesia.png",
    "rendi-virgo-post-03-the-journal.png",
  ];
  const thumbWidth = 340;
  const gap = 12;
  const thumbs = await Promise.all(files.map((file) => sharp(path.join(socialDir, file)).resize(thumbWidth, thumbWidth).toBuffer()));
  const preview = sharp({
    create: {
      width: thumbWidth * 3 + gap * 2,
      height: thumbWidth,
      channels: 4,
      background: colors.paper,
    },
  });
  await preview
    .composite(thumbs.map((input, index) => ({ input, left: index * (thumbWidth + gap), top: 0 })))
    .jpeg({ quality: 90 })
    .toFile(path.join(socialDir, "rendi-virgo-social-pack-preview.jpg"));
}

await fs.mkdir(socialDir, { recursive: true });
await createPost01();
await createPost02();
await createPost03();
await createPreview();
console.log("Created RENDI VIRGO Instagram examples in public/social/");
