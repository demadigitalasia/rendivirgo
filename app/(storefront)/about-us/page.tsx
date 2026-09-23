import type { Metadata } from "next";
import { ApiContentPage, contentPageMetadata } from "@/components/api-content-page";

export const dynamic = "force-dynamic";

const fallback = {
  title: "About Us — Sourcing Indonesian Stones | RENDI VIRGO",
  description: "RENDI VIRGO is an independent stone collection built around curiosity, provenance, and sharing authentic Indonesian material with collectors and makers worldwide.",
};

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata("about-us", fallback);
}

export default function AboutPage() {
  return <ApiContentPage slug="about-us" eyebrow="The story behind the stones" />;
}
