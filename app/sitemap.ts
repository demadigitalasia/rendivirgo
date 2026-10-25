import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
import { getAllPublishedProducts, getBlogPosts, getCategories, getLapidaryContent, getPages } from "@/lib/storefront";

const baseUrl = siteUrl();
const BLOG_PAGE_SIZE = 9;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, firstPage, pages, lapidary] = await Promise.all([
    getAllPublishedProducts("en"),
    getCategories("en"),
    getBlogPosts({ pageSize: 100 }, "en"),
    getPages("en"),
    getLapidaryContent("en"),
  ]);

  const posts = [...firstPage.posts];
  for (let page = 2; page <= firstPage.pageCount; page += 1) {
    const next = await getBlogPosts({ pageSize: 100, page }, "en");
    if (!next.posts.length) break;
    posts.push(...next.posts);
  }

  const storefrontPageCount = Math.ceil(firstPage.total / BLOG_PAGE_SIZE);
  const blogArchivePages = Array.from({ length: Math.max(0, storefrontPageCount - 1) }, (_, index) => index + 2);
  const staticPaths: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/shop", priority: 0.9, changeFrequency: "weekly" },
    { path: "/about-us", priority: 0.7, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
    { path: "/wholesale", priority: 0.7, changeFrequency: "monthly" },
    { path: "/wholesale/rough", priority: 0.6, changeFrequency: "monthly" },
    { path: "/lapidary", priority: 0.7, changeFrequency: "monthly" },
    { path: "/lapidary/custom-order", priority: 0.7, changeFrequency: "monthly" },
    { path: "/lapidary/studio", priority: 0.6, changeFrequency: "monthly" },
    { path: "/lapidary/artists", priority: 0.5, changeFrequency: "monthly" },
    { path: "/lapidary/process", priority: 0.6, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
    { path: "/shipping-returns", priority: 0.5, changeFrequency: "monthly" },
    { path: "/privacy-policy", priority: 0.3, changeFrequency: "monthly" },
    { path: "/terms-conditions", priority: 0.3, changeFrequency: "monthly" },
  ];

  const validDate = (value: string | null | undefined) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : undefined;
  };

  const entry = (item: {
    path: string;
    lastModified?: Date;
    changeFrequency?: "weekly" | "monthly";
    priority?: number;
  }): MetadataRoute.Sitemap[number] => {
    const url = `${baseUrl}${item.path}`;
    return {
      url,
      ...(item.lastModified ? { lastModified: item.lastModified } : {}),
      ...(item.changeFrequency ? { changeFrequency: item.changeFrequency } : {}),
      ...(item.priority !== undefined ? { priority: item.priority } : {}),
      alternates: { languages: { en: url } },
    };
  };

  const entries: MetadataRoute.Sitemap = [
    ...staticPaths.map(entry),
    ...blogArchivePages.map(page => entry({ path: `/blog?page=${page}`, changeFrequency: "weekly", priority: 0.6 })),
    ...categories.map(category => entry({
      path: `/shop/${category.slug}`,
      ...(validDate(category.updatedAt) ? { lastModified: validDate(category.updatedAt) } : {}),
      changeFrequency: "weekly",
      priority: 0.8,
    })),
    ...products.map(product => entry({
      path: `/shop/${product.categorySlug}/${product.slug}`,
      lastModified: validDate(product.updatedAt),
      changeFrequency: "weekly",
      priority: 0.9,
    })),
    ...pages
      .filter(page => !["admin", "api", "id", "en", "shop", "blog", "account", "cart", "checkout", "search", "orders", "returns", "wishlist", "wholesale", "lapidary"].includes(page.slug))
      .map(page => entry({ path: `/${page.slug}`, lastModified: validDate(page.updatedAt), changeFrequency: "monthly", priority: 0.5 })),
    ...posts.map(post => entry({
      path: `/blog/${post.slug}`,
      lastModified: validDate(post.updatedAt ?? post.publishedAt),
      changeFrequency: "monthly",
      priority: 0.6,
    })),
    ...lapidary.artists.map(artist => entry({ path: `/lapidary/artists/${artist.slug}`, changeFrequency: "monthly", priority: 0.5 })),
  ];

  return [...new Map(entries.map(item => [item.url, item])).values()];
}
