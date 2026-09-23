import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, formatContentDate } from "@/components/page-body";
import { getBlogPost } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return {};
  const description = post.metaDescription ?? post.excerpt;
  return {
    title: post.metaTitle ?? `${post.title} | RENDI VIRGO Journal`,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title: post.title, description, type: "article" },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const publishedAt = post.publishedAt ?? post.updatedAt;
  const publishedLabel = formatContentDate(publishedAt);
  const category = post.tags[0] ?? "Journal";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: publishedAt,
    dateModified: post.updatedAt,
    ...(post.coverImage ? { image: [post.coverImage] } : {}),
    author: { "@type": "Organization", name: post.author || "RENDI VIRGO" },
    publisher: { "@type": "Organization", name: "RENDI VIRGO" },
  };

  return (
    <div className="page-container content-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="article">
        <div className="eyebrow">
          {category} · {publishedLabel}
        </div>
        <h1>{post.title}</h1>
        <div className="article__meta">
          <span>{post.author || "RENDI VIRGO"}</span>
          <span>{publishedLabel}</span>
          <span>{post.readMinutes} min read</span>
          {post.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <p className="article__lead">{post.excerpt}</p>
        <PageBody body={post.body ?? ""} className="article__body" />
        <div style={{ marginTop: 35 }}>
          <Link href="/blog" className="button button--outline">
            Back to journal
          </Link>
        </div>
      </article>
    </div>
  );
}
