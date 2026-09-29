import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/breadcrumb";
import { Pagination } from "@/components/pagination";
import { formatContentDate } from "@/components/page-body";
import { getBlogPosts } from "@/lib/storefront";

export const revalidate = 60;

const PAGE_SIZE = 9;

export const metadata: Metadata = {
  title: "Journal — Stone Guides & Sourcing Stories | RENDI VIRGO",
  description: "Practical guidance, sourcing stories, and care notes for collectors, jewelry makers, and lapidary enthusiasts working with Indonesian stones.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = Math.max(1, Number(rawPage) || 1);
  const { posts, pageCount } = await getBlogPosts({ page, pageSize: PAGE_SIZE });

  return (
    <>
      <Breadcrumb items={[{ key: "journal" }]} />
      <div className="page-container content-page">
        <div className="content-page__intro">
          <div className="eyebrow">The journal</div>
          <h1>Notes from the collection.</h1>
          <p>Practical guidance, sourcing stories, and small observations for anyone who enjoys natural stones.</p>
        </div>
        {posts.length ? (
          <>
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
            <Pagination page={page} pageCount={pageCount} />
          </>
        ) : (
          <div className="empty-state">New journal entries are on the way. Please check back soon.</div>
        )}
      </div>
    </>
  );
}
