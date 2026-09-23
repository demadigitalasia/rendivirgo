import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { getPublicSettings } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact | RENDI VIRGO",
  description: "Questions about a stone, a parcel, or a sourcing request? Contact the RENDI VIRGO team by email, WhatsApp, or the contact form.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const { store } = await getPublicSettings();
  const whatsappDigits = store.whatsapp.replace(/[^0-9]/g, "");
  const socials = Object.entries(store.socials).filter(([, url]) => url.trim());

  return (
    <div className="page-container content-page">
      <div className="content-page__intro">
        <div className="eyebrow">Get in touch</div>
        <h1>Let us look closer together.</h1>
        <p>Questions about a stone, a parcel, or a future sourcing request? Send us a note and the RENDI VIRGO team will reply with care.</p>
      </div>
      <div className="contact-layout">
        <section className="content-card">
          <h2>Contact details</h2>
          <ul className="detail-list">
            <li>
              <span>Email</span>
              <span>
                <a href={`mailto:${store.email}`}>{store.email}</a>
              </span>
            </li>
            {whatsappDigits && (
              <li>
                <span>WhatsApp</span>
                <span>
                  <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer noopener">
                    {store.whatsapp}
                  </a>
                </span>
              </li>
            )}
            <li>
              <span>Studio</span>
              <span>{store.address}</span>
            </li>
            <li>
              <span>Hours</span>
              <span>{store.hours}</span>
            </li>
          </ul>
          {socials.length > 0 && (
            <div className="contact-socials">
              {socials.map(([network, url]) => (
                <a key={network} href={url} target="_blank" rel="noreferrer noopener">
                  {network.charAt(0).toUpperCase() + network.slice(1)}
                </a>
              ))}
            </div>
          )}
        </section>
        <section className="content-card">
          <h2>Send a message</h2>
          <ContactForm />
        </section>
      </div>
    </div>
  );
}
