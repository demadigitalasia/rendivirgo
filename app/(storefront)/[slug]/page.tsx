import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiContentPage, contentPageMetadata } from "@/components/api-content-page";
import { getPage } from "@/lib/storefront";
import { getRequestLanguage } from "@/lib/server-locale";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug, await getRequestLanguage());
  if (!page) notFound();
  return contentPageMetadata(slug, { title: `${page.title} | RENDI VIRGO`, description: page.metaDescription || page.title });
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ApiContentPage slug={slug} eyebrow="RENDI VIRGO" />;
}
