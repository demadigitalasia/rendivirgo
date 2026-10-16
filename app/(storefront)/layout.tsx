import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/skip-link";
import { Toaster } from "@/components/toast";
import { getPublicSettings } from "@/lib/storefront";
import { StorefrontMotion } from "@/components/storefront-motion";
import "./storefront.css";
import { getRequestLanguage, hasLanguagePreferenceCookie } from "@/lib/server-locale";
import { supportedLanguages } from "@/lib/locale";

export default async function StorefrontLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { store } = await getPublicSettings();
  const language = await getRequestLanguage();
  const hasLanguageCookie = await hasLanguagePreferenceCookie();
  const languages = supportedLanguages;

  return (
    <Providers productWatermark={store.productWatermark} initialLanguage={language} hasLanguagePreferenceCookie={hasLanguageCookie}>
      <div className="storefront">
        <StorefrontMotion />
        <SkipLink />
        <SiteHeader languages={languages} />
        <main id="main">{children}</main>
        <SiteFooter socials={store.socials} email={store.email} />
        <Toaster />
      </div>
    </Providers>
  );
}
