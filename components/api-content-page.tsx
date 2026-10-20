import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody } from "@/components/page-body";
import { ApiContentUnavailable } from "@/components/api-content-unavailable";
import { getPage, getPageWithStatus } from "@/lib/storefront";
import { dictionaries } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/server-locale";
import { localizedAlternates } from "@/lib/locale";

const contentPageKeys = {
  faq: "faq",
  "shipping-returns": "shipping",
  "privacy-policy": "privacy",
  "terms-conditions": "terms",
} as const;

export async function contentPageMetadata(
  slug: string,
  fallback: { title: string; description: string },
): Promise<Metadata> {
  const language = await getRequestLanguage();
  const page = await getPage(slug, language);
  const metadata = dictionaries[language].metadata;
  const metadataKey = contentPageKeys[slug as keyof typeof contentPageKeys];
  const fallbackTitle = metadataKey ? metadata[`${metadataKey}Title`] : fallback.title;
  const fallbackDescription = metadataKey ? metadata[`${metadataKey}Description`] : fallback.description;
  const useLocalizedFallback = language === "id" && (!page || page.contentLocale === "en");
  return {
    title: useLocalizedFallback ? fallbackTitle : page?.metaTitle ?? page?.title ?? fallbackTitle,
    description: useLocalizedFallback ? fallbackDescription : page?.metaDescription ?? fallbackDescription,
    alternates: localizedAlternates(`/${slug}`, language),
  };
}

export async function ApiContentPage({ slug, eyebrow }: { slug: string; eyebrow: string }) {
  const language = await getRequestLanguage();
  const t = dictionaries[language];
  const result = await getPageWithStatus(slug, language);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <ApiContentUnavailable retryHref={`/${slug}`} />;

  const page = result.data;
  if (!page) notFound();
  const eyebrowKey = contentPageKeys[slug as keyof typeof contentPageKeys];
  const localizedEyebrow = eyebrowKey ? t.contentPages[eyebrowKey] : eyebrow;

  return (
    <div className={`page-container content-page${slug === "terms-conditions" ? " content-page--terms" : ""}${slug === "privacy-policy" ? " content-page--privacy" : ""}`}>
      <div className="content-page__intro">
        <div className="eyebrow">{localizedEyebrow}</div>
        <h1 lang={page.contentLocale}>{page.title}</h1>
      </div>
      {language === "id" && page.contentLocale === "en" ? <p className="muted" role="note">{t.draft.fallback}</p> : null}
      <div lang={page.contentLocale}>
        <PageBody
          body={page.body}
          className={slug === "terms-conditions" ? "article article--terms" : slug === "privacy-policy" ? "article article--privacy" : "article"}
          numberParagraphsAfterFirst={slug === "terms-conditions"}
          numberAllParagraphs={slug === "privacy-policy"}
        />
      </div>
    </div>
  );
}
