import type { Metadata } from "next";
import { HomeContent } from "@/components/home-content";
import { getCategories, getProducts, getSiteContent, getTestimonials } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RENDI VIRGO | Authentic Indonesian Stones",
  description:
    "Natural semi-precious stones from Indonesia — cabochons, rough, slabs, beads, and one-of-a-kind specimens selected for collectors and makers worldwide.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [featuredResult, categories, siteContent, testimonials] = await Promise.all([
    getProducts({ featured: true, pageSize: 4 }),
    getCategories(),
    getSiteContent(),
    getTestimonials(),
  ]);

  let featured = featuredResult.products;
  if (!featured.length) {
    const latest = await getProducts({ pageSize: 4, sort: "newest" });
    featured = latest.products;
  }

  return (
    <HomeContent
      featured={featured}
      categories={categories.slice(0, 5).map((category) => ({ slug: category.slug, name: category.name }))}
      siteContent={siteContent}
      testimonials={testimonials}
    />
  );
}
