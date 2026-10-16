import Link from "@/components/localized-link";
import { dictionaries } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/server-locale";

export default async function NotFound() {
  const language = await getRequestLanguage();
  const t = dictionaries[language];
  return (
    <div className="page-container content-page">
      <div className="eyebrow">404</div>
      <h1>{t.notFound.title}</h1>
      <p className="muted" style={{ margin: "18px 0 6px" }}>
        {t.notFound.body}
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/" locale={language} className="button">
          {t.notFound.home}
        </Link>
        <Link href="/shop" locale={language} className="button button--outline">
          {t.notFound.shop}
        </Link>
      </div>
    </div>
  );
}
