"use client";

import Link from "@/components/localized-link";
import { useCopy } from "@/components/providers";

export function ApiContentUnavailable({ retryHref }: { retryHref: string }) {
  const t = useCopy();

  return (
    <div className="page-container content-page">
      <div className="content-page__intro">
        <div className="eyebrow">{t.contentUnavailable.eyebrow}</div>
        <h1>{t.contentUnavailable.title}</h1>
        <p role="status">{t.contentUnavailable.body}</p>
        <div className="hero__actions">
          <a href={retryHref} className="button button--outline">{t.contentUnavailable.retry}</a>
          <Link href="/contact" className="text-button">{t.contentUnavailable.contact}</Link>
        </div>
      </div>
    </div>
  );
}
