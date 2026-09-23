import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody } from "@/components/page-body";
import { getPage } from "@/lib/storefront";

export async function contentPageMetadata(
  slug: string,
  fallback: { title: string; description: string },
): Promise<Metadata> {
  const page = await getPage(slug);
  return {
    title: page?.metaTitle ?? fallback.title,
    description: page?.metaDescription ?? fallback.description,
    alternates: { canonical: `/${slug}` },
  };
}

export async function ApiContentPage({ slug, eyebrow }: { slug: string; eyebrow: string }) {
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <div className="page-container content-page">
      <div className="content-page__intro">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{page.title}</h1>
      </div>
      <PageBody body={page.body} />
    </div>
  );
}
