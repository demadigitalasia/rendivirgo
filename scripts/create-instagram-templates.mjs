import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outputDir = path.join(root, "public", "social", "templates");
const logoPath = path.join(root, "public", "brand", "rendi-virgo-logo.png");

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

const t = (value, x, y, options = {}) => {
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

const svgDocument = (content, logoData) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1080" viewBox="0 0 1080 1080">
  <title>RENDI VIRGO Instagram template</title>
  <desc>Editable square social media template using the RENDI VIRGO website visual system.</desc>
  ${content.replaceAll("{{LOGO}}", `<image x="76" y="62" width="270" height="90" preserveAspectRatio="xMidYMid meet" href="${logoData}" />`)}
</svg>`;

const productTemplate = (logoData) => svgDocument(`
  <!-- Replace the photo placeholder and bracketed copy. Keep the logo clear space intact. -->
  <rect width="1080" height="1080" fill="${colors.forestDeep}" />
  <rect x="34" y="34" width="1012" height="1012" fill="none" stroke="${colors.bronzeLight}" stroke-width="1" opacity="0.38" />
  <rect x="48" y="44" width="318" height="112" rx="3" fill="${colors.ivory}" />
  <g transform="translate(-8,-4)">{{LOGO}}</g>
  <text x="58" y="314" fill="${colors.bronzeLight}" font-family="Arial, Helvetica, sans-serif" font-size="18px" font-weight="600" letter-spacing="5px">THE COLLECTION</text>
  <text x="58" y="410" fill="${colors.ivory}" font-family="Georgia, Times New Roman, serif" font-size="64px">[STONE NAME]</text>
  <text x="58" y="486" fill="${colors.ivory}" font-family="Georgia, Times New Roman, serif" font-size="64px">[SECOND LINE]</text>
  <line x1="60" y1="526" x2="122" y2="526" stroke="${colors.bronzeLight}" stroke-width="3" />
  <text x="60" y="573" fill="${colors.ivory}" font-family="Arial, Helvetica, sans-serif" font-size="19px" font-weight="600" letter-spacing="4px">[STONE TYPE]</text>
  <text x="60" y="612" fill="${colors.ivory}" font-family="Georgia, Times New Roman, serif" font-size="25px" font-style="italic" opacity="0.92">[ORIGIN, INDONESIA]</text>
  <rect x="490" y="176" width="520" height="642" rx="4" fill="${colors.forest}" stroke="${colors.bronzeLight}" stroke-width="2" stroke-dasharray="10 10" opacity="0.9" />
  <text x="750" y="472" fill="${colors.ivory}" font-family="Arial, Helvetica, sans-serif" font-size="20px" text-anchor="middle" letter-spacing="3px">DROP PRODUCT PHOTO</text>
  <text x="750" y="508" fill="${colors.bronzeLight}" font-family="Georgia, Times New Roman, serif" font-size="19px" font-style="italic" text-anchor="middle">Keep the stone as the hero.</text>
  <line x1="58" y1="946" x2="1022" y2="946" stroke="${colors.bronzeLight}" stroke-width="1" opacity="0.72" />
  <text x="58" y="984" fill="${colors.ivory}" font-family="Arial, Helvetica, sans-serif" font-size="14px" font-weight="600" letter-spacing="3px">NATURAL BEAUTY · TIMELESS VALUE</text>
  <text x="1022" y="984" fill="${colors.ivory}" font-family="Arial, Helvetica, sans-serif" font-size="14px" font-weight="600" letter-spacing="2px" text-anchor="end">RENDI VIRGO</text>
`, logoData);

const storyTemplate = (logoData) => svgDocument(`
  <!-- Replace the photo placeholder and bracketed copy. Keep the panel width and footer. -->
  <rect width="1080" height="1080" fill="${colors.forestDeep}" />
  <rect width="690" height="1080" fill="${colors.ivory}" />
  <rect x="0" y="0" width="740" height="1080" fill="${colors.ivory}" opacity="0.97" />
  <rect x="58" y="62" width="310" height="105" rx="3" fill="${colors.ivory}" stroke="${colors.line}" />
  <g transform="translate(-10,-4)">{{LOGO}}</g>
  <text x="62" y="250" fill="${colors.jade}" font-family="Arial, Helvetica, sans-serif" font-size="17px" font-weight="600" letter-spacing="4.5px">[SECTION LABEL]</text>
  <text x="62" y="356" fill="${colors.forestDeep}" font-family="Georgia, Times New Roman, serif" font-size="58px">[HEADLINE LINE 1]</text>
  <text x="62" y="422" fill="${colors.forestDeep}" font-family="Georgia, Times New Roman, serif" font-size="58px">[HEADLINE LINE 2]</text>
  <line x1="64" y1="464" x2="126" y2="464" stroke="${colors.bronze}" stroke-width="3" />
  <text x="64" y="522" fill="${colors.ink}" font-family="Georgia, Times New Roman, serif" font-size="24px">[Supporting sentence goes here]</text>
  <text x="64" y="558" fill="${colors.ink}" font-family="Georgia, Times New Roman, serif" font-size="24px">[Keep this to three short lines.]</text>
  <text x="64" y="594" fill="${colors.ink}" font-family="Georgia, Times New Roman, serif" font-size="24px">[Let the image carry the mood.]</text>
  <line x1="64" y1="694" x2="590" y2="694" stroke="${colors.line}" stroke-width="1" />
  <text x="64" y="758" fill="${colors.forest}" font-family="Georgia, Times New Roman, serif" font-size="23px" font-style="italic">[Short brand thought]</text>
  <text x="64" y="800" fill="${colors.muted}" font-family="Arial, Helvetica, sans-serif" font-size="17px" letter-spacing="1.3px">[AUTHENTIC INDONESIAN MATERIAL]</text>
  <rect x="740" y="0" width="340" height="1080" fill="${colors.forest}" stroke="${colors.bronzeLight}" stroke-width="2" stroke-dasharray="10 10" />
  <text x="910" y="520" fill="${colors.ivory}" font-family="Arial, Helvetica, sans-serif" font-size="18px" text-anchor="middle" letter-spacing="3px">DROP BRAND PHOTO</text>
  <rect x="0" y="1005" width="1080" height="75" fill="${colors.forestDeep}" />
  <text x="62" y="1052" fill="${colors.ivory}" font-family="Arial, Helvetica, sans-serif" font-size="16px" font-weight="600" letter-spacing="3.5px">RENDI VIRGO</text>
  <text x="1018" y="1052" fill="${colors.bronzeLight}" font-family="Arial, Helvetica, sans-serif" font-size="16px" font-weight="600" letter-spacing="2.2px" text-anchor="end">rendivirgo.com</text>
`, logoData);

const journalTemplate = (logoData) => svgDocument(`
  <!-- Replace the photo placeholder and bracketed copy. Keep the three metadata chips. -->
  <rect width="1080" height="1080" fill="${colors.paper}" />
  <rect x="554" y="0" width="526" height="1080" fill="${colors.forestDeep}" />
  <rect x="554" y="0" width="526" height="1080" fill="${colors.forestDeep}" opacity="0.18" stroke="${colors.bronzeLight}" stroke-width="2" stroke-dasharray="10 10" />
  <text x="817" y="520" fill="${colors.ivory}" font-family="Arial, Helvetica, sans-serif" font-size="18px" text-anchor="middle" letter-spacing="3px">DROP JOURNAL PHOTO</text>
  <rect x="66" y="64" width="286" height="100" rx="3" fill="${colors.ivory}" stroke="${colors.line}" />
  <g transform="translate(-10,-4)">{{LOGO}}</g>
  <rect x="64" y="213" width="420" height="1" fill="${colors.line}" />
  <text x="68" y="276" fill="${colors.jade}" font-family="Arial, Helvetica, sans-serif" font-size="17px" font-weight="600" letter-spacing="4.5px">THE JOURNAL</text>
  <text x="68" y="392" fill="${colors.forestDeep}" font-family="Georgia, Times New Roman, serif" font-size="56px">[ARTICLE TITLE]</text>
  <text x="68" y="458" fill="${colors.forestDeep}" font-family="Georgia, Times New Roman, serif" font-size="56px">[SECOND LINE]</text>
  <line x1="70" y1="500" x2="132" y2="500" stroke="${colors.bronze}" stroke-width="3" />
  <text x="70" y="565" fill="${colors.ink}" font-family="Georgia, Times New Roman, serif" font-size="23px">[Short educational thought]</text>
  <text x="70" y="601" fill="${colors.ink}" font-family="Georgia, Times New Roman, serif" font-size="23px">[One clear, useful sentence.]</text>
  <rect x="68" y="708" width="416" height="56" rx="2" fill="${colors.ivory}" stroke="${colors.line}" />
  <text x="90" y="744" fill="${colors.forest}" font-family="Arial, Helvetica, sans-serif" font-size="14px" font-weight="700" letter-spacing="2.5px">[TOPIC 01]</text>
  <rect x="68" y="780" width="416" height="56" rx="2" fill="${colors.ivory}" stroke="${colors.line}" />
  <text x="90" y="816" fill="${colors.forest}" font-family="Arial, Helvetica, sans-serif" font-size="14px" font-weight="700" letter-spacing="2.5px">[TOPIC 02]</text>
  <rect x="68" y="852" width="416" height="56" rx="2" fill="${colors.ivory}" stroke="${colors.line}" />
  <text x="90" y="888" fill="${colors.forest}" font-family="Arial, Helvetica, sans-serif" font-size="14px" font-weight="700" letter-spacing="2.5px">[TOPIC 03]</text>
  <text x="68" y="1002" fill="${colors.muted}" font-family="Georgia, Times New Roman, serif" font-size="18px" font-style="italic">Notes from the collection.</text>
  <text x="1014" y="1002" fill="${colors.bronzeLight}" font-family="Arial, Helvetica, sans-serif" font-size="14px" font-weight="600" letter-spacing="2.4px" text-anchor="end">RENDI VIRGO</text>
`, logoData);

const templates = [
  ["instagram-product-template.svg", productTemplate],
  ["instagram-story-template.svg", storyTemplate],
  ["instagram-journal-template.svg", journalTemplate],
];

const logoData = `data:image/png;base64,${(await fs.readFile(logoPath)).toString("base64")}`;
await fs.mkdir(outputDir, { recursive: true });

for (const [filename, makeTemplate] of templates) {
  const content = makeTemplate(logoData);
  await fs.writeFile(path.join(outputDir, filename), content, "utf8");
  await sharp(Buffer.from(content)).png({ compressionLevel: 9 }).toFile(path.join(outputDir, filename.replace(".svg", ".png")));
}

const thumbnails = await Promise.all(
  templates.map(([filename]) => sharp(path.join(outputDir, filename.replace(".svg", ".png"))).resize(340, 340).toBuffer()),
);
await sharp({
  create: { width: 1044, height: 340, channels: 4, background: colors.paper },
})
  .composite(thumbnails.map((input, index) => ({ input, left: index * 352, top: 0 })))
  .jpeg({ quality: 90 })
  .toFile(path.join(outputDir, "instagram-templates-preview.jpg"));

console.log("Created editable SVG templates and previews in public/social/templates/");
