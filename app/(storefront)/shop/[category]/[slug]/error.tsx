"use client";

import { useCopy } from "@/components/providers";

export default function ProductError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useCopy();

  return (
    <div className="page-container content-page">
      <div className="eyebrow">{t.checkout.eyebrow}</div>
      <h1>{t.shop.productLoadErrorTitle}</h1>
      <p className="muted" style={{ margin: "18px 0 26px" }}>{t.shop.productLoadErrorBody}</p>
      <button className="button" type="button" onClick={retry}>{t.shop.tryAgain}</button>
    </div>
  );
}
