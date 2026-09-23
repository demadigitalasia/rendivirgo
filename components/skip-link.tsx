"use client";

import { useCopy } from "@/components/providers";

export function SkipLink() {
  const t = useCopy();
  return (
    <a href="#main" className="skip-link">
      {t.skip}
    </a>
  );
}
