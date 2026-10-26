import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/skip-link";
import { Toaster } from "@/components/toast";
import { getCategories, getPublicSettings } from "@/lib/storefront";
import { StorefrontMotion } from "@/components/storefront-motion";
import { CampaignAttributionCapture } from "@/components/campaign-attribution-capture";
import "./storefront.css";
import { getRequestLanguage } from "@/lib/server-locale";

export default async function StorefrontLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [{ store }, language] = await Promise.all([
    getPublicSettings(),
    getRequestLanguage(),
  ]);
  const categories = await getCategories(language);

  return (
    <Providers productWatermark={store.productWatermark}>
      <div className="storefront">
        <CampaignAttributionCapture />
        <StorefrontMotion />
        <SkipLink />
        <SiteHeader categories={(categories ?? []).map(({ slug, name }) => ({ slug, name }))} />
        <main id="main">{children}</main>
        <SiteFooter socials={store.socials} email={store.email} />
        <Toaster />
      </div>
    </Providers>
  );
}
