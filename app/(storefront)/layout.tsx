import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/skip-link";
import { Toaster } from "@/components/toast";
import { getPublicSettings } from "@/lib/storefront";

export default async function StorefrontLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { store } = await getPublicSettings();

  return (
    <Providers>
      <SkipLink />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter socials={store.socials} email={store.email} />
      <Toaster />
    </Providers>
  );
}
