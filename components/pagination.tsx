"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCopy } from "@/components/providers";

export function Pagination({
  page,
  pageCount,
  className,
}: {
  page: number;
  pageCount: number;
  className?: string;
}) {
  const t = useCopy();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pageCount <= 1) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(target));
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const windowSize = 5;
  const end = Math.min(pageCount, Math.max(1, page - 2) + windowSize - 1);
  const start = Math.max(1, end - windowSize + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  return (
    <nav className={`pagination ${className ?? ""}`.trim()} aria-label={t.pagination.label}>
      <Link
        className={`pagination__link ${page <= 1 ? "is-disabled" : ""}`}
        href={hrefFor(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
      >
        {t.pagination.previous}
      </Link>
      <div className="pagination__pages">
        {pages.map((entry) => (
          <Link
            key={entry}
            className={`pagination__link ${entry === page ? "is-current" : ""}`}
            href={hrefFor(entry)}
            aria-current={entry === page ? "page" : undefined}
            aria-label={t.pagination.page(entry)}
          >
            {entry}
          </Link>
        ))}
      </div>
      <Link
        className={`pagination__link ${page >= pageCount ? "is-disabled" : ""}`}
        href={hrefFor(Math.min(pageCount, page + 1))}
        aria-disabled={page >= pageCount}
        tabIndex={page >= pageCount ? -1 : undefined}
      >
        {t.pagination.next}
      </Link>
    </nav>
  );
}
