import type { Metadata } from "next";
import { ApiContentPage, contentPageMetadata } from "@/components/api-content-page";
import { getPage } from "@/lib/storefront";
import { siteUrl } from "@/lib/seo";

export const revalidate = 60;

const fallback = {
  title: "FAQ — Payment, Shipping & Stock | RENDI VIRGO",
  description: "Answers about natural stones, PayPal payment in USD, one-package shipping calculation, and when stock is reserved.",
};

export function generateMetadata(): Promise<Metadata> {
  return contentPageMetadata("faq", fallback);
}

type FaqEntry = { question: string; answer: string };

/** Strip inline markdown so answers are plain text for the FAQPage schema. */
const cleanMarkdown = (text: string) => text
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
  .replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, "$1")
  .replace(/^[>*-]\s+/gm, "")
  .replace(/\s*\n\s*/g, " ")
  .replace(/\s{2,}/g, " ")
  .trim();

/** Extract question/answer pairs from the CMS markdown ("## question" sections). */
export function extractFaqs(body: string): FaqEntry[] {
  const sections = body.split(/^##[ \t]+/m).slice(1);
  const faqs: FaqEntry[] = [];
  for (const section of sections) {
    const newline = section.indexOf("\n");
    const question = (newline < 0 ? section : section.slice(0, newline)).trim();
    const answer = newline < 0 ? "" : cleanMarkdown(section.slice(newline + 1));
    if (!question.endsWith("?") || !answer) continue;
    faqs.push({ question, answer });
  }
  return faqs;
}

export default async function FaqPage() {
  const page = await getPage("faq", "en");
  const faqs = page?.body ? extractFaqs(page.body) : [];
  const faqJsonLd = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
        url: `${siteUrl()}/faq`,
      }
    : null;
  return (
    <>
      {faqJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} /> : null}
      <ApiContentPage slug="faq" eyebrow="Helpful details" />
    </>
  );
}
