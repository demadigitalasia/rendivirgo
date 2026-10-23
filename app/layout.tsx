import { siteUrl } from "@/lib/seo";
import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { localizedPath, languageHeaderName, normalizeLanguage, originalPathHeaderName, stripLocalePrefix } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const language = normalizeLanguage(requestHeaders.get(languageHeaderName));
  const title = language === "id" ? "RENDI VIRGO | Batu Alam Indonesia" : "RENDI VIRGO | Authentic Indonesian Stones";
  const description = language === "id"
    ? "Batu alam Indonesia pilihan RENDI VIRGO untuk kolektor dan perajin di seluruh dunia."
    : "Natural Indonesian stones selected by RENDI VIRGO for collectors and makers around the world.";
  const path = stripLocalePrefix(requestHeaders.get(originalPathHeaderName) ?? "/");

  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    icons: { icon: "/favicon.svg" },
    alternates: {
      canonical: localizedPath(path, language),
      languages: { en: path, id: localizedPath(path, "id") },
    },
    openGraph: {
      type: "website",
      siteName: "RENDI VIRGO",
      locale: language === "id" ? "id_ID" : "en_GB",
      title,
      description,
      images: ["/images/rendi-virgo-hero-stones.webp"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/rendi-virgo-hero-stones.webp"],
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const language = normalizeLanguage(requestHeaders.get(languageHeaderName));

  return (
    <html lang={language === "id" ? "id-ID" : "en-GB"} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
