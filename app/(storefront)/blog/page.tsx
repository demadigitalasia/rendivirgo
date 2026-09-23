import type { Metadata } from "next";
import Link from "next/link";
import { formatContentDate } from "@/components/page-body";
import { getBlogPosts } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journal — Stone Guides & Sourcing Stories | RENDI VIRGO",
  description: "Practical guidance, sourcing stories, and care notes for collectors, jewelry makers, and lapidary enthusiasts working with Indonesian stones.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const { posts } = await getBlogPosts();

  return (
    <div className="page-container content-page">
      <div className="content-page__intro">
        <div className="eyebrow">The journal</div>
        <h1>Notes from the collection.</h1>
        <p>Practical guidance, sourcing stories, and small observations for anyone who enjoys natural stones.</p>
      </div>
      {posts.length ? (
        <div className="blog-grid">
          {posts.map((post) => (
            <Link href={`/blog/${post.slug}`} className="blog-card" key={post.slug}>
              <div className="eyebrow eyebrow--light">{post.tags[0] ?? "Journal"}</div>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <div className="blog-card__date">{formatContentDate(post.publishedAt ?? post.updatedAt)}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">New journal entries are on the way. Please check back soon.</div>
      )}
    </div>
  );
}
