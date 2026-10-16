"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { localizedHref, normalizeLanguage, type Language } from "@/lib/locale";
import { useOptionalLanguage } from "@/components/providers";

type LocalizedLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: LinkProps["href"]; locale?: Language };

export function LocalizedLink({ href, locale, ...props }: LocalizedLinkProps) {
  const pathname = usePathname() ?? "/";
  const contextLanguage = useOptionalLanguage();
  const language = locale ?? contextLanguage ?? normalizeLanguage(pathname.split("/")[1]);
  const localized = typeof href === "string" ? localizedHref(href, language) : href;
  return <Link href={localized} {...props} />;
}

export default LocalizedLink;
