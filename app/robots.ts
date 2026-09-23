import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/cart", "/checkout", "/search"],
    },
    sitemap: "https://rendivirgo.com/sitemap.xml",
  };
}
