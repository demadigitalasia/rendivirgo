import Link from "next/link";

type ContentSection = { title: string; body: string };

export function ContentPage({ eyebrow, title, intro, sections, cta }: { eyebrow: string; title: string; intro: string; sections: ContentSection[]; cta?: { label: string; href: string } }) {
  return (
    <div className="page-container content-page">
      <div className="content-page__intro">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      <div className="content-sections">
        {sections.map((section) => <section className="content-card" key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}
      </div>
      {cta && <div style={{ marginTop: 28 }}><Link href={cta.href} className="button">{cta.label}</Link></div>}
    </div>
  );
}
