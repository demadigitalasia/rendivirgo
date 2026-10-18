import type { Metadata } from "next";
import { JournalCover } from "@/components/journal-cover";
import { journalCover } from "@/lib/editorial-images";
import Link from "@/components/localized-link";
import { notFound } from "next/navigation";
import { ArticleShare } from "@/components/article-share";
import { Breadcrumb } from "@/components/breadcrumb";
import { PageBody, formatContentDate, slugifyHeading } from "@/components/page-body";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";
import { getBlogPost, getBlogPosts } from "@/lib/storefront";
import { dictionaries } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates, localizedPath } from "@/lib/locale";

const escapeJsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const language = await getRequestLanguage();
  const post = await getBlogPost(slug, language);
  if (!post) return {};
  const journal = dictionaries[language].journal;
  const englishFallback = language === "id" && post.contentLocale === "en";
  const title = englishFallback ? `Artikel berbahasa Inggris | ${post.title} | RENDI VIRGO` : post.metaTitle ?? `${post.title} | RENDI VIRGO ${journal.eyebrow}`;
  const description = englishFallback ? dictionaries.id.draft.fallback : post.metaDescription ?? post.excerpt;
  const coverImage = absoluteUrl(journalCover(post.coverImage, post.slug));
  return {
    title,
    description,
    alternates: localizedAlternates(`/blog/${post.slug}`, language),
    openGraph: {
      title: post.title,
      description,
      type: "article",
      siteName: "RENDI VIRGO",
      locale: language === "id" ? "id_ID" : "en_GB",
      images: [coverImage],
      publishedTime: post.publishedAt ?? post.updatedAt,
      modifiedTime: post.updatedAt,
      ...(post.authorUrl ? { authors: [post.authorUrl] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [coverImage],
    },
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
  const language = await getRequestLanguage();
  const t = dictionaries[language];
  const journal = t.journal;
  const post = await getBlogPost(slug, language);
  if (!post) notFound();

  const publishedAt = post.publishedAt ?? post.updatedAt;
  const publishedLabel = formatContentDate(publishedAt, language);
  const category = post.tags[0] ?? journal.eyebrow;
  const headings = headingsFrom(post.body ?? "");
  const { posts: latest } = await getBlogPosts({ pageSize: 9 }, language);
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
    author: {
      "@type": post.authorType ?? "Organization",
      name: post.author || "RENDI VIRGO",
      url: post.authorUrl || (post.authorType === "Organization" ? absoluteUrl("/") : undefined),
    },
    publisher: {
      "@type": "Organization",
      name: "RENDI VIRGO",
      logo: { "@type": "ImageObject", url: absoluteUrl("/brand/rendi-virgo-logo-white.webp") },
    },
    inLanguage: post.contentLocale ?? language,
    mainEntityOfPage: absoluteUrl(localizedPath(`/blog/${post.slug}`, language)),
  };
  const breadcrumbs = breadcrumbJsonLd([
    { name: t.nav.home, path: localizedPath("/", language) },
    { name: journal.eyebrow, path: localizedPath("/blog", language) },
    { name: post.title, path: localizedPath(`/blog/${post.slug}`, language) },
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
            items={[{ label: journal.eyebrow, href: "/blog" }, { label: post.title }]}
          />
          <div className="article-hero__copy">
            {language === "id" && post.contentLocale === "en" ? <p className="muted" role="note">{t.draft.fallback}</p> : null}
            <div className="article-hero__tags">
              <span className="article-hero__chip">{category}</span>
              {post.tags.slice(1, 3).map((tag) => (
                <span key={tag} className="article-hero__tag">
                  {tag}
                </span>
              ))}
            </div>
            <h1 lang={post.contentLocale}>{post.title}</h1>
            <p className="article-hero__excerpt" lang={post.contentLocale}>{post.excerpt}</p>
            <div className="article-hero__meta">
              <span>{post.author || "RENDI VIRGO"}</span>
              <span aria-hidden="true">·</span>
              <span>{publishedLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{journal.readTime(post.readMinutes)}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="page-container article-layout">
        <article className="article article--rich">
          <figure className="article-cover">
            <JournalCover src={post.coverImage} slug={post.slug} alt={post.coverAlt?.trim() || post.title} width={880} height={620}
              sizes="(max-width: 980px) 100vw, (max-width: 1280px) 68vw, 820px" />
          </figure>
          <div lang={post.contentLocale ?? language}>
            <PageBody body={post.body ?? ""} className="article__body" />
          </div>
          <ArticleShare title={post.title} />
          <div className="article-cta">
            <div className="eyebrow eyebrow--light">{journal.ctaEyebrow}</div>
            <h2>{journal.ctaTitle}</h2>
            <p>{journal.ctaBody}</p>
            <div className="article-cta__actions">
              <Link href="/shop/cabochons" className="button button--light">
                {journal.shopCabochons}
              </Link>
              <Link href="/shop" className="button article-cta__ghost">
                {journal.browseStones}
              </Link>
            </div>
          </div>
        </article>

        <aside className="article-side">
          {headings.length ? (
            <nav className="article-toc" aria-label={journal.inGuide}>
              <span className="article-toc__label">{journal.inGuide}</span>
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
            <span className="article-facts__label">{journal.atGlance}</span>
            <dl>
              <div>
                <dt>{journal.topic}</dt>
                <dd>{category}</dd>
              </div>
              <div>
                <dt>{journal.readingTime}</dt>
                <dd>{journal.readTime(post.readMinutes)}</dd>
              </div>
              <div>
                <dt>{journal.published}</dt>
                <dd>{publishedLabel}</dd>
              </div>
            </dl>
            <Link href="/shop/cabochons" className="text-button">
              {journal.shopCabochons}
            </Link>
          </div>
        </aside>
      </div>

      {relatedPosts.length ? (
        <section className="page-container article-related">
          <div className="section-heading">
            <h2>{journal.keepReading}</h2>
            <Link href="/blog" className="text-button">
              {journal.allEntries}
            </Link>
          </div>
          <div className="blog-grid">
            {relatedPosts.map((item) => (
              <Link href={`/blog/${item.slug}`} className="blog-card" key={item.slug}>
                <div className="eyebrow eyebrow--light">{item.tags[0] ?? journal.eyebrow}</div>
                <h2>{item.title}</h2>
                <p>{item.excerpt}</p>
                <div className="blog-card__date">{formatContentDate(item.publishedAt ?? item.updatedAt, language)}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
