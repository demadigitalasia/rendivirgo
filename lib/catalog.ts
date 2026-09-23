export type ProductStatus = "Available" | "Sold" | "Reserved";
export type ProductTone = "moss" | "jade" | "amber" | "ocean" | "earth";
export type StockModel = "Unique" | "Quantity";
export type Unit = "piece" | "pair" | "gram" | "carat" | "strand" | "bag";
export type ShippingClass = "Standard" | "Fragile" | "Oversized" | "Custom";
export type DimensionsMm = { length: number; width: number; height: number };

export type ProductVariant = {
  id: string;
  sku: string;
  name: string;
  price: number;
  stockQuantity: number;
  weightGram: number;
  dimensionsMm: DimensionsMm;
  shippingProfileId: string;
};

export type ShippingProfile = {
  packageWeightGram: number;
  packageDimensionsMm: DimensionsMm;
  shippingProfileId: string;
  shippingClass: ShippingClass;
  calculationMethod: "CarrierAPI" | "AdminOverride";
  packageModel: "SinglePackageTotalWeight";
};

export type ProductSeo = {
  metaTitle: string;
  metaDescription: string;
};

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: string;
  categorySlug: string;
  stoneType: string;
  origin: string;
  price: number;
  currency: "USD";
  unit: Unit;
  stockModel: StockModel;
  stockQuantity?: number;
  weightGram: number;
  weightCarat: number;
  dimensionsMm: DimensionsMm;
  condition: "Natural" | "Treated" | "Dyed";
  status: ProductStatus;
  tone: ProductTone;
  description: string;
  images: string[];
  seo: ProductSeo;
  shipping: ShippingProfile;
  featured?: boolean;
  fragile?: boolean;
  variants?: ProductVariant[];
  createdAt: string;
  updatedAt: string;
};

export const categories = [
  { slug: "cabochons", name: "Cabochons", note: "Ready to set" },
  { slug: "pair", name: "Pair", note: "Matched stones" },
  { slug: "rough", name: "Rough", note: "Natural material" },
  { slug: "slab", name: "Slab", note: "Lapidary canvas" },
  { slug: "specimen", name: "Specimen", note: "Display pieces" },
  { slug: "tumbled-stones", name: "Tumbled Stones", note: "Polished smooth" },
  { slug: "beads", name: "Beads & Strands", note: "Made to string" },
  { slug: "faceted", name: "Faceted Gemstones", note: "Precision cut" },
  { slug: "spheres-shapes", name: "Spheres & Shapes", note: "Sculptural forms" },
  { slug: "crystal-points", name: "Crystal Points", note: "Natural formations" },
  { slug: "carvings", name: "Carved Stones", note: "Hand finished" },
  { slug: "drilled-briolettes", name: "Drilled & Briolettes", note: "Ready to wear" },
  { slug: "chips", name: "Chips & Crushed", note: "For craft and inlay" },
];

export const coreCategories = categories.slice(0, 5);

export const stoneTypes = [
  { name: "Agate", tone: "moss" as ProductTone, slug: "agate" },
  { name: "Moss Agate", tone: "jade" as ProductTone, slug: "moss-agate" },
  { name: "Jade", tone: "jade" as ProductTone, slug: "jade" },
  { name: "Chalcedony", tone: "amber" as ProductTone, slug: "chalcedony" },
  { name: "Jasper", tone: "earth" as ProductTone, slug: "jasper" },
  { name: "Quartz", tone: "ocean" as ProductTone, slug: "quartz" },
  { name: "Amethyst", tone: "amber" as ProductTone, slug: "amethyst" },
];

type ProductSeed = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  categorySlug: string;
  stoneType: string;
  origin: string;
  price: number;
  unit: Unit;
  weightGram: number;
  dimensions: [number, number, number];
  tone: ProductTone;
  description: string;
  status?: ProductStatus;
  condition?: "Natural" | "Treated" | "Dyed";
  stockModel?: StockModel;
  stockQuantity?: number;
  featured?: boolean;
  fragile?: boolean;
  createdAt: string;
  variants?: {
    id: string;
    name: string;
    price: number;
    stockQuantity: number;
    weightGram: number;
    dimensions: [number, number, number];
  }[];
};

const toDimensions = ([length, width, height]: [number, number, number]): DimensionsMm => ({ length, width, height });

const shippingClassFor = (categorySlug: string, fragile?: boolean): ShippingClass => {
  if (fragile) return "Fragile";
  if (["specimen", "spheres-shapes", "crystal-points", "carvings"].includes(categorySlug)) return "Oversized";
  return "Standard";
};

const categoryName = (slug: string) => categories.find((category) => category.slug === slug)?.name ?? slug;

const defineProduct = (seed: ProductSeed): Product => {
  const dimensionsMm = toDimensions(seed.dimensions);
  const category = categoryName(seed.categorySlug);
  const stockModel = seed.stockModel ?? "Unique";
  return {
    id: seed.id,
    slug: seed.slug,
    sku: seed.sku,
    name: seed.name,
    category,
    categorySlug: seed.categorySlug,
    stoneType: seed.stoneType,
    origin: seed.origin,
    price: seed.price,
    currency: "USD",
    unit: seed.unit,
    stockModel,
    ...(seed.stockQuantity === undefined ? {} : { stockQuantity: seed.stockQuantity }),
    weightGram: seed.weightGram,
    weightCarat: Math.round(seed.weightGram * 5 * 10) / 10,
    dimensionsMm,
    condition: seed.condition ?? "Natural",
    status: seed.status ?? "Available",
    tone: seed.tone,
    description: seed.description,
    images: [`/images/products/stone-${seed.tone}.svg`],
    seo: {
      metaTitle: `${seed.name} — ${category} | RENDI VIRGO`,
      metaDescription: `${seed.description} ${seed.stoneType} from ${seed.origin}. ${seed.weightGram} g.`,
    },
    shipping: {
      packageWeightGram: seed.weightGram + 45,
      packageDimensionsMm: {
        length: dimensionsMm.length + 30,
        width: dimensionsMm.width + 30,
        height: dimensionsMm.height + 20,
      },
      shippingProfileId: "rv-worldwide-standard",
      shippingClass: shippingClassFor(seed.categorySlug, seed.fragile),
      calculationMethod: "CarrierAPI",
      packageModel: "SinglePackageTotalWeight",
    },
    featured: seed.featured,
    fragile: seed.fragile,
    variants: seed.variants?.map((variant) => ({
      id: variant.id,
      sku: `${seed.sku}-${variant.id.toUpperCase()}`,
      name: variant.name,
      price: variant.price,
      stockQuantity: variant.stockQuantity,
      weightGram: variant.weightGram,
      dimensionsMm: toDimensions(variant.dimensions),
      shippingProfileId: "rv-worldwide-standard",
    })),
    createdAt: seed.createdAt,
    updatedAt: seed.createdAt,
  };
};

const seeds: ProductSeed[] = [
  {
    id: "rv-001",
    slug: "forest-river-cabochon",
    sku: "RV-CAB-001",
    name: "Forest River Cabochon",
    categorySlug: "cabochons",
    stoneType: "Moss Agate",
    origin: "West Java, Indonesia",
    price: 148,
    unit: "piece",
    weightGram: 18,
    dimensions: [32, 24, 8],
    tone: "moss",
    featured: true,
    createdAt: "2026-09-18",
    description: "A polished, high-dome cabochon with deep forest inclusions and a calm river-like banding.",
  },
  {
    id: "rv-002",
    slug: "emerald-garden-cabochon",
    sku: "RV-CAB-002",
    name: "Emerald Garden Cabochon",
    categorySlug: "cabochons",
    stoneType: "Chalcedony",
    origin: "Banten, Indonesia",
    price: 196,
    unit: "piece",
    weightGram: 22,
    dimensions: [36, 25, 9],
    tone: "jade",
    featured: true,
    createdAt: "2026-09-15",
    description: "A rich green cabochon with botanical moss-like detail and a softly polished dome.",
  },
  {
    id: "rv-003",
    slug: "volcanic-garden-rough",
    sku: "RV-RGH-003",
    name: "Volcanic Garden Rough",
    categorySlug: "rough",
    stoneType: "Jasper",
    origin: "East Java, Indonesia",
    price: 84,
    unit: "piece",
    weightGram: 112,
    dimensions: [58, 42, 31],
    tone: "earth",
    featured: true,
    fragile: true,
    stockModel: "Quantity",
    stockQuantity: 4,
    createdAt: "2026-09-12",
    description: "A characterful rough piece with promising color windows for a future lapidary cut.",
  },
  {
    id: "rv-004",
    slug: "jade-twin-pair",
    sku: "RV-PAIR-004",
    name: "Jade Twin Pair",
    categorySlug: "pair",
    stoneType: "Jade",
    origin: "Sulawesi, Indonesia",
    price: 220,
    unit: "pair",
    weightGram: 16,
    dimensions: [24, 16, 6],
    tone: "jade",
    featured: true,
    createdAt: "2026-09-10",
    description: "A carefully matched pair with similar color, size, and soft translucent character.",
  },
  {
    id: "rv-005",
    slug: "coastal-agate-slab",
    sku: "RV-SLB-005",
    name: "Coastal Agate Slab",
    categorySlug: "slab",
    stoneType: "Agate",
    origin: "Pacitan, Indonesia",
    price: 128,
    unit: "piece",
    weightGram: 240,
    dimensions: [96, 68, 7],
    tone: "ocean",
    status: "Reserved",
    stockModel: "Quantity",
    stockQuantity: 1,
    createdAt: "2026-09-08",
    description: "A broad patterned slab with a polished face that reveals layered coastal blue-green movement.",
  },
  {
    id: "rv-006",
    slug: "quiet-mountain-specimen",
    sku: "RV-SPC-006",
    name: "Quiet Mountain Specimen",
    categorySlug: "specimen",
    stoneType: "Jasper",
    origin: "Central Java, Indonesia",
    price: 310,
    unit: "piece",
    weightGram: 680,
    dimensions: [112, 84, 62],
    tone: "earth",
    featured: true,
    fragile: true,
    createdAt: "2026-09-05",
    description: "A one-of-a-kind display piece with a sculptural silhouette and natural mineral texture.",
  },
  {
    id: "rv-007",
    slug: "moss-tumbled-selection",
    sku: "RV-TMB-007",
    name: "Moss Tumbled Selection",
    categorySlug: "tumbled-stones",
    stoneType: "Moss Agate",
    origin: "West Java, Indonesia",
    price: 42,
    unit: "gram",
    weightGram: 250,
    dimensions: [120, 90, 40],
    tone: "moss",
    stockModel: "Quantity",
    stockQuantity: 8,
    createdAt: "2026-09-02",
    description: "Smooth, naturally varied tumbled stones selected for green inclusions and gentle polish.",
    variants: [
      { id: "250g", name: "250 g pouch", price: 42, stockQuantity: 8, weightGram: 250, dimensions: [120, 90, 40] },
      { id: "500g", name: "500 g pouch", price: 72, stockQuantity: 4, weightGram: 500, dimensions: [160, 120, 60] },
    ],
  },
  {
    id: "rv-008",
    slug: "forest-strand",
    sku: "RV-BEA-008",
    name: "Forest Bead Strand",
    categorySlug: "beads",
    stoneType: "Agate",
    origin: "Banten, Indonesia",
    price: 118,
    unit: "strand",
    weightGram: 36,
    dimensions: [400, 10, 10],
    tone: "moss",
    stockModel: "Quantity",
    stockQuantity: 5,
    createdAt: "2026-08-30",
    description: "A softly variegated strand for jewelry makers, drilled and ready to string.",
    variants: [
      { id: "8mm", name: "8 mm strand", price: 118, stockQuantity: 5, weightGram: 36, dimensions: [400, 8, 8] },
      { id: "10mm", name: "10 mm strand", price: 146, stockQuantity: 3, weightGram: 48, dimensions: [400, 10, 10] },
    ],
  },
  {
    id: "rv-009",
    slug: "misty-ridge-oval-cut",
    sku: "RV-FAC-009",
    name: "Misty Ridge Oval Cut",
    categorySlug: "faceted",
    stoneType: "Quartz",
    origin: "Bangka Belitung, Indonesia",
    price: 265,
    unit: "piece",
    weightGram: 6.4,
    dimensions: [14, 10, 6],
    tone: "earth",
    featured: true,
    createdAt: "2026-08-28",
    description: "A precision oval cut with soft smoky tone and clean faceting for a fine jewelry setting.",
  },
  {
    id: "rv-010",
    slug: "clear-water-round-brilliant",
    sku: "RV-FAC-010",
    name: "Clear Water Round Brilliant",
    categorySlug: "faceted",
    stoneType: "Quartz",
    origin: "Bangka Belitung, Indonesia",
    price: 340,
    unit: "piece",
    weightGram: 5.1,
    dimensions: [11, 11, 7],
    tone: "ocean",
    createdAt: "2026-08-25",
    description: "A bright round brilliant with lively reflection, calibrated for standard setting sizes.",
  },
  {
    id: "rv-011",
    slug: "forest-sphere",
    sku: "RV-SPH-011",
    name: "Forest Sphere",
    categorySlug: "spheres-shapes",
    stoneType: "Agate",
    origin: "Pacitan, Indonesia",
    price: 185,
    unit: "piece",
    weightGram: 420,
    dimensions: [62, 62, 62],
    tone: "moss",
    createdAt: "2026-08-22",
    description: "A hand-polished sphere with even green banding, paired with a simple display ring.",
  },
  {
    id: "rv-012",
    slug: "ivory-obelisk",
    sku: "RV-SPH-012",
    name: "Ivory Obelisk",
    categorySlug: "spheres-shapes",
    stoneType: "Chalcedony",
    origin: "Banten, Indonesia",
    price: 96,
    unit: "piece",
    weightGram: 180,
    dimensions: [110, 34, 34],
    tone: "amber",
    createdAt: "2026-08-20",
    description: "A soft ivory obelisk with gentle translucency, finished for shelf or desk display.",
  },
  {
    id: "rv-013",
    slug: "veil-point-cluster",
    sku: "RV-CPT-013",
    name: "Veil Point Cluster",
    categorySlug: "crystal-points",
    stoneType: "Quartz",
    origin: "West Java, Indonesia",
    price: 158,
    unit: "piece",
    weightGram: 340,
    dimensions: [95, 70, 58],
    tone: "jade",
    fragile: true,
    createdAt: "2026-08-18",
    description: "A natural cluster of translucent points on matrix, full of light and movement.",
  },
  {
    id: "rv-014",
    slug: "dusk-amethyst-point",
    sku: "RV-CPT-014",
    name: "Dusk Amethyst Point",
    categorySlug: "crystal-points",
    stoneType: "Amethyst",
    origin: "West Java, Indonesia",
    price: 122,
    unit: "piece",
    weightGram: 210,
    dimensions: [128, 52, 46],
    tone: "amber",
    fragile: true,
    createdAt: "2026-08-16",
    description: "A single amethyst point with a violet gradient that deepens toward the termination.",
  },
  {
    id: "rv-015",
    slug: "leaf-carved-pendant",
    sku: "RV-CRV-015",
    name: "Leaf Carved Pendant",
    categorySlug: "carvings",
    stoneType: "Jade",
    origin: "Sulawesi, Indonesia",
    price: 88,
    unit: "piece",
    weightGram: 12,
    dimensions: [38, 20, 6],
    tone: "jade",
    createdAt: "2026-08-14",
    description: "A small hand-carved leaf with fine vein detail and a soft polished surface.",
  },
  {
    id: "rv-016",
    slug: "sitting-frog-figurine",
    sku: "RV-CRV-016",
    name: "Sitting Frog Figurine",
    categorySlug: "carvings",
    stoneType: "Jasper",
    origin: "Central Java, Indonesia",
    price: 135,
    unit: "piece",
    weightGram: 240,
    dimensions: [72, 58, 46],
    tone: "earth",
    createdAt: "2026-08-12",
    description: "A whimsical carved figurine with warm earth tones and a friendly, compact form.",
  },
  {
    id: "rv-017",
    slug: "drilled-dewdrop",
    sku: "RV-DRL-017",
    name: "Drilled Dewdrop",
    categorySlug: "drilled-briolettes",
    stoneType: "Chalcedony",
    origin: "Banten, Indonesia",
    price: 64,
    unit: "piece",
    weightGram: 4.2,
    dimensions: [18, 11, 9],
    tone: "ocean",
    fragile: true,
    createdAt: "2026-08-10",
    description: "A translucent dewdrop shape drilled from the top, ready for a pendant setting.",
  },
  {
    id: "rv-018",
    slug: "briolette-earring-pair",
    sku: "RV-DRL-018",
    name: "Briolette Earring Pair",
    categorySlug: "drilled-briolettes",
    stoneType: "Moss Agate",
    origin: "West Java, Indonesia",
    price: 98,
    unit: "pair",
    weightGram: 8,
    dimensions: [22, 10, 10],
    tone: "moss",
    createdAt: "2026-08-08",
    description: "Two matched briolettes drilled for earrings, with mirrored mossy patterns.",
  },
  {
    id: "rv-019",
    slug: "forest-chip-pouch",
    sku: "RV-CHP-019",
    name: "Forest Chip Pouch",
    categorySlug: "chips",
    stoneType: "Agate",
    origin: "Pacitan, Indonesia",
    price: 18,
    unit: "bag",
    weightGram: 250,
    dimensions: [150, 110, 60],
    tone: "moss",
    stockModel: "Quantity",
    stockQuantity: 12,
    createdAt: "2026-08-06",
    description: "Washed agate chips for resin work, inlay, and decorative craft projects.",
  },
  {
    id: "rv-020",
    slug: "jasper-crushed-pouch",
    sku: "RV-CHP-020",
    name: "Jasper Crushed Pouch",
    categorySlug: "chips",
    stoneType: "Jasper",
    origin: "East Java, Indonesia",
    price: 26,
    unit: "bag",
    weightGram: 500,
    dimensions: [180, 130, 80],
    tone: "earth",
    stockModel: "Quantity",
    stockQuantity: 6,
    createdAt: "2026-08-04",
    description: "Coarse crushed jasper with warm tones, graded for terrazzo and inlay work.",
  },
  {
    id: "rv-021",
    slug: "ocean-tumbled-selection",
    sku: "RV-TMB-021",
    name: "Ocean Tumbled Selection",
    categorySlug: "tumbled-stones",
    stoneType: "Chalcedony",
    origin: "Banten, Indonesia",
    price: 46,
    unit: "gram",
    weightGram: 300,
    dimensions: [130, 95, 45],
    tone: "ocean",
    stockModel: "Quantity",
    stockQuantity: 6,
    createdAt: "2026-08-02",
    description: "A calm selection of blue-green tumbled stones with a satin polish.",
  },
  {
    id: "rv-022",
    slug: "amber-nugget-strand",
    sku: "RV-BEA-022",
    name: "Amber Nugget Strand",
    categorySlug: "beads",
    stoneType: "Agate",
    origin: "Banten, Indonesia",
    price: 132,
    unit: "strand",
    weightGram: 52,
    dimensions: [400, 12, 12],
    tone: "amber",
    stockModel: "Quantity",
    stockQuantity: 4,
    createdAt: "2026-07-30",
    description: "A warm strand of irregular nugget beads, each with its own banding pattern.",
  },
  {
    id: "rv-023",
    slug: "harvest-oval-cabochon",
    sku: "RV-CAB-023",
    name: "Harvest Oval Cabochon",
    categorySlug: "cabochons",
    stoneType: "Jasper",
    origin: "East Java, Indonesia",
    price: 112,
    unit: "piece",
    weightGram: 15,
    dimensions: [28, 22, 7],
    tone: "amber",
    createdAt: "2026-07-28",
    description: "An oval cabochon with warm harvest colors and a clean, even dome.",
  },
  {
    id: "rv-024",
    slug: "druzy-river-geode",
    sku: "RV-SPC-024",
    name: "Druzy River Geode",
    categorySlug: "specimen",
    stoneType: "Agate",
    origin: "Pacitan, Indonesia",
    price: 268,
    unit: "piece",
    weightGram: 890,
    dimensions: [135, 108, 74],
    tone: "ocean",
    status: "Sold",
    fragile: true,
    createdAt: "2026-07-25",
    description: "A river-worn geode with a druzy interior that catches light from every angle.",
  },
  {
    id: "rv-025",
    slug: "moss-garden-rough-lot",
    sku: "RV-RGH-025",
    name: "Moss Garden Rough Lot",
    categorySlug: "rough",
    stoneType: "Moss Agate",
    origin: "West Java, Indonesia",
    price: 64,
    unit: "gram",
    weightGram: 500,
    dimensions: [180, 140, 90],
    tone: "jade",
    stockModel: "Quantity",
    stockQuantity: 5,
    createdAt: "2026-07-22",
    description: "A 500 gram lot of rough with visible moss windows, ideal for practice cutting.",
  },
  {
    id: "rv-026",
    slug: "pattern-window-slab",
    sku: "RV-SLB-026",
    name: "Pattern Window Slab",
    categorySlug: "slab",
    stoneType: "Jasper",
    origin: "Central Java, Indonesia",
    price: 84,
    unit: "piece",
    weightGram: 310,
    dimensions: [110, 78, 8],
    tone: "earth",
    stockModel: "Quantity",
    stockQuantity: 2,
    createdAt: "2026-07-20",
    description: "A slab with one polished window revealing landscape-like banding in warm tones.",
  },
  {
    id: "rv-027",
    slug: "ocean-twin-cabochons",
    sku: "RV-PAIR-027",
    name: "Ocean Twin Cabochons",
    categorySlug: "pair",
    stoneType: "Chalcedony",
    origin: "Banten, Indonesia",
    price: 186,
    unit: "pair",
    weightGram: 14,
    dimensions: [20, 15, 5],
    tone: "ocean",
    createdAt: "2026-07-18",
    description: "A matched pair with cool blue-green translucency, cut for small earrings.",
  },
  {
    id: "rv-028",
    slug: "moonlit-rose-cut",
    sku: "RV-FAC-028",
    name: "Moonlit Rose Cut",
    categorySlug: "faceted",
    stoneType: "Quartz",
    origin: "Bangka Belitung, Indonesia",
    price: 148,
    unit: "piece",
    weightGram: 4.8,
    dimensions: [12, 12, 5],
    tone: "ocean",
    createdAt: "2026-07-15",
    description: "A soft rose cut with a calm, moonlit sheen that suits understated settings.",
  },
];

export const products: Product[] = seeds.map(defineProduct);

export const blogPosts = [
  {
    slug: "how-to-read-a-cabochon",
    category: "Stone Education",
    title: "How to Read a Cabochon",
    excerpt: "A practical guide to dome, polish, pattern, and the small details that make a cabochon special.",
    date: "September 18, 2026",
  },
  {
    slug: "from-indonesia-to-your-workbench",
    category: "Sourcing Stories",
    title: "From Indonesia to Your Workbench",
    excerpt: "A closer look at the people, places, and patient hands behind our natural stone collections.",
    date: "September 10, 2026",
  },
  {
    slug: "caring-for-polished-stones",
    category: "Care Guide",
    title: "Caring for Polished Stones",
    excerpt: "Simple habits that protect polish, color, and character for years to come.",
    date: "September 02, 2026",
  },
  {
    slug: "why-origin-matters",
    category: "Sourcing Stories",
    title: "Why Origin Matters",
    excerpt: "Regional geology gives every stone its signature. Here is how to read provenance with confidence.",
    date: "August 26, 2026",
  },
  {
    slug: "cabochon-or-faceted",
    category: "Stone Education",
    title: "Cabochon or Faceted?",
    excerpt: "Two cuts, two personalities. A practical comparison for makers choosing the right finish.",
    date: "August 19, 2026",
  },
  {
    slug: "packing-fragile-stones",
    category: "Shipping Notes",
    title: "How We Pack Fragile Stones",
    excerpt: "From wrapping to one-parcel consolidation, the steps that keep delicate pieces safe in transit.",
    date: "August 12, 2026",
  },
];

export const formatUSD = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);

export const formatDimensions = ({ length, width, height }: DimensionsMm) => `${length} × ${width} × ${height} mm`;

export const getProduct = (categorySlug: string, slug: string) =>
  products.find((product) => product.categorySlug === categorySlug && product.slug === slug);

export const getCategory = (slug: string) => categories.find((category) => category.slug === slug);

export const maxQuantityFor = (product: Product, variantId?: string) => {
  const variant = product.variants?.find((item) => item.id === variantId);
  if (variant) return Math.max(1, variant.stockQuantity);
  if (product.stockModel === "Quantity") return Math.max(1, product.stockQuantity ?? 1);
  return 1;
};

export const searchProducts = (query: string) => {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return products.filter((product) =>
    [product.name, product.stoneType, product.category, product.origin, product.sku].some((value) =>
      value.toLowerCase().includes(term),
    ),
  );
};
