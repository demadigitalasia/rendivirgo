export type ProductStatus = "Available" | "Sold" | "Reserved";
export type ProductTone = "moss" | "jade" | "amber" | "ocean" | "earth";

export type ProductVariant = {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  weightGram: number;
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
  weightGram: number;
  dimensions: string;
  condition: "Natural" | "Treated" | "Dyed";
  status: ProductStatus;
  tone: ProductTone;
  description: string;
  featured?: boolean;
  fragile?: boolean;
  variants?: ProductVariant[];
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

export const stoneTypes = [
  { name: "Agate", tone: "moss" as ProductTone, slug: "agate" },
  { name: "Moss Agate", tone: "jade" as ProductTone, slug: "moss-agate" },
  { name: "Jade", tone: "jade" as ProductTone, slug: "jade" },
  { name: "Chalcedony", tone: "amber" as ProductTone, slug: "chalcedony" },
  { name: "Rough Stones", tone: "earth" as ProductTone, slug: "rough" },
];

export const products: Product[] = [
  {
    id: "rv-001",
    slug: "forest-river-cabochon",
    sku: "RV-CAB-001",
    name: "Forest River Cabochon",
    category: "Cabochons",
    categorySlug: "cabochons",
    stoneType: "Moss Agate",
    origin: "West Java, Indonesia",
    price: 148,
    weightGram: 18,
    dimensions: "32 × 24 × 8 mm",
    condition: "Natural",
    status: "Available",
    tone: "moss",
    featured: true,
    description: "A polished, high-dome cabochon with deep forest inclusions and a calm river-like banding.",
  },
  {
    id: "rv-002",
    slug: "emerald-garden-cabochon",
    sku: "RV-CAB-002",
    name: "Emerald Garden Cabochon",
    category: "Cabochons",
    categorySlug: "cabochons",
    stoneType: "Chalcedony",
    origin: "Banten, Indonesia",
    price: 196,
    weightGram: 22,
    dimensions: "36 × 25 × 9 mm",
    condition: "Natural",
    status: "Available",
    tone: "jade",
    featured: true,
    description: "A rich green cabochon with botanical moss-like detail and a softly polished dome.",
  },
  {
    id: "rv-003",
    slug: "volcanic-garden-rough",
    sku: "RV-RGH-003",
    name: "Volcanic Garden Rough",
    category: "Rough",
    categorySlug: "rough",
    stoneType: "Jasper",
    origin: "East Java, Indonesia",
    price: 84,
    weightGram: 112,
    dimensions: "58 × 42 × 31 mm",
    condition: "Natural",
    status: "Available",
    tone: "earth",
    fragile: true,
    featured: true,
    description: "A characterful rough piece with promising color windows for a future lapidary cut.",
  },
  {
    id: "rv-004",
    slug: "jade-twin-pair",
    sku: "RV-PAIR-004",
    name: "Jade Twin Pair",
    category: "Pair",
    categorySlug: "pair",
    stoneType: "Jade",
    origin: "Sulawesi, Indonesia",
    price: 220,
    weightGram: 16,
    dimensions: "24 × 16 × 6 mm each",
    condition: "Natural",
    status: "Available",
    tone: "jade",
    featured: true,
    description: "A carefully matched pair with similar color, size, and soft translucent character.",
  },
  {
    id: "rv-005",
    slug: "coastal-agate-slab",
    sku: "RV-SLB-005",
    name: "Coastal Agate Slab",
    category: "Slab",
    categorySlug: "slab",
    stoneType: "Agate",
    origin: "Pacitan, Indonesia",
    price: 128,
    weightGram: 240,
    dimensions: "96 × 68 × 7 mm",
    condition: "Natural",
    status: "Reserved",
    tone: "ocean",
    description: "A broad patterned slab with a polished face that reveals layered coastal blue-green movement.",
  },
  {
    id: "rv-006",
    slug: "quiet-mountain-specimen",
    sku: "RV-SPC-006",
    name: "Quiet Mountain Specimen",
    category: "Specimen",
    categorySlug: "specimen",
    stoneType: "Jasper",
    origin: "Central Java, Indonesia",
    price: 310,
    weightGram: 680,
    dimensions: "112 × 84 × 62 mm",
    condition: "Natural",
    status: "Available",
    tone: "earth",
    fragile: true,
    featured: true,
    description: "A one-of-a-kind display piece with a sculptural silhouette and natural mineral texture.",
  },
  {
    id: "rv-007",
    slug: "moss-tumbled-selection",
    sku: "RV-TMB-007",
    name: "Moss Tumbled Selection",
    category: "Tumbled Stones",
    categorySlug: "tumbled-stones",
    stoneType: "Moss Agate",
    origin: "West Java, Indonesia",
    price: 42,
    weightGram: 250,
    dimensions: "20–35 mm per piece",
    condition: "Natural",
    status: "Available",
    tone: "moss",
    variants: [
      { id: "250g", name: "250 g pouch", price: 42, stockQuantity: 8, weightGram: 250 },
      { id: "500g", name: "500 g pouch", price: 72, stockQuantity: 4, weightGram: 500 },
    ],
    description: "Smooth, naturally varied tumbled stones selected for green inclusions and gentle polish.",
  },
  {
    id: "rv-008",
    slug: "forest-strand",
    sku: "RV-BEA-008",
    name: "Forest Bead Strand",
    category: "Beads & Strands",
    categorySlug: "beads",
    stoneType: "Agate",
    origin: "Banten, Indonesia",
    price: 118,
    weightGram: 36,
    dimensions: "8 mm beads · 15.5 in strand",
    condition: "Natural",
    status: "Available",
    tone: "moss",
    variants: [
      { id: "8mm", name: "8 mm strand", price: 118, stockQuantity: 5, weightGram: 36 },
      { id: "10mm", name: "10 mm strand", price: 146, stockQuantity: 3, weightGram: 48 },
    ],
    description: "A softly variegated strand for jewelry makers, drilled and ready to string.",
  },
];

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
];

export const formatUSD = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);

export const getProduct = (categorySlug: string, slug: string) =>
  products.find((product) => product.categorySlug === categorySlug && product.slug === slug);

export const getCategory = (slug: string) => categories.find((category) => category.slug === slug);
