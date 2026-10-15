"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { journalCover, journalFallback } from "@/lib/editorial-images";

export function JournalCover({ src, slug, ...props }: Omit<ImageProps, "src"> & { src?: string | null; slug: string }) {
  const source = journalCover(src, slug);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <Image {...props} src={failedSource === source ? journalFallback(slug) : source}
    onError={() => setFailedSource(source)} />;
}
