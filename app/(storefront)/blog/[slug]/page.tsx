import type { Metadata } from "next";
import { JournalCover } from "@/components/journal-cover";
import { journalCover } from "@/lib/editorial-images";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleShare } from "@/components/article-share";
import { Breadcrumb } from "@/components/breadcrumb";
import { PageBody, formatContentDate, slugifyHeading } from "@/components/page-body";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";
import { getBlogPost, getBlogPosts } from "@/lib/storefront";

export const revalidate = 60;

const escapeJsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

export async function generateStaticParams() {
  const { posts } = await getBlogPosts({ pageSize: 100 });
  return posts.slice(0, 50).map((post) => ({ slug: post.slug }));
}

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

function headingsFrom(body: string): Array<{ id: string; text: string }> {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((text) => ({ id: slugifyHeading(text.replace(/\*\*/g, "")), text: text.replace(/\*\*/g, "") }));
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const publishedAt = post.publishedAt ?? post.updatedAt;
  const publishedLabel = formatContentDate(publishedAt);
  const category = post.tags[0] ?? "Journal";
  const headings = headingsFrom(post.body ?? "");
  const { posts: latest } = await getBlogPosts({ pageSize: 9 });
  const related = latest.filter((item) => item.slug !== post.slug && item.tags.some((tag) => post.tags.includes(tag))).slice(0, 3);
  const fallbackRelated = latest.filter((item) => item.slug !== post.slug).slice(0, 3);
  const relatedPosts = related.length ? related : fallbackRelated;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: publishedAt,
    dateModified: post.updatedAt,
    image: [absoluteUrl(journalCover(post.coverImage, post.slug))],
    author: { "@type": "Organization", name: post.author || "RENDI VIRGO" },
    publisher: {
      "@type": "Organization",
      name: "RENDI VIRGO",
      logo: { "@type": "ImageObject", url: absoluteUrl("/brand/rendi-virgo-logo-white.webp") },
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Journal", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(breadcrumbs) }} />
      <section className="article-hero">
        <div className="page-container">
          <Breadcrumb
            contained={false}
            tone="light"
            items={[{ label: "Journal", href: "/blog" }, { label: post.title }]}
          />
          <div className="article-hero__grid">
            <div>
              <div className="article-hero__tags">
                <span className="article-hero__chip">{category}</span>
                {post.tags.slice(1, 3).map((tag) => (
                  <span key={tag} className="article-hero__tag">
                    {tag}
                  </span>
                ))}
              </div>
              <h1>{post.title}</h1>
              <p className="article-hero__excerpt">{post.excerpt}</p>
              <div className="article-hero__meta">
                <span>{post.author || "RENDI VIRGO"}</span>
                <span aria-hidden="true">·</span>
                <span>{publishedLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{post.readMinutes} min read</span>
              </div>
            </div>
            <div className="article-hero__cover">
              <JournalCover src={post.coverImage} slug={post.slug} alt="" width={880} height={620}
                sizes="(max-width: 980px) 100vw, 420px" />
            </div>
          </div>
        </div>
      </section>

      <div className="page-container article-layout">
        <article className="article article--rich">
          <PageBody body={post.body ?? ""} className="article__body" />
          <ArticleShare title={post.title} />
          <div className="article-cta">
            <div className="eyebrow eyebrow--light">From reading to holding</div>
            <h2>See these details in real stones.</h2>
            <p>Every cabochon lists its dome, polish, dimensions, and honest close-ups.</p>
            <div className="article-cta__actions">
              <Link href="/shop/cabochons" className="button button--light">
                Shop cabochons
              </Link>
              <Link href="/shop" className="button article-cta__ghost">
                Browse all stones
              </Link>
            </div>
          </div>
        </article>

        <aside className="article-side">
          {headings.length ? (
            <nav className="article-toc" aria-label="In this guide">
              <span className="article-toc__label">In this guide</span>
              <ol>
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a href={`#${heading.id}`}>{heading.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <div className="article-facts">
            <span className="article-facts__label">At a glance</span>
            <dl>
              <div>
                <dt>Topic</dt>
                <dd>{category}</dd>
              </div>
              <div>
                <dt>Reading time</dt>
                <dd>{post.readMinutes} min</dd>
              </div>
              <div>
                <dt>Published</dt>
                <dd>{publishedLabel}</dd>
              </div>
            </dl>
            <Link href="/shop/cabochons" className="text-button">
              Shop cabochons
            </Link>
          </div>
        </aside>
      </div>

      {relatedPosts.length ? (
        <section className="page-container article-related">
          <div className="section-heading">
            <h2>Keep reading</h2>
            <Link href="/blog" className="text-button">
              All journal entries
            </Link>
          </div>
          <div className="blog-grid">
            {relatedPosts.map((item) => (
              <Link href={`/blog/${item.slug}`} className="blog-card" key={item.slug}>
                <div className="eyebrow eyebrow--light">{item.tags[0] ?? "Journal"}</div>
                <h2>{item.title}</h2>
                <p>{item.excerpt}</p>
                <div className="blog-card__date">{formatContentDate(item.publishedAt ?? item.updatedAt)}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
