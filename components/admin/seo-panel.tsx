"use client";

import { useState } from "react";
import { analyzeSeo, needsSeoReview, type SeoInput } from "@/lib/seo-analysis";
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
    const improvements = result.checks.filter(needsSeoReview);
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
      ? `${improvements.length} checks need attention or review: ${improvements.slice(0, 3).map(check => check.label).join(", ")}. Compare scores within the same content type.`
      : "All applicable editorial checks passed. Compare scores within the same content type.";
    const className = `rv-seo-meter rv-seo-meter--${result.tone}`;
    return onClick ? (
      <button type="button" className={className} onClick={onClick} title={title}
      aria-label={`Editorial readiness ${result.score} out of 100: ${label}. Open ${input.kind} editor to improve this checklist.`}>
        {content}
      </button>
    ) : <span className={className} title={title} aria-label={`Editorial readiness ${result.score} out of 100: ${label}`}>{content}</span>;
  }
  return <span className={`rv-seo-score rv-seo-score--${result.tone}`} title={`Editorial readiness: ${result.label}; compare within the same content type`} aria-label={`Editorial readiness ${result.score} out of 100: ${result.label}`}>{result.score}<small>/100</small></span>;
}

export function SeoPanel({ input, translation, translationStatus, onMetadata, compact = false }: {
  input: SeoInput;
  translation?: SeoInput;
  translationStatus?: string;
  onMetadata?: (draft: Record<string, string>) => void;
  compact?: boolean;
}) {
  const [locale, setLocale] = useState<"en" | "id">("en");
  const [focusTopic, setFocusTopic] = useState("");
  const selected = locale === "id" && translation ? translation : input;
  const scored = { ...selected, focusTopic };
  const result = analyzeSeo(scored);
  const path = selected.publicPath ?? (selected.kind === "home" ? "/" : `${selected.kind === "blog" ? "/blog" : selected.kind === "category" ? "/shop" : ""}/${selected.slug || ""}`);
  const previewPath = locale === "id" ? `/id${path === "/" ? "" : path}` : path;
  const aiDraft = onMetadata ? <AiDraft kind="seo" currentValues={{metaTitle: input.metaTitle, metaDescription: input.metaDescription, metaTitleId: translation?.metaTitle, metaDescriptionId: translation?.metaDescription}} sourceVersion={JSON.stringify({ input, translation })} title="Generate AI SEO" context={{ title: input.title, body: input.body, titleId: translation?.title, bodyId: translation?.body, metaTitle: input.metaTitle, metaDescription: input.metaDescription, metaTitleId: translation?.metaTitle, metaDescriptionId: translation?.metaDescription, contentType: input.kind }} onApply={onMetadata} /> : null;
  const incompleteChecks = result.checks.filter(needsSeoReview).length;
  return <section className={`rv-seo-panel${compact ? " rv-seo-panel--blog-editor" : ""}`} aria-label="SEO analysis">
    <div className="rv-seo-heading"><div><strong>Editorial readiness · {locale.toUpperCase()}</strong><p className="rv-hint">{result.words} words · {result.applicableChecks} scored checks · {result.label}</p></div><SeoBadge input={scored} /></div>
    {translation ? <div className="rv-inline rv-seo-panel__languages"><Button size="sm" ariaPressed={locale === "en"} onClick={() => setLocale("en")}>English</Button><Button size="sm" ariaPressed={locale === "id"} onClick={() => setLocale("id")}>Bahasa Indonesia</Button></div> : null}
    <div className="rv-inline rv-seo-panel__status"><Badge tone={input.metaTitle?.trim() && input.metaDescription?.trim() ? "green" : "amber"}>EN metadata: {input.metaTitle?.trim() && input.metaDescription?.trim() ? "complete" : "needs review"}</Badge>{translation ? <Badge tone={translationStatus === "Ready" ? "green" : "amber"}>ID translation: {translationStatus || "review required"}</Badge> : null}<Button size="sm" href="/admin/seo">Check technical SEO</Button></div>
    <label className="rv-field"><span className="rv-label">Focus topic (analysis only)</span><input className="rv-input" value={focusTopic} onChange={event => setFocusTopic(event.target.value)} placeholder="Main subject to check naturally in the copy" /></label>
    <div className="rv-seo-preview"><small>Search preview · rendivirgo.com{previewPath}</small><strong>{selected.metaTitle || selected.title || "Page title"}</strong><p>{selected.metaDescription || "Public metadata uses a fallback. Add a page-specific description."}</p></div>
    <p className="rv-hint rv-seo-panel__guidance">SEO title: {selected.metaTitle?.trim().length ?? 0} characters (guide: 30–60) · Description: {selected.metaDescription?.trim().length ?? 0} characters (guide: 120–160).</p>
    <p className="rv-hint rv-seo-panel__note">Editorial checklist, not a Google score or ranking prediction. Criteria differ by content type; compare within the same type. Alt text is checked for presence/fallback, not language or visual relevance. Search titles may include the brand, public metadata may use a fallback, and the technical HTML audit is separate.</p>
    <details className="rv-seo-panel__checks"><summary><span>Checks and improvements</span><span className="rv-seo-panel__count">{incompleteChecks} to review</span></summary><ul className={`rv-seo-checks${compact ? " rv-seo-checks--compact" : ""}`}>{result.checks.map(check => {
      const passed = check.status === "pass";
      const tone = passed ? "green" : check.status === "action" ? "red" : "bronze";
      const points = check.max === 0 ? "Review" : `${check.points}/${check.max}`;
      return <li key={check.id} className={passed ? "is-complete" : "is-incomplete"}><div className="rv-seo-checks__title"><Badge tone={tone}>{points}</Badge><strong>{check.label}</strong></div>{!passed ? compact ? <details className="rv-seo-checks__advice"><summary>How to improve</summary><p>{check.advice}</p></details> : <p>{check.advice}</p> : null}</li>;
    })}</ul></details>
    {compact && aiDraft ? <details className="rv-seo-panel__ai"><summary><span>Generate SEO with AI</span><span className="rv-seo-panel__count">Optional</span></summary>{aiDraft}</details> : aiDraft}
  </section>;
}
