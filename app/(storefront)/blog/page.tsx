import type { Metadata } from "next";
import { JournalCover } from "@/components/journal-cover";
import Link from "next/link";
import { Breadcrumb } from "@/components/breadcrumb";
import { Pagination } from "@/components/pagination";
import { formatContentDate } from "@/components/page-body";
import { getBlogPosts } from "@/lib/storefront";

export const revalidate = 60;

const PAGE_SIZE = 9;

export const metadata: Metadata = {
  title: "Journal — Stone Guides & Sourcing Stories | RENDI VIRGO",
  description:
    "Practical guidance, sourcing stories, and care notes for collectors, jewelry makers, and lapidary enthusiasts working with Indonesian stones.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const rawTag = Array.isArray(query.tag) ? query.tag[0] : query.tag;
  const page = Math.max(1, Number(rawPage) || 1);
  const activeTag = rawTag?.trim() || "";

  const [{ posts, pageCount }, all] = await Promise.all([
    getBlogPosts({ page, pageSize: PAGE_SIZE, tag: activeTag || undefined }),
    getBlogPosts({ pageSize: 100 }),
  ]);

  const tags = Array.from(new Set(all.posts.flatMap((post) => post.tags))).slice(0, 8);
  const showFeatured = !activeTag && page === 1 && posts.length > 0;
  const featured = showFeatured ? posts[0] : null;
  const gridPosts = showFeatured ? posts.slice(1) : posts;

  return (
    <>
      <section className="journal-hero">
        <div className="page-container">
          <Breadcrumb contained={false} tone="light" items={[{ key: "journal" }]} />
          <div className="journal-hero__grid">
            <div>
              <div className="eyebrow eyebrow--light">The journal</div>
              <h1>Notes from the collection.</h1>
              <p>Practical guidance, sourcing stories, and small observations for anyone who enjoys natural stones.</p>
            </div>
            <dl className="journal-hero__facts">
              <div>
                <dt>Entries</dt>
                <dd>{all.total} guides</dd>
              </div>
              <div>
                <dt>Topics</dt>
                <dd>{tags.length} themes</dd>
              </div>
            </dl>
          </div>
          {tags.length ? (
            <div className="journal-filters" role="navigation" aria-label="Filter by topic">
              <Link href="/blog" className={`journal-chip ${!activeTag ? "is-active" : ""}`}>
                All
              </Link>
              {tags.map((tag) => (
                <Link
                  key={tag}
                  href={tag === activeTag ? "/blog" : `/blog?tag=${encodeURIComponent(tag)}`}
                  aria-pressed={tag === activeTag}
                  className={`journal-chip ${tag === activeTag ? "is-active" : ""}`}
                >
                  {tag}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="page-container journal-body">
        {activeTag ? (
          <p className="muted journal-count">
            {posts.length} {posts.length === 1 ? "entry" : "entries"} in “{activeTag}” ·{" "}
            <Link href="/blog" className="text-button">
              Clear filter
            </Link>
          </p>
        ) : null}

        {featured ? (
          <Link href={`/blog/${featured.slug}`} className="journal-featured">
            <div className="journal-featured__visual" aria-hidden="true">
              <JournalCover src={featured.coverImage} slug={featured.slug} alt="" width={960} height={640}
                sizes="(max-width: 980px) 100vw, 50vw" />
            </div>
            <div className="journal-featured__copy">
              <div className="eyebrow">Featured · {featured.tags[0] ?? "Journal"}</div>
              <h2>{featured.title}</h2>
              <p>{featured.excerpt}</p>
              <div className="journal-card__meta">
                <span>{formatContentDate(featured.publishedAt ?? featured.updatedAt)}</span>
                <span aria-hidden="true">·</span>
                <span>{featured.readMinutes} min read</span>
              </div>
              <span className="text-button">Read the guide</span>
            </div>
          </Link>
        ) : null}

        {gridPosts.length ? (
          <div className="journal-grid">
            {gridPosts.map((post, index) => (
              <Link href={`/blog/${post.slug}`} className="journal-card" key={post.slug}>
                <div className="journal-card__visual" aria-hidden="true">
                  <JournalCover src={post.coverImage} slug={post.slug} alt="" width={640} height={420}
                    sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw" />
                  <span className="journal-card__index">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="journal-card__copy">
                  <div className="eyebrow">{post.tags[0] ?? "Journal"}</div>
                  <h2>{post.title}</h2>
                  <p>{post.excerpt}</p>
                  <div className="journal-card__meta">
                    <span>{formatContentDate(post.publishedAt ?? post.updatedAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{post.readMinutes} min read</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {activeTag ? (
              <>
                No entries in “{activeTag}” yet.{" "}
                <Link href="/blog" className="text-button">
                  View everything
                </Link>
              </>
            ) : (
              "New journal entries are on the way. Please check back soon."
            )}
          </div>
        )}
        <Pagination page={page} pageCount={pageCount} />
      </div>
    </>
  );
}
