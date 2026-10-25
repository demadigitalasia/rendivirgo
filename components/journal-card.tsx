"use client";

import Link from "@/components/localized-link";
import { ArrowIcon } from "@/components/icons";
import { JournalCover } from "@/components/journal-cover";
import { formatContentDate } from "@/components/page-body";
import { useCopy, useLanguage } from "@/components/providers";
import type { ApiBlogPost } from "@/lib/storefront";

export function JournalCard({ post, index, featured = false, showReadLink = false }: {
  post: ApiBlogPost;
  index: number;
  featured?: boolean;
  showReadLink?: boolean;
}) {
  const t = useCopy();
  const { language } = useLanguage();

  return (
    <Link href={`/blog/${post.slug}`} className="journal-card">
      <div className="journal-card__visual" aria-hidden="true">
        <JournalCover src={post.coverImage} slug={post.slug} alt="" width={640} height={420}
          sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw" />
        <span className="journal-card__index">{String(index + 1).padStart(2, "0")}</span>
        {featured ? <span className="journal-card__feature">{t.journal.featured}</span> : null}
      </div>
      <div className="journal-card__copy">
        <div className="eyebrow">{post.tags[0] ?? t.journal.eyebrow}</div>
        {language === "id" && post.contentLocale === "en" ? <p className="muted" role="note">{t.draft.fallback}</p> : null}
        <div lang={post.contentLocale ?? language}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </div>
        <div className="journal-card__meta">
          <span>{formatContentDate(post.publishedAt ?? post.updatedAt, language)}</span>
          <span aria-hidden="true">·</span>
          <span>{t.journal.readTime(post.readMinutes)}</span>
        </div>
        {showReadLink ? <span className="journal-card__read-more">{t.journal.readArticle}<ArrowIcon aria-hidden="true" /></span> : null}
      </div>
    </Link>
  );
}
