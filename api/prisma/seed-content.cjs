#!/usr/bin/env node
/* Content-only seed for production: categories, pages, settings, blog,
   testimonials, banners, shipping rates, and discounts. No demo products,
   customers, orders, or messages. Safe to run repeatedly (idempotent). */

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../generated/prisma");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const categories = [
  { slug: "cabochons", name: "Cabochons", note: "Ready to set", tone: "moss" },
  { slug: "pair", name: "Pair", note: "Matched stones", tone: "jade" },
  { slug: "rough", name: "Rough", note: "Natural material", tone: "amber" },
  { slug: "slab", name: "Slab", note: "Lapidary canvas", tone: "ocean" },
  { slug: "specimen", name: "Specimen", note: "Display pieces", tone: "earth" },
  { slug: "tumbled-stones", name: "Tumbled Stones", note: "Polished smooth", tone: "moss" },
  { slug: "beads", name: "Beads & Strands", note: "Made to string", tone: "jade" },
  { slug: "faceted", name: "Faceted Gemstones", note: "Precision cut", tone: "amber" },
  { slug: "spheres-shapes", name: "Spheres & Shapes", note: "Sculptural forms", tone: "ocean" },
  { slug: "crystal-points", name: "Crystal Points", note: "Natural formations", tone: "earth" },
  { slug: "carvings", name: "Carved Stones", note: "Hand finished", tone: "moss" },
  { slug: "drilled-briolettes", name: "Drilled & Briolettes", note: "Ready to wear", tone: "jade" },
  { slug: "chips", name: "Chips & Crushed", note: "For craft and inlay", tone: "amber" },
];

const pages = [
  {
    slug: "about-us",
    title: "About Us",
    sortOrder: 1,
    body: [
      "RENDI VIRGO began with a simple conviction: Indonesia's natural stones deserve a place on the world stage.",
      "",
      "We work directly with cutters, miners, and small workshops across the archipelago — from West Java to Kalimantan — to bring one-of-a-kind pieces to collectors, jewellers, and makers.",
      "",
      "Every stone is photographed as it is. Every order is packed by hand. Nothing is mass produced, because nature never repeats itself.",
    ].join("\n"),
  },
  {
    slug: "faq",
    title: "FAQ",
    sortOrder: 2,
    body: [
      "## Are all stones natural?",
      "Yes. We disclose any treatment (natural, treated, or dyed) on every product page.",
      "",
      "## Do you ship worldwide?",
      "We ship worldwide from Indonesia. Shipping is calculated from the total weight of your parcel at checkout.",
      "",
      "## Is every piece unique?",
      "Most pieces are one of a kind. Once a unique stone is sold, it is gone forever.",
      "",
      "## How do I care for my stone?",
      "Keep it away from harsh chemicals, store it separately from harder stones, and polish gently with a soft cloth.",
    ].join("\n"),
  },
  {
    slug: "shipping-returns",
    title: "Shipping & Returns",
    sortOrder: 3,
    body: [
      "## Shipping",
      "Orders are packed within 1–3 business days. International delivery typically takes 7–21 business days depending on destination and carrier.",
      "",
      "Shipping cost is calculated from the total weight of all items in a single parcel. Fragile and oversized pieces may include additional handling fees.",
      "",
      "## Returns",
      "Because most items are one of a kind, returns are accepted only for items that arrive damaged or significantly different from the listing. Contact us within 7 days of delivery with photos.",
    ].join("\n"),
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    sortOrder: 4,
    body: [
      "We collect only the information required to process your order and improve your experience: name, email, shipping address, and order history.",
      "",
      "We never sell your data. Payment information is handled entirely by our payment provider; we do not store card details.",
      "",
      "You may request deletion of your data at any time by writing to cs@rendivirgo.com.",
    ].join("\n"),
  },
  {
    slug: "terms-conditions",
    title: "Terms & Conditions",
    sortOrder: 5,
    body: [
      "By placing an order on rendivirgo.com you agree to the following terms.",
      "",
      "All products are sold as described. Natural stones may include internal features, inclusions, or colour variation — these are characteristics, not defects.",
      "",
      "Prices are listed in USD. Orders are confirmed once payment is received.",
    ].join("\n"),
  },
];

const settings = {
  "store.name": "RENDI VIRGO",
  "store.tagline": "Indonesian natural stones, from our hands to yours.",
  "store.email": "cs@rendivirgo.com",
  "store.adminEmail": "admin@rendivirgo.com",
  "store.whatsapp": "+62 812 0000 0000",
  "store.currency": "USD",
  "store.languages": ["en", "id"],
  "store.address": "Bandung, West Java, Indonesia",
  "store.socials": { instagram: "https://instagram.com/rendivirgo", facebook: "", youtube: "", tiktok: "" },
  "store.hours": "Monday – Saturday, 09:00 – 18:00 (GMT+7)",
  "home.heroTitle": "Explore the Collection",
  "home.heroSubtitle": "Rare semi-precious stones from Indonesia, selected for collectors, makers, and quiet moments of wonder.",
  "home.heroImage": "/images/rendi-virgo-hero-stones.webp",
  "home.ownerName": "RENDI VIRGO",
  "home.ownerRole": "Founder & Curator",
  "home.ownerBio":
    "A lifelong passion for Indonesia's natural treasures. RENDI VIRGO is dedicated to sharing the beauty and authenticity of our local stones with the world.",
  "home.ownerImage": "/images/rendi-virgo-owner.webp",
  "home.ownerCtaLabel": "About Us",
  "home.ownerCtaHref": "/about-us",
  "shipping.overrideEnabled": false,
  "shipping.overrideAmount": 48,
  "shipping.freeShippingThreshold": 350,
  "seo.defaultTitle": "RENDI VIRGO — Indonesian Natural Stones",
  "seo.defaultDescription":
    "One-of-a-kind cabochons, rough, specimens, beads, and faceted gemstones sourced directly from Indonesia. Worldwide shipping in USD.",
  "notifications.orderConfirmation": true,
  "notifications.lowStock": true,
  "notifications.newMessage": true,
  "payments.paypalEnabled": true,
  "payments.paypalEmail": "admin@rendivirgo.com",
  "payments.bankTransferEnabled": false,
  "payments.currency": "USD",
};

const testimonials = [
  {
    customerName: "Amelia R.",
    location: "Melbourne, Australia",
    quote: "The moss agate cabochon is even richer in person. Packed beautifully and arrived faster than expected.",
    rating: 5,
    sortOrder: 1,
  },
  {
    customerName: "Kenji T.",
    location: "Osaka, Japan",
    quote: "Third order from RENDI VIRGO. The origin notes on each stone make collecting genuinely educational.",
    rating: 5,
    sortOrder: 2,
  },
  {
    customerName: "Sofia M.",
    location: "Lisbon, Portugal",
    quote: "A one-of-a-kind jasper for my bench. The photos were honest and the stone matched perfectly.",
    rating: 5,
    sortOrder: 3,
  },
];

const banners = [
  {
    title: "Indonesian stones, a brighter tomorrow",
    subtitle: "Hand selected from small workshops across the archipelago.",
    imageUrl: "/images/rendi-virgo-hero-stones.webp",
    ctaLabel: "Explore the Collection",
    ctaHref: "/shop",
    placement: "HomeHero",
    sortOrder: 1,
  },
  {
    title: "Meet RENDI VIRGO",
    subtitle: "The story behind the collection.",
    imageUrl: "/images/rendi-virgo-owner.webp",
    ctaLabel: "About Us",
    ctaHref: "/about-us",
    placement: "HomeOwner",
    sortOrder: 1,
  },
  {
    title: "Free worldwide shipping over $350",
    subtitle: "One parcel, consolidated from the total order weight.",
    ctaLabel: "Shop the collection",
    ctaHref: "/shop",
    placement: "Promo",
    sortOrder: 1,
  },
];

const rates = [
  { name: "Asia Pacific Standard", carrier: "Pos Indonesia", minWeightGram: 0, maxWeightGram: 500, price: 22, handlingFee: 3, fragileFee: 5, oversizedFee: 10, sortOrder: 1 },
  { name: "Asia Pacific Express", carrier: "DHL", minWeightGram: 0, maxWeightGram: 1000, price: 46, handlingFee: 4, fragileFee: 6, oversizedFee: 14, sortOrder: 2 },
  { name: "Rest of World Standard", carrier: "Pos Indonesia", minWeightGram: 500, maxWeightGram: 3000, price: 38, handlingFee: 4, fragileFee: 6, oversizedFee: 12, sortOrder: 3 },
  { name: "Rest of World Express", carrier: "FedEx", minWeightGram: 0, maxWeightGram: 5000, price: 72, handlingFee: 5, fragileFee: 8, oversizedFee: 18, sortOrder: 4 },
];

const discounts = [
  { code: "WELCOME10", description: "10% off for first-time collectors", type: "Percentage", value: 10, minSubtotal: 50, maxUses: 500 },
  { code: "FREESHIP", description: "Free worldwide shipping", type: "FreeShipping", value: 0, minSubtotal: 150 },
];

const blogPosts = [
  { slug: "how-to-read-a-cabochon", title: "How to Read a Cabochon", excerpt: "A practical guide to dome, polish, pattern, and the small details that make a cabochon special.", tag: "Stone Education", date: "2026-09-18" },
  { slug: "from-indonesia-to-your-workbench", title: "From Indonesia to Your Workbench", excerpt: "A closer look at the people, places, and patient hands behind our natural stone collections.", tag: "Sourcing Stories", date: "2026-09-10" },
  { slug: "caring-for-polished-stones", title: "Caring for Polished Stones", excerpt: "Simple habits that protect polish, color, and character for years to come.", tag: "Care Guide", date: "2026-09-02" },
  { slug: "why-origin-matters", title: "Why Origin Matters", excerpt: "Regional geology gives every stone its signature. Here is how to read provenance with confidence.", tag: "Sourcing Stories", date: "2026-08-26" },
  { slug: "cabochon-or-faceted", title: "Cabochon or Faceted?", excerpt: "Two cuts, two personalities. A practical comparison for makers choosing the right finish.", tag: "Stone Education", date: "2026-08-19" },
  { slug: "packing-fragile-stones", title: "How We Pack Fragile Stones", excerpt: "From wrapping to one-parcel consolidation, the steps that keep delicate pieces safe in transit.", tag: "Shipping Notes", date: "2026-08-12" },
];

async function main() {
  console.log("Seeding content...");

  for (const [index, category] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.note, sortOrder: index },
      create: {
        slug: category.slug,
        name: category.name,
        description: category.note,
        sortOrder: index,
        tone: category.tone,
        metaTitle: `${category.name} — RENDI VIRGO`,
        metaDescription: `${category.name}: ${category.note} from RENDI VIRGO.`,
      },
    });
  }
  console.log(`  categories: ${categories.length}`);

  for (const page of pages) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      update: { title: page.title, body: page.body },
      create: {
        slug: page.slug,
        title: page.title,
        body: page.body,
        status: "Published",
        showInFooter: true,
        sortOrder: page.sortOrder,
        metaTitle: `${page.title} | RENDI VIRGO`,
        metaDescription: page.body.split("\n").find((line) => line.trim() && !line.startsWith("#"))?.slice(0, 200) ?? page.title,
      },
    });
  }
  console.log(`  pages: ${pages.length}`);

  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log(`  settings: ${Object.keys(settings).length}`);

  if ((await prisma.testimonial.count()) === 0) {
    await prisma.testimonial.createMany({ data: testimonials });
  }
  if ((await prisma.banner.count()) === 0) {
    await prisma.banner.createMany({ data: banners });
  }
  console.log("  testimonials & banners ready");

  if ((await prisma.shippingProfile.count()) === 0) {
    await prisma.shippingProfile.create({
      data: {
        name: "Worldwide Standard Parcel",
        packageWeightGram: 500,
        packageLengthMm: 250,
        packageWidthMm: 200,
        packageHeightMm: 100,
        shippingClass: "Standard",
        calculationMethod: "CarrierAPI",
        packageModel: "SinglePackageTotalWeight",
        handlingFee: 4,
        fragileFee: 6,
        oversizedFee: 12,
        isDefault: true,
      },
    });
  }
  if ((await prisma.shippingRate.count()) === 0) {
    await prisma.shippingRate.createMany({ data: rates });
  }
  console.log("  shipping ready");

  if ((await prisma.discount.count()) === 0) {
    await prisma.discount.createMany({ data: discounts });
  }
  console.log("  discounts ready");

  for (const post of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        coverImage: `/images/blog/${post.slug}.svg`,
        tags: [post.tag],
        status: "Published",
        author: "RENDI VIRGO",
        readMinutes: 5,
        publishedAt: new Date(post.date),
        body: [
          `## ${post.title}`,
          "",
          post.excerpt,
          "",
          "Indonesian stones carry the memory of their landscape. In this guide we walk through the practical details — how to read colour, pattern, and finish — so you can choose with confidence.",
          "",
          "### What to look for",
          "",
          "1. **Colour saturation** — natural stones shift with the light. Look for depth, not just brightness.",
          "2. **Pattern** — banding, moss, and plume are signatures of origin and formation.",
          "3. **Finish** — a good polish reveals clarity without flattening character.",
          "",
          "### Our promise",
          "",
          "Every piece is photographed as it is, described honestly, and packed by hand. If you have questions before ordering, write to cs@rendivirgo.com and we will answer personally.",
        ].join("\n"),
        metaTitle: `${post.title} | RENDI VIRGO Journal`,
        metaDescription: post.excerpt,
      },
    });
  }
  console.log(`  blog posts: ${blogPosts.length}`);

  console.log("Content seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
