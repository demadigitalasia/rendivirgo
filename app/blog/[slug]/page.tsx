import Link from "next/link";
import { blogPosts } from "@/lib/catalog";

export function generateStaticParams() { return blogPosts.map((post) => ({ slug: post.slug })); }

const articleCopy: Record<string, { lead: string; sections: { title: string; body: string }[] }> = {
  "how-to-read-a-cabochon": { lead: "A cabochon does not need facets to hold your attention. Its story is found in the curve of the dome, the polish, and the movement inside the stone.", sections: [{ title: "Start with the dome", body: "Look at the height of the dome from the side. A balanced profile usually gives a cabochon its sense of presence without making it feel heavy." }, { title: "Follow the pattern", body: "Turn the stone slowly under light. Moss, banding, and cloud-like inclusions can reveal themselves at different angles, so the first view is only the beginning." }, { title: "Notice the finish", body: "A good polish should invite the eye across the surface. Small natural features are not defects; they are part of what makes one piece different from the next." }] },
  "from-indonesia-to-your-workbench": { lead: "A stone carries more than color. It carries a place, a landscape, and the hands that helped it travel from an Indonesian source to a workbench elsewhere in the world.", sections: [{ title: "Place matters", body: "Different regions create distinct visual languages. We include origin details in every listing because provenance gives a piece context." }, { title: "Selection is slow", body: "The collection is shaped by patient looking: comparing pattern, surface, weight, and potential rather than chasing volume." }, { title: "A practical handoff", body: "Before dispatch, each piece is documented and packed as part of one complete parcel so its arrival feels considered too." }] },
  "caring-for-polished-stones": { lead: "Natural stones are durable, but a little care keeps their polish and color looking their best for years.", sections: [{ title: "Keep them clean", body: "A soft, dry cloth is enough for routine dust. When needed, use a little lukewarm water and dry the stone completely afterward." }, { title: "Avoid harsh changes", body: "Keep polished stones away from strong chemicals, prolonged heat, and sudden temperature changes that may stress delicate material." }, { title: "Store with space", body: "Separate pieces with a soft pouch or tray so harder edges do not mark neighboring stones during storage." }] },
};

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = blogPosts.find((item) => item.slug === slug);
  const article = articleCopy[slug];
  if (!post || !article) return <div className="page-container content-page"><h1>Article not found</h1><Link href="/blog" className="button">Back to journal</Link></div>;
  return <div className="page-container content-page"><article className="article"><div className="eyebrow">{post.category} · {post.date}</div><h1>{post.title}</h1><p className="article__lead">{article.lead}</p>{article.sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}<div style={{ marginTop: 35 }}><Link href="/blog" className="button button--outline">Back to journal</Link></div></article></div>;
}
