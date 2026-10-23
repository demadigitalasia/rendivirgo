import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
import { getAllPublishedProducts, getBlogPosts, getCategories, getPages } from "@/lib/storefront";
import { localizedPath } from "@/lib/locale";

const baseUrl = siteUrl();
const BLOG_PAGE_SIZE = 9;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const toDate = (value: string | null | undefined) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : now;
  };
  const [products, categories, firstPage, pages] = await Promise.all([
    getAllPublishedProducts(),
    getCategories(),
    getBlogPosts({ pageSize: 100 }),
    getPages(),
  ]);

  const posts = [...firstPage.posts];
  for (let page = 2; page <= firstPage.pageCount; page += 1) {
    const next = await getBlogPosts({ pageSize: 100, page });
    if (!next.posts.length) break;
    posts.push(...next.posts);
  }
  const storefrontPageCount = Math.ceil(firstPage.total / BLOG_PAGE_SIZE);
  const blogArchivePages = Array.from({ length: Math.max(0, storefrontPageCount - 1) }, (_, index) => index + 2);
  const staticPaths: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/shop", priority: 0.9, changeFrequency: "weekly" },
    { path: "/about-us", priority: 0.7, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
    { path: "/track", priority: 0.5, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
    { path: "/shipping-returns", priority: 0.5, changeFrequency: "monthly" },
    { path: "/privacy-policy", priority: 0.3, changeFrequency: "monthly" },
    { path: "/terms-conditions", priority: 0.3, changeFrequency: "monthly" },
  ];
  const localizedEntry = <T extends { url: string }>(entry: T) => {
    const path = entry.url.slice(baseUrl.length);
    return {
      ...entry,
      alternates: {
        languages: {
          en: `${baseUrl}${localizedPath(path, "en")}`,
          id: `${baseUrl}${localizedPath(path, "id")}`,
        },
      },
    };
  };

  const entries: MetadataRoute.Sitemap = [
    ...staticPaths.map((entry) => localizedEntry({
      url: `${baseUrl}${entry.path}`,
      lastModified: now,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
    })),
    ...blogArchivePages.map((page) => localizedEntry({
      url: `${baseUrl}/blog?page=${page}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...categories.map((category) => localizedEntry({
      url: `${baseUrl}/shop/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((product) => localizedEntry({
      url: `${baseUrl}/shop/${product.categorySlug}/${product.slug}`,
      lastModified: toDate(product.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...pages.filter(page => !["admin", "api", "id", "en", "shop", "blog", "account", "cart", "checkout", "search", "orders", "returns", "wishlist", "wholesale"].includes(page.slug)).map(page => localizedEntry({ url: `${baseUrl}/${page.slug}`, lastModified: toDate(page.updatedAt), changeFrequency: "monthly" as const, priority: 0.5 })),
    ...posts.map((post) => localizedEntry({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: toDate(post.updatedAt ?? post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
  return [...new Map(entries.map(entry => [entry.url, entry])).values()];
}
