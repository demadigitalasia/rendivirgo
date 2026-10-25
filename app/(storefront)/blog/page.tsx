import { socialMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { JournalCover } from "@/components/journal-cover";
import { JournalCard } from "@/components/journal-card";
import Link from "@/components/localized-link";
import { Breadcrumb } from "@/components/breadcrumb";
import { Pagination } from "@/components/pagination";
import { formatContentDate } from "@/components/page-body";
import { dictionaries } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates, localizedPath } from "@/lib/locale";
import { getBlogPosts, getBlogTags } from "@/lib/storefront";

const PAGE_SIZE = 9;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [query, language] = await Promise.all([searchParams, getRequestLanguage()]);
  const journal = dictionaries[language].journal;
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const rawTag = Array.isArray(query.tag) ? query.tag[0] : query.tag;
  const page = Math.max(1, Number(rawPage) || 1);
  const activeTag = rawTag?.trim() || "";
  const params = new URLSearchParams();
  if (activeTag) params.set("tag", activeTag);
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  const currentPath = `${localizedPath("/blog", language)}${queryString ? `?${queryString}` : ""}`;
  const [pagePosts, translatedPagePosts] = await Promise.all([
    getBlogPosts({ page, pageSize: PAGE_SIZE, tag: activeTag || undefined }, language),
    language === "en" ? getBlogPosts({ page, pageSize: PAGE_SIZE, tag: activeTag || undefined }, "id") : Promise.resolve(null),
  ]);
  const hasIndonesianTranslation = language === "id"
    ? pagePosts.posts.every(post => post.contentLocale === "id")
    : Boolean(translatedPagePosts?.posts.length === pagePosts.posts.length && translatedPagePosts.posts.every(post => post.contentLocale === "id"));
  const pagePath = `/blog${queryString ? `?${queryString}` : ""}`;
  const canonicalPath = !activeTag && !hasIndonesianTranslation && language === "id" ? localizedPath(pagePath, "en") : currentPath;
  const paginatedLanguages = page > 1 && !activeTag
    ? hasIndonesianTranslation
      ? { en: localizedPath(pagePath, "en"), id: localizedPath(pagePath, "id") }
      : { en: localizedPath(pagePath, "en") }
    : undefined;

  const title = page > 1
    ? `${language === "id" ? "Halaman" : "Page"} ${page} — ${journal.eyebrow} — RENDI VIRGO`
    : `${journal.eyebrow} — RENDI VIRGO`;
  return {
    title,
    ...socialMetadata(title, journal.intro, canonicalPath),
    description: journal.intro,
    alternates: activeTag || page > 1
      ? { canonical: canonicalPath, ...(paginatedLanguages ? { languages: paginatedLanguages } : {}) }
      : localizedAlternates("/blog", language, hasIndonesianTranslation),
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

  const [{ posts, pageCount, total }, allTags] = await Promise.all([
    getBlogPosts({ page, pageSize: PAGE_SIZE, tag: activeTag || undefined }, language),
    getBlogTags(language),
  ]);

  const tags = allTags.slice(0, 8);
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
                <dd>{total} {journal.guides}</dd>
              </div>
              <div>
                <dt>{journal.topics}</dt>
                <dd>{tags.length} {journal.themes}</dd>
              </div>
            </dl>
          </div>
          {tags.length ? (
            <div className="journal-filters" role="navigation" aria-label={journal.filterByTopic}>
              <Link href="/blog" aria-current={!activeTag ? "page" : undefined} className={`journal-chip ${!activeTag ? "is-active" : ""}`}>
                {journal.all}
              </Link>
              {tags.map((tag) => (
                <Link
                  key={tag}
                  href={tag === activeTag ? "/blog" : `/blog?tag=${encodeURIComponent(tag)}`}
                  aria-current={tag === activeTag ? "page" : undefined}
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
              <JournalCard key={post.slug} post={post} index={index} />
            ))}
          </div>
        ) : posts.length === 0 ? (
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
        ) : null}
        <Pagination page={page} pageCount={pageCount} />
      </div>
    </>
  );
}
