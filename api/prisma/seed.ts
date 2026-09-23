import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "../generated/prisma";
import { blogPosts, categories as catalogCategories, products as catalogProducts } from "../../lib/catalog";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const categoryNotes: Record<string, string> = Object.fromEntries(
  catalogCategories.map((category) => [category.slug, category.note]),
);

const statusMap: Record<string, "Published" | "Sold" | "Reserved"> = {
  Available: "Published",
  Sold: "Sold",
  Reserved: "Reserved",
};

const pages = [
  {
    slug: "about-us",
    title: "About Us",
    body: [
      "RENDI VIRGO began with a simple conviction: Indonesia's natural stones deserve a place on the world stage.",
      "",
      "We work directly with cutters, miners, and small workshops across the archipelago — from West Java to Kalimantan — to bring one-of-a-kind pieces to collectors, jewellers, and makers.",
      "",
      "Every stone is photographed as it is. Every order is packed by hand. Nothing is mass produced, because nature never repeats itself.",
    ].join("\n"),
    showInFooter: true,
    sortOrder: 1,
  },
  {
    slug: "faq",
    title: "FAQ",
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
    showInFooter: true,
    sortOrder: 2,
  },
  {
    slug: "shipping-returns",
    title: "Shipping & Returns",
    body: [
      "## Shipping",
      "Orders are packed within 1–3 business days. International delivery typically takes 7–21 business days depending on destination and carrier.",
      "",
      "Shipping cost is calculated from the total weight of all items in a single parcel. Fragile and oversized pieces may include additional handling fees.",
      "",
      "## Returns",
      "Because most items are one of a kind, returns are accepted only for items that arrive damaged or significantly different from the listing. Contact us within 7 days of delivery with photos.",
    ].join("\n"),
    showInFooter: true,
    sortOrder: 3,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    body: [
      "We collect only the information required to process your order and improve your experience: name, email, shipping address, and order history.",
      "",
      "We never sell your data. Payment information is handled entirely by our payment provider; we do not store card details.",
      "",
      "You may request deletion of your data at any time by writing to cs@rendivirgo.com.",
    ].join("\n"),
    showInFooter: true,
    sortOrder: 4,
  },
  {
    slug: "terms-conditions",
    title: "Terms & Conditions",
    body: [
      "By placing an order on rendivirgo.com you agree to the following terms.",
      "",
      "All products are sold as described. Natural stones may include internal features, inclusions, or colour variation — these are characteristics, not defects.",
      "",
      "Prices are listed in USD. Orders are confirmed once payment is received.",
    ].join("\n"),
    showInFooter: true,
    sortOrder: 5,
  },
];

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

const siteSettings: Record<string, unknown> = {
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
  "home.heroImage": "/images/hero-stones.svg",
  "home.ownerName": "RENDI VIRGO",
  "home.ownerRole": "Founder & Curator",
  "home.ownerBio":
    "A lifelong passion for Indonesia's natural treasures. RENDI VIRGO is dedicated to sharing the beauty and authenticity of our local stones with the world.",
  "home.ownerImage": "/images/owner-portrait.svg",
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

async function main() {
  console.log("Seeding RENDI VIRGO database...");

  // ---------------------------------------------------------------- admin
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@rendivirgo.com").toLowerCase();
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: process.env.ADMIN_NAME ?? "Rendi Virgo",
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "RendiVirgo!2026", 12),
    },
  });

  // ---------------------------------------------------------------- categories
  const categoryBySlug = new Map<string, string>();
  for (const [index, category] of catalogCategories.entries()) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: index, description: categoryNotes[category.slug] ?? null },
      create: {
        slug: category.slug,
        name: category.name,
        description: categoryNotes[category.slug] ?? null,
        sortOrder: index,
        tone: (["moss", "jade", "amber", "ocean", "earth"] as const)[index % 5],
        metaTitle: `${category.name} — RENDI VIRGO`,
        metaDescription: `${category.name}: ${categoryNotes[category.slug] ?? "Indonesian natural stones"} from RENDI VIRGO.`,
      },
    });
    categoryBySlug.set(category.slug, record.id);
  }
  console.log(`  categories: ${categoryBySlug.size}`);

  // ---------------------------------------------------------------- shipping
  const defaultProfile = await prisma.shippingProfile.findFirst({ where: { isDefault: true } });
  if (!defaultProfile) {
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

  const rateCount = await prisma.shippingRate.count();
  if (rateCount === 0) {
    await prisma.shippingRate.createMany({
      data: [
        {
          name: "Asia Pacific Standard",
          carrier: "Pos Indonesia",
          region: "Worldwide",
          minWeightGram: 0,
          maxWeightGram: 500,
          price: 22,
          handlingFee: 3,
          fragileFee: 5,
          oversizedFee: 10,
          sortOrder: 1,
        },
        {
          name: "Asia Pacific Express",
          carrier: "DHL",
          region: "Worldwide",
          minWeightGram: 0,
          maxWeightGram: 1000,
          price: 46,
          handlingFee: 4,
          fragileFee: 6,
          oversizedFee: 14,
          sortOrder: 2,
        },
        {
          name: "Rest of World Standard",
          carrier: "Pos Indonesia",
          region: "Worldwide",
          minWeightGram: 500,
          maxWeightGram: 3000,
          price: 38,
          handlingFee: 4,
          fragileFee: 6,
          oversizedFee: 12,
          sortOrder: 3,
        },
        {
          name: "Rest of World Express",
          carrier: "FedEx",
          region: "Worldwide",
          minWeightGram: 0,
          maxWeightGram: 5000,
          price: 72,
          handlingFee: 5,
          fragileFee: 8,
          oversizedFee: 18,
          sortOrder: 4,
        },
      ],
    });
  }
  console.log("  shipping rates & profiles ready");

  // ---------------------------------------------------------------- products
  const productIdBySku = new Map<string, string>();
  let created = 0;
  for (const product of catalogProducts) {
    const categoryId = categoryBySlug.get(product.categorySlug);
    if (!categoryId) continue;

    const existing = await prisma.product.findUnique({ where: { sku: product.sku } });
    if (existing) {
      productIdBySku.set(product.sku, existing.id);
      continue;
    }

    const record = await prisma.product.create({
      data: {
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        categoryId,
        stoneType: product.stoneType,
        origin: product.origin,
        condition: product.condition,
        price: new Prisma.Decimal(product.price),
        currency: "USD",
        unit: product.unit,
        stockModel: product.stockModel,
        stockQuantity: product.stockModel === "Quantity" ? (product.stockQuantity ?? 1) : null,
        weightGram: product.weightGram,
        weightCarat: product.weightCarat,
        lengthMm: product.dimensionsMm.length,
        widthMm: product.dimensionsMm.width,
        heightMm: product.dimensionsMm.height,
        status: statusMap[product.status] ?? "Draft",
        tone: product.tone,
        shippingClass: product.shipping.shippingClass,
        description: product.description,
        featured: product.featured ?? false,
        fragile: product.fragile ?? false,
        metaTitle: product.seo.metaTitle,
        metaDescription: product.seo.metaDescription,
        publishedAt: statusMap[product.status] === "Published" ? new Date(product.createdAt) : null,
        createdAt: new Date(product.createdAt),
        images: {
          create: product.images.map((url, index) => ({ url, alt: product.name, sortOrder: index })),
        },
        variants: {
          create: (product.variants ?? []).map((variant, index) => ({
            sku: variant.sku,
            name: variant.name,
            price: new Prisma.Decimal(variant.price),
            stockQuantity: variant.stockQuantity,
            weightGram: variant.weightGram,
            lengthMm: variant.dimensionsMm.length,
            widthMm: variant.dimensionsMm.width,
            heightMm: variant.dimensionsMm.height,
            shippingClass: product.shipping.shippingClass,
            sortOrder: index,
          })),
        },
      },
    });
    productIdBySku.set(product.sku, record.id);
    created += 1;
  }
  console.log(`  products: ${created} created (${productIdBySku.size} total)`);

  // ---------------------------------------------------------------- content
  for (const post of blogPosts) {
    const publishedAt = new Date(post.date);
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        coverImage: `/images/blog/${post.slug}.svg`,
        tags: [post.category],
        status: "Published",
        author: "RENDI VIRGO",
        readMinutes: 5,
        publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
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

  for (const page of pages) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      update: {},
      create: {
        ...page,
        status: "Published",
        metaTitle: `${page.title} | RENDI VIRGO`,
        metaDescription: page.body.split("\n").find((line) => line.trim() && !line.startsWith("#"))?.slice(0, 200) ?? page.title,
      },
    });
  }
  console.log(`  pages: ${pages.length}`);

  const testimonialCount = await prisma.testimonial.count();
  if (testimonialCount === 0) {
    await prisma.testimonial.createMany({ data: testimonials });
  }

  const bannerCount = await prisma.banner.count();
  if (bannerCount === 0) {
    await prisma.banner.createMany({
      data: [
        {
          title: "Indonesian stones, a brighter tomorrow",
          subtitle: "Hand selected from small workshops across the archipelago.",
          imageUrl: "/images/hero-stones.svg",
          ctaLabel: "Explore the Collection",
          ctaHref: "/shop",
          placement: "HomeHero",
          sortOrder: 1,
        },
        {
          title: "Meet RENDI VIRGO",
          subtitle: "The story behind the collection.",
          imageUrl: "/images/owner-portrait.svg",
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
      ],
    });
  }
  console.log("  testimonials & banners ready");

  // ---------------------------------------------------------------- settings
  for (const [key, value] of Object.entries(siteSettings)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as never },
    });
  }
  console.log(`  site settings: ${Object.keys(siteSettings).length}`);

  // ---------------------------------------------------------------- discounts
  const discountCount = await prisma.discount.count();
  if (discountCount === 0) {
    await prisma.discount.createMany({
      data: [
        {
          code: "WELCOME10",
          description: "10% off for first-time collectors",
          type: "Percentage",
          value: new Prisma.Decimal(10),
          minSubtotal: new Prisma.Decimal(50),
          maxUses: 500,
          isActive: true,
        },
        {
          code: "FREESHIP",
          description: "Free worldwide shipping",
          type: "FreeShipping",
          value: new Prisma.Decimal(0),
          minSubtotal: new Prisma.Decimal(150),
          isActive: true,
        },
      ],
    });
  }
  console.log("  discounts ready");

  // ---------------------------------------------------------------- demo orders
  const orderCount = await prisma.order.count();
  if (orderCount === 0) {
    const demoBuyers = [
      { name: "Amelia Roberts", email: "amelia@example.com", city: "Melbourne", country: "Australia", countryCode: "AU" },
      { name: "Kenji Tanaka", email: "kenji@example.com", city: "Osaka", country: "Japan", countryCode: "JP" },
      { name: "Sofia Marques", email: "sofia@example.com", city: "Lisbon", country: "Portugal", countryCode: "PT" },
      { name: "Liam O'Connor", email: "liam@example.com", city: "Dublin", country: "Ireland", countryCode: "IE" },
    ];
    const statuses: Array<{ status: "New" | "Processing" | "Packed" | "Shipped" | "Completed"; paymentStatus: "Pending" | "Paid" }> = [
      { status: "Completed", paymentStatus: "Paid" },
      { status: "Shipped", paymentStatus: "Paid" },
      { status: "Processing", paymentStatus: "Paid" },
      { status: "New", paymentStatus: "Pending" },
      { status: "Packed", paymentStatus: "Paid" },
      { status: "Completed", paymentStatus: "Paid" },
    ];

    const seedProducts = await prisma.product.findMany({
      where: { status: { in: ["Published", "Sold"] } },
      take: 12,
      orderBy: { createdAt: "desc" },
      include: { images: true },
    });

    for (const [index, entry] of statuses.entries()) {
      const buyer = demoBuyers[index % demoBuyers.length];
      const product = seedProducts[index % seedProducts.length];
      if (!product) break;

      const quantity = product.stockModel === "Quantity" ? 2 : 1;
      const unitPrice = Number(product.price);
      const subtotal = unitPrice * quantity;
      const shippingCost = 22 + (product.fragile ? 5 : 0);
      const placedAt = new Date(Date.now() - (index + 1) * 4 * 24 * 60 * 60 * 1000);

      const customer = await prisma.customer.upsert({
        where: { email: buyer.email },
        update: {},
        create: {
          email: buyer.email,
          name: buyer.name,
          country: buyer.country,
          countryCode: buyer.countryCode,
          city: buyer.city,
          addressLine1: `${100 + index} Example Street`,
          postalCode: `1000${index}`,
        },
      });

      await prisma.order.create({
        data: {
          orderNumber: `RV-${placedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${String(index + 1).padStart(4, "0")}`,
          customerId: customer.id,
          email: buyer.email,
          customerName: buyer.name,
          status: entry.status,
          paymentStatus: entry.paymentStatus,
          currency: "USD",
          subtotal: new Prisma.Decimal(subtotal),
          shippingCost: new Prisma.Decimal(shippingCost),
          total: new Prisma.Decimal(subtotal + shippingCost),
          shippingName: "Asia Pacific Standard",
          carrier: entry.status === "Shipped" || entry.status === "Completed" ? "DHL" : null,
          trackingNumber: entry.status === "Shipped" || entry.status === "Completed" ? `RVX${1000000 + index}` : null,
          totalWeightGram: product.weightGram * quantity,
          shippingLine1: `${100 + index} Example Street`,
          shippingCity: buyer.city,
          shippingCountry: buyer.country,
          shippingCountryCode: buyer.countryCode,
          shippingPostalCode: `1000${index}`,
          placedAt,
          paidAt: entry.paymentStatus === "Paid" ? placedAt : null,
          packedAt: ["Packed", "Shipped", "Completed"].includes(entry.status) ? new Date(placedAt.getTime() + 86400000) : null,
          shippedAt: ["Shipped", "Completed"].includes(entry.status) ? new Date(placedAt.getTime() + 2 * 86400000) : null,
          completedAt: entry.status === "Completed" ? new Date(placedAt.getTime() + 6 * 86400000) : null,
          items: {
            create: [
              {
                productId: product.id,
                name: product.name,
                sku: product.sku,
                unitPrice: new Prisma.Decimal(unitPrice),
                quantity,
                weightGram: product.weightGram,
                lineTotal: new Prisma.Decimal(subtotal),
                imageUrl: product.images[0]?.url ?? null,
              },
            ],
          },
          events: {
            create: [
              { adminId: admin.id, type: "created", message: "Order placed by customer", createdAt: placedAt },
              ...(entry.paymentStatus === "Paid"
                ? [{ adminId: admin.id, type: "payment", message: "Payment received via PayPal", createdAt: new Date(placedAt.getTime() + 3600000) }]
                : []),
              ...(["Packed", "Shipped", "Completed"].includes(entry.status)
                ? [{ adminId: admin.id, type: "status", message: `Order moved to ${entry.status}`, createdAt: new Date(placedAt.getTime() + 2 * 86400000) }]
                : []),
            ],
          },
        },
      });
    }
    console.log(`  demo orders: ${statuses.length}`);
  }

  const messageCount = await prisma.message.count();
  if (messageCount === 0) {
    await prisma.message.createMany({
      data: [
        {
          name: "Hannah Lee",
          email: "hannah@example.com",
          subject: "Wholesale enquiry — beads",
          body: "Hi! I run a small jewellery studio in Singapore and would love to know if you offer wholesale pricing on 8mm strands. Thank you!",
        },
        {
          name: "Marco Bianchi",
          email: "marco@example.com",
          subject: "Custom cabochon request",
          body: "Do you accept requests for custom cabochon shapes? I am looking for an oval 30x20mm in moss agate.",
        },
      ],
    });
    await prisma.notification.createMany({
      data: [
        { type: "Message", title: "New message from Hannah Lee", body: "Wholesale enquiry — beads", href: "/admin/messages" },
        { type: "Message", title: "New message from Marco Bianchi", body: "Custom cabochon request", href: "/admin/messages" },
      ],
    });
    console.log("  demo messages: 2");
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
