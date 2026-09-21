import { ContentPage } from "@/components/content-page";

export default function PrivacyPage() {
  return <ContentPage eyebrow="Your information" title="Privacy policy." intro="This placeholder policy page marks the content location for the production storefront. Final legal text will be reviewed before launch." sections={[{ title: "Information we collect", body: "The production site may collect contact, shipping, order, and payment-reference information needed to fulfill purchases and provide support." }, { title: "How information is used", body: "Information will be used to process orders, communicate about delivery, maintain account or order records, and improve the storefront." }, { title: "Payment data", body: "Payment processing is planned through PayPal. The storefront should not store full payment credentials." }, { title: "Contact", body: "Questions about privacy can be directed to hello@rendivirgo.com once the production policy is approved." }]} />;
}
