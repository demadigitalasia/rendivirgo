import { siteUrl } from "@/lib/seo";
import type { Metadata } from "next";
import { getPublicSettings } from "@/lib/storefront";
import { GoogleAnalytics } from "@/components/google-analytics";
import "./globals.css";

const fallbackTitle = "RENDI VIRGO | Authentic Indonesian Stones";
const fallbackDescription = "Natural Indonesian stones selected by RENDI VIRGO for collectors and makers around the world.";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  const title = settings?.seo.defaultTitle.trim() || fallbackTitle;
  const description = settings?.seo.defaultDescription.trim() || fallbackDescription;

  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    icons: { icon: "/favicon.svg", apple: "/apple-icon.png" },
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      siteName: "RENDI VIRGO",
      locale: "en_GB",
      title,
      description,
      images: ["/images/rendi-virgo-og.jpg"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/rendi-virgo-og.jpg"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" data-scroll-behavior="smooth">
      <body>
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
