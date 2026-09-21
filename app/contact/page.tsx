import { ContentPage } from "@/components/content-page";

export default function ContactPage() {
  return <ContentPage eyebrow="Get in touch" title="Let us look closer together." intro="Questions about a stone, a parcel, or a future sourcing request? Send us a note and the RENDI VIRGO team will reply with care." sections={[{ title: "Email", body: "hello@rendivirgo.com\n\nFor product questions, include the item name or SKU so we can help quickly." }, { title: "Collector enquiries", body: "Tell us what you collect, the colors you are looking for, and where in the world you are shipping to." }, { title: "Wholesale and studio work", body: "We welcome thoughtful conversations with designers, jewelers, and studios looking for Indonesian material." }, { title: "Response time", body: "We aim to reply within two business days. This frontend prototype will connect to the live contact workflow during backend implementation." }]} />;
}
