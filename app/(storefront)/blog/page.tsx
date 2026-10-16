import type { Metadata } from "next";
import { JournalCover } from "@/components/journal-cover";
import Link from "@/components/localized-link";
import { Breadcrumb } from "@/components/breadcrumb";
import { Pagination } from "@/components/pagination";
import { formatContentDate } from "@/components/page-body";
import { dictionaries } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates } from "@/lib/locale";
import { getBlogPosts } from "@/lib/storefront";

export const revalidate = 60;

const PAGE_SIZE = 9;

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();
  const journal = dictionaries[language].journal;
  return {
    title: `${journal.eyebrow} — RENDI VIRGO`,
    description: journal.intro,
    alternates: localizedAlternates("/blog", language),
  };
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const language = await getRequestLanguage();
  const t = dictionaries[language];
  const journal = t.journal;
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const rawTag = Array.isArray(query.tag) ? query.tag[0] : query.tag;
  const page = Math.max(1, Number(rawPage) || 1);
  const activeTag = rawTag?.trim() || "";

  const [{ posts, pageCount }, all] = await Promise.all([
    getBlogPosts({ page, pageSize: PAGE_SIZE, tag: activeTag || undefined }, language),
    getBlogPosts({ pageSize: 100 }, language),
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
              <div className="eyebrow eyebrow--light">{journal.eyebrow}</div>
              <h1>{journal.title}</h1>
              <p>{journal.intro}</p>
            </div>
            <dl className="journal-hero__facts">
              <div>
                <dt>{journal.entries}</dt>
                <dd>{all.total} {journal.guides}</dd>
              </div>
              <div>
                <dt>{journal.topics}</dt>
                <dd>{tags.length} {journal.themes}</dd>
              </div>
            </dl>
          </div>
          {tags.length ? (
            <div className="journal-filters" role="navigation" aria-label={journal.filterByTopic}>
              <Link href="/blog" className={`journal-chip ${!activeTag ? "is-active" : ""}`}>
                {journal.all}
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
            {journal.filteredCount(posts.length, activeTag)} ·{" "}
            <Link href="/blog" className="text-button">
              {journal.clearFilter}
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
              <div className="eyebrow">{journal.featured} · {featured.tags[0] ?? journal.eyebrow}</div>
              {language === "id" && featured.contentLocale === "en" ? <p className="muted" role="note">{t.draft.fallback}</p> : null}
              <div lang={featured.contentLocale ?? language}>
              <h2>{featured.title}</h2>
              <p>{featured.excerpt}</p>
              </div>
              <div className="journal-card__meta">
                <span>{formatContentDate(featured.publishedAt ?? featured.updatedAt, language)}</span>
                <span aria-hidden="true">·</span>
                <span>{journal.readTime(featured.readMinutes)}</span>
              </div>
              <span className="text-button">{journal.read}</span>
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
                  <div className="eyebrow">{post.tags[0] ?? journal.eyebrow}</div>
                  {language === "id" && post.contentLocale === "en" ? <p className="muted" role="note">{t.draft.fallback}</p> : null}
                  <div lang={post.contentLocale ?? language}>
                  <h2>{post.title}</h2>
                  <p>{post.excerpt}</p>
                  </div>
                  <div className="journal-card__meta">
                    <span>{formatContentDate(post.publishedAt ?? post.updatedAt, language)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{journal.readTime(post.readMinutes)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {activeTag ? (
              <>
                {journal.emptyFiltered}{" "}
                <Link href="/blog" className="text-button">
                  {journal.viewAll}
                </Link>
              </>
            ) : (
              journal.empty
            )}
          </div>
        )}
        <Pagination page={page} pageCount={pageCount} />
      </div>
    </>
  );
}
