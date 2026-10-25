import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
import { getAllPublishedProducts, getBlogPosts, getCategories, getLapidaryContent, getPages, getSiteContent } from "@/lib/storefront";
import { localizedPath } from "@/lib/locale";

const baseUrl = siteUrl();
const BLOG_PAGE_SIZE = 9;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, translatedProducts, categories, translatedCategories, firstPage, firstTranslatedPage, pages, translatedPages, lapidary, translatedLapidary, translatedHome] = await Promise.all([
    getAllPublishedProducts("en"),
    getAllPublishedProducts("id"),
    getCategories("en"),
    getCategories("id"),
    getBlogPosts({ pageSize: 100 }, "en"),
    getBlogPosts({ pageSize: 100 }, "id"),
    getPages("en"),
    getPages("id"),
    getLapidaryContent("en"),
    getLapidaryContent("id"),
    getSiteContent("id"),
  ]);

  const collectPosts = async (first: typeof firstPage, language: "en" | "id") => {
    const posts = [...first.posts];
    for (let page = 2; page <= first.pageCount; page += 1) {
      const next = await getBlogPosts({ pageSize: 100, page }, language);
      if (!next.posts.length) break;
      posts.push(...next.posts);
    }
    return posts;
  };
  const [posts, translatedPosts] = await Promise.all([
    collectPosts(firstPage, "en"),
    collectPosts(firstTranslatedPage, "id"),
  ]);
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
  const translatedProductSlugs = new Set(translatedProducts.filter(product => product.contentLocale === "id").map(product => product.slug));
  const translatedCategorySlugs = new Set(translatedCategories.filter(category => category.contentLocale === "id").map(category => category.slug));
  const translatedPostSlugs = new Set(translatedPosts.filter(post => post.contentLocale === "id").map(post => post.slug));
  const translatedPageSlugs = new Set(translatedPages.filter(page => page.contentLocale === "id").map(page => page.slug));
  const translatedArtistSlugs = new Set(translatedLapidary.artists.filter(artist => artist.contentLocale === "id").map(artist => artist.slug));

  const localizedEntries = <T extends { path: string; lastModified?: Date; changeFrequency?: "weekly" | "monthly"; priority?: number }>(entry: T, hasIndonesianTranslation = true): MetadataRoute.Sitemap => {
    const englishUrl = `${baseUrl}${localizedPath(entry.path, "en")}`;
    const indonesianUrl = `${baseUrl}${localizedPath(entry.path, "id")}`;
    const languages = hasIndonesianTranslation ? { en: englishUrl, id: indonesianUrl } : { en: englishUrl };
    const common = {
      ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
      ...(entry.changeFrequency ? { changeFrequency: entry.changeFrequency } : {}),
      ...(entry.priority !== undefined ? { priority: entry.priority } : {}),
      alternates: { languages },
    };
    return hasIndonesianTranslation
      ? [{ url: englishUrl, ...common }, { url: indonesianUrl, ...common }]
      : [{ url: englishUrl, ...common }];
  };

  const entries: MetadataRoute.Sitemap = [
    ...staticPaths.flatMap(entry => localizedEntries(entry,
      entry.path === "/" ? translatedHome.contentLocale === "id" :
      entry.path === "/blog" ? firstTranslatedPage.posts.slice(0, BLOG_PAGE_SIZE).every(post => post.contentLocale === "id") :
      entry.path === "/lapidary/artists" ? translatedLapidary.artists.every(artist => artist.contentLocale === "id") :
      ["/about-us", "/faq", "/shipping-returns", "/privacy-policy", "/terms-conditions"].includes(entry.path)
        ? translatedPageSlugs.has(entry.path.slice(1)) && (entry.path !== "/about-us" || translatedHome.contentLocale === "id") : true)),
    ...blogArchivePages.flatMap(page => {
      const start = (page - 1) * BLOG_PAGE_SIZE;
      const pageHasTranslation = translatedPosts.slice(start, start + BLOG_PAGE_SIZE).every(post => post.contentLocale === "id") &&
        translatedPosts.slice(start, start + BLOG_PAGE_SIZE).length === posts.slice(start, start + BLOG_PAGE_SIZE).length;
      return localizedEntries({ path: `/blog?page=${page}`, changeFrequency: "weekly", priority: 0.6 }, pageHasTranslation);
    }),
    ...categories.flatMap(category => localizedEntries({
      path: `/shop/${category.slug}`,
      ...(validDate(category.updatedAt) ? { lastModified: validDate(category.updatedAt) } : {}),
      changeFrequency: "weekly",
      priority: 0.8,
    }, translatedCategorySlugs.has(category.slug))),
    ...products.flatMap(product => localizedEntries({
      path: `/shop/${product.categorySlug}/${product.slug}`,
      lastModified: validDate(product.updatedAt),
      changeFrequency: "weekly",
      priority: 0.9,
    }, translatedProductSlugs.has(product.slug))),
    ...pages
      .filter(page => !["admin", "api", "id", "en", "shop", "blog", "account", "cart", "checkout", "search", "orders", "returns", "wishlist", "wholesale", "lapidary"].includes(page.slug))
      .flatMap(page => localizedEntries({ path: `/${page.slug}`, lastModified: validDate(page.updatedAt), changeFrequency: "monthly", priority: 0.5 }, translatedPageSlugs.has(page.slug) && (page.slug !== "about-us" || translatedHome.contentLocale === "id"))),
    ...posts.flatMap(post => localizedEntries({
      path: `/blog/${post.slug}`,
      lastModified: validDate(post.updatedAt ?? post.publishedAt),
      changeFrequency: "monthly",
      priority: 0.6,
    }, translatedPostSlugs.has(post.slug))),
    ...lapidary.artists.flatMap(artist => localizedEntries({ path: `/lapidary/artists/${artist.slug}`, changeFrequency: "monthly", priority: 0.5 }, translatedArtistSlugs.has(artist.slug))),
  ];
  return [...new Map(entries.map(entry => [entry.url, entry])).values()];
}
