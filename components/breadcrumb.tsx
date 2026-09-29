"use client";

import Link from "next/link";
import { useCopy } from "@/components/providers";
import type { Copy } from "@/lib/i18n";

type PresetKey = keyof Omit<Copy["breadcrumb"], "label">;

export type BreadcrumbItem = {
  key?: PresetKey;
  label?: string;
  href?: string;
};

export function Breadcrumb({
  items,
  tone = "default",
  contained = true,
}: {
  items: BreadcrumbItem[];
  tone?: "default" | "light";
  contained?: boolean;
}) {
  const t = useCopy().breadcrumb;
  const all: BreadcrumbItem[] = [{ key: "home", href: "/" }, ...items];
  const labelOf = (item: BreadcrumbItem) => (item.key ? t[item.key] : (item.label ?? ""));

  const content = (
    <nav aria-label={t.label}>
      {all.map((item, index) => {
        const isLast = index === all.length - 1;
        return (
          <span className="breadcrumb__item" key={`${labelOf(item)}-${index}`}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href && !isLast ? (
              <Link href={item.href}>{labelOf(item)}</Link>
            ) : (
              <span aria-current="page">{labelOf(item)}</span>
            )}
          </span>
        );
      })}
    </nav>
  );

  const className = `breadcrumb breadcrumb--${tone}${contained ? " page-container" : ""}`;
  return <div className={className}>{content}</div>;
}
