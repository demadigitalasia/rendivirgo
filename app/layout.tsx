import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://rendivirgo.com"),
  title: "RENDI VIRGO | Authentic Indonesian Stones",
  description: "Natural Indonesian stones selected by RENDI VIRGO for collectors and makers around the world.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: "RENDI VIRGO",
    title: "RENDI VIRGO | Authentic Indonesian Stones",
    description: "Natural Indonesian stones selected by RENDI VIRGO for collectors and makers around the world.",
    images: ["/images/rendi-virgo-hero-stones.webp"],
  },
  twitter: {
    card: "summary_large_image",
    title: "RENDI VIRGO | Authentic Indonesian Stones",
    description: "Natural Indonesian stones selected by RENDI VIRGO for collectors and makers around the world.",
    images: ["/images/rendi-virgo-hero-stones.webp"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
