import type { Metadata } from "next";
import { ContactContent } from "@/components/contact-content";
import { getPublicSettings } from "@/lib/storefront";
import { storefrontMetadata } from "@/lib/storefront-metadata";

export const revalidate = 60;

export const generateMetadata = (): Promise<Metadata> => storefrontMetadata("contact", "/contact");

export default async function ContactPage() {
  const { store } = await getPublicSettings();
  const whatsappDigits = store.whatsapp.replace(/[^0-9]/g, "");
  const socials = Object.entries(store.socials)
    .filter(([, url]) => url.trim())
    .map(([network, url]) => ({ network, url }));

  return (
    <ContactContent
      email={store.email || "cs@rendivirgo.com"}
      whatsapp={store.whatsapp}
      whatsappHref={whatsappDigits ? `https://wa.me/${whatsappDigits}` : null}
      address={store.address}
      hours={store.hours}
      socials={socials}
    />
  );
}
