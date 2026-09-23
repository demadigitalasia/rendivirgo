"use client";

import Link from "next/link";
import { useCopy } from "@/components/providers";

export default function NotFound() {
  const t = useCopy();

  return (
    <div className="page-container content-page">
      <div className="eyebrow">404</div>
      <h1>{t.notFound.title}</h1>
      <p className="muted" style={{ margin: "18px 0 26px" }}>
        {t.notFound.body}
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/" className="button">
          {t.notFound.home}
        </Link>
        <Link href="/shop" className="button button--outline">
          {t.notFound.shop}
        </Link>
      </div>
    </div>
  );
}
