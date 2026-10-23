"use client";

import { useState } from "react";
import { analyzeSeo, type SeoInput } from "@/lib/seo-analysis";
import { Badge, Button } from "./ui";
import { AiDraft } from "./ai-draft";
import "./seo.css";

export function SeoBadge({ input, variant = "default", onClick }: {
  input: SeoInput;
  variant?: "default" | "table";
  onClick?: () => void;
}) {
  const result = analyzeSeo(input);
  if (variant === "table") {
    const improvements = result.checks.filter(check => check.points < check.max);
    const label = result.tone === "green" ? "Good" : result.tone === "amber" ? "Needs work" : "Needs attention";
    const content = <>
      <span className="rv-seo-meter__heading">
        <span className="rv-seo-meter__number">{result.score}<small>/100</small></span>
        <span className="rv-seo-meter__dot" aria-hidden="true" />
      </span>
      <span className="rv-seo-meter__track" aria-hidden="true"><span style={{ width: `${result.score}%` }} /></span>
      <span className="rv-seo-meter__label">{label}</span>
    </>;
    const title = improvements.length
      ? `${improvements.length} improvements: ${improvements.slice(0, 3).map(check => check.label).join(", ")}`
      : "All editorial SEO checks passed";
    const className = `rv-seo-meter rv-seo-meter--${result.tone}`;
    return onClick ? (
      <button type="button" className={className} onClick={onClick} title={title}
        aria-label={`SEO score ${result.score} out of 100: ${label}. Open ${input.kind} editor to improve SEO.`}>
        {content}
      </button>
    ) : <span className={className} title={title} aria-label={`SEO score ${result.score} out of 100: ${label}`}>{content}</span>;
  }
  return <span className={`rv-seo-score rv-seo-score--${result.tone}`} title={`Editorial SEO: ${result.label}`} aria-label={`SEO score ${result.score} out of 100: ${result.label}`}>{result.score}<small>/100</small></span>;
}

export function SeoPanel({ input, translation, translationStatus, onMetadata }: {
  input: SeoInput;
  translation?: SeoInput;
  translationStatus?: string;
  onMetadata?: (draft: Record<string, string>) => void;
}) {
  const [locale, setLocale] = useState<"en" | "id">("en");
  const [focusTopic, setFocusTopic] = useState("");
  const selected = locale === "id" && translation ? translation : input;
  const scored = { ...selected, focusTopic };
  const result = analyzeSeo(scored);
  const path = selected.publicPath ?? (selected.kind === "home" ? "/" : `${selected.kind === "blog" ? "/blog" : selected.kind === "category" ? "/shop" : ""}/${selected.slug || ""}`);
  const previewPath = locale === "id" ? `/id${path === "/" ? "" : path}` : path;
  return <section className="rv-seo-panel" aria-label="SEO analysis">
    <div className="rv-seo-heading"><div><strong>Editorial SEO · {locale.toUpperCase()}</strong><p className="rv-hint">{result.words} words · {result.label}</p></div><SeoBadge input={scored} /></div>
    {translation ? <div className="rv-inline"><Button size="sm" ariaPressed={locale === "en"} onClick={() => setLocale("en")}>English</Button><Button size="sm" ariaPressed={locale === "id"} onClick={() => setLocale("id")}>Bahasa Indonesia</Button></div> : null}
    <div className="rv-inline"><Badge tone={input.metaTitle?.trim() && input.metaDescription?.trim() ? "green" : "amber"}>EN metadata: {input.metaTitle?.trim() && input.metaDescription?.trim() ? "complete" : "needs review"}</Badge>{translation ? <Badge tone={translationStatus === "Ready" ? "green" : "amber"}>ID translation: {translationStatus || "review required"}</Badge> : null}<Button size="sm" href="/admin/seo">Check technical SEO</Button></div>
    <label className="rv-field"><span className="rv-label">Focus topic (analysis only)</span><input className="rv-input" value={focusTopic} onChange={event => setFocusTopic(event.target.value)} placeholder="Main subject to check naturally in the copy" /></label>
    <div className="rv-seo-preview"><small>Search preview · rendivirgo.com{previewPath}</small><strong>{selected.metaTitle || selected.title || "Page title"}</strong><p>{selected.metaDescription || "Public metadata uses a fallback. Add a page-specific description."}</p></div>
    <p className="rv-hint">SEO title: {selected.metaTitle?.trim().length ?? 0} characters (guide: 30–60) · Description: {selected.metaDescription?.trim().length ?? 0} characters (guide: 120–160).</p>
    <p className="rv-hint">Custom metadata: {selected.metaTitle?.trim() && selected.metaDescription?.trim() ? "complete" : "incomplete; public fallbacks may still exist"}. Translation review and technical checks are separate from this score. The final search title may include the site brand.</p>
    <details><summary>Checks and improvements ({result.checks.filter(c => c.points < c.max).length})</summary><ul className="rv-seo-checks">{result.checks.map(check => <li key={check.id}><div><Badge tone={check.points === check.max ? "green" : check.points ? "bronze" : "red"}>{check.points}/{check.max}</Badge> <strong>{check.label}</strong></div>{check.points < check.max ? <p>{check.advice}</p> : null}</li>)}</ul></details>
    {onMetadata ? <AiDraft kind="seo" currentValues={{metaTitle: input.metaTitle, metaDescription: input.metaDescription, metaTitleId: translation?.metaTitle, metaDescriptionId: translation?.metaDescription}} sourceVersion={JSON.stringify({ input, translation })} title="Generate AI SEO" context={{ title: input.title, body: input.body, titleId: translation?.title, bodyId: translation?.body, metaTitle: input.metaTitle, metaDescription: input.metaDescription, metaTitleId: translation?.metaTitle, metaDescriptionId: translation?.metaDescription, contentType: input.kind }} onApply={onMetadata} /> : null}
    <p className="rv-hint">Yoast-inspired checks, not an official Yoast or Google score. Scores recalculate from the current content; save to retain edits. Titles are used as the topic. Technical SEO is checked separately in SEO Audit.</p>
  </section>;
}
