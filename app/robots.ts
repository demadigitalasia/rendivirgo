import { siteUrl } from "@/lib/seo";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/id/admin", "/id/api"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
