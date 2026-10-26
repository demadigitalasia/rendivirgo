"use client";

import { useEffect, useState } from "react";
import { analyzeSeo, needsSeoReview, type SeoInput } from "@/lib/seo-analysis";
import { findSeoMetadataDuplicates, readLatestSeoAuditMetadata, SEO_AUDIT_HISTORY_KEY, type SeoAuditMetadataSnapshot } from "@/lib/seo-audit-history";
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
  void translation;
  void translationStatus;
  const [focusTopic, setFocusTopic] = useState("");
  const [auditSnapshot, setAuditSnapshot] = useState<SeoAuditMetadataSnapshot | null>(null);
  useEffect(() => {
    const readAudit = () => {
      try { setAuditSnapshot(readLatestSeoAuditMetadata(localStorage.getItem(SEO_AUDIT_HISTORY_KEY) || "[]")); }
      catch { setAuditSnapshot(null); }
    };
    readAudit();
    window.addEventListener("storage", readAudit);
    return () => window.removeEventListener("storage", readAudit);
  }, []);
  const selected = input;
  const scored = { ...selected, focusTopic };
  const result = analyzeSeo(scored);
  const path = selected.publicPath ?? (selected.kind === "home" ? "/" : `${selected.kind === "blog" ? "/blog" : selected.kind === "category" ? "/shop" : ""}/${selected.slug || ""}`);
  const previewPath = path;
  const publicTitle = input.metaTitle?.trim() || selected.publicTitleFallback?.trim() || selected.title || "Page title";
  const publicDescription = input.metaDescription?.trim() || selected.publicDescriptionFallback?.trim() || "No page-specific description is set.";
  const duplicates = auditSnapshot ? findSeoMetadataDuplicates(publicTitle, publicDescription, path, "en", auditSnapshot.entries) : null;
  const hasDuplicates = Boolean(duplicates && (duplicates.titles.length || duplicates.descriptions.length));
  const aiContext = {
    title: input.title,
    body: input.body,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    contentType: input.kind,
    focusTopic,
    editorialScore: result.score,
    editorialFindings: JSON.stringify(result.checks.filter(needsSeoReview).map(check => ({
      id: check.id,
      label: check.label,
      status: check.status,
      points: check.points,
      max: check.max,
      advice: check.advice,
    }))),
  };
  const aiDraft = onMetadata ? <AiDraft kind="seo" currentValues={{metaTitle: input.metaTitle, metaDescription: input.metaDescription}} sourceVersion={JSON.stringify([input, focusTopic])} title="Draft metadata with AI" context={aiContext} onApply={onMetadata} /> : null;
  const incompleteChecks = result.checks.filter(needsSeoReview).length;
  return <section className={`rv-seo-panel${compact ? " rv-seo-panel--blog-editor" : ""}`} aria-label="SEO analysis">
    <div className="rv-seo-heading"><div><strong>Editorial readiness · EN</strong><p className="rv-hint">{result.words} words · {result.applicableChecks} scored checks · {result.label}</p></div><SeoBadge input={scored} /></div>
    <div className="rv-inline rv-seo-panel__status"><Badge tone={input.metaTitle?.trim() && input.metaDescription?.trim() ? "green" : "amber"}>English metadata: {input.metaTitle?.trim() && input.metaDescription?.trim() ? "complete" : "needs review"}</Badge><Button size="sm" href="/admin/seo">Check technical SEO</Button></div>
    <label className="rv-field"><span className="rv-label">Focus topic or search query</span><input className="rv-input" value={focusTopic} onChange={event => setFocusTopic(event.target.value)} placeholder="A relevant phrase supported by this page" /><small className="rv-hint">Used in the editorial check and AI draft. Keep it specific to the page; the AI will avoid forcing it into the copy. This topic is temporary: list scores use the page title until you enter a topic here.</small></label>
    <div className="rv-seo-preview"><small>Effective search preview · rendivirgo.com{previewPath}</small><strong>{publicTitle}</strong><p>{publicDescription}</p></div>
    <details className="rv-seo-panel__checks">
      <summary><span>Site-wide metadata uniqueness</span><span className="rv-seo-panel__count">{!auditSnapshot ? "Run a scan" : hasDuplicates ? "Potential match" : "Last scan"}</span></summary>
      {auditSnapshot ? <>
        <p className="rv-hint">Compared with the latest technical scan saved in this browser ({new Date(auditSnapshot.at).toLocaleString()}). This snapshot can be out of date and does not block saving.</p>
        {hasDuplicates && duplicates ? <ul>
          {duplicates.titles.slice(0, 3).map(entry => <li key={`title-${entry.path}`}><strong>Title match:</strong> {entry.path}</li>)}
          {duplicates.descriptions.slice(0, 3).map(entry => <li key={`description-${entry.path}`}><strong>Description match:</strong> {entry.path}</li>)}
        </ul> : <p>No exact title or description matches were found in the saved scan.</p>}
      </> : <p className="rv-hint">Run the technical SEO audit to compare this draft with published pages on the sitemap.</p>}
      <Button size="sm" href="/admin/seo">Open technical SEO audit</Button>
    </details>
    <p className="rv-hint rv-seo-panel__guidance">SEO title: {selected.metaTitle?.trim().length ?? 0} characters (guide: 30–60) · Description: {selected.metaDescription?.trim().length ?? 0} characters (guide: 120–160).</p>
    <p className="rv-hint rv-seo-panel__note">Editorial checklist, not a Google score or ranking prediction. Criteria differ by content type; compare within the same type. Alt text is checked for presence/fallback, not language or visual relevance. Search titles may include the brand, public metadata may use a fallback, and the technical HTML audit is separate.</p>
    <details className="rv-seo-panel__checks"><summary><span>Checks and improvements</span><span className="rv-seo-panel__count">{incompleteChecks} to review</span></summary><ul className={`rv-seo-checks${compact ? " rv-seo-checks--compact" : ""}`}>{result.checks.map(check => {
      const passed = check.status === "pass";
      const tone = passed ? "green" : check.status === "action" ? "red" : "bronze";
      const points = check.max === 0 ? "Review" : `${check.points}/${check.max}`;
      return <li key={check.id} className={passed ? "is-complete" : "is-incomplete"}><div className="rv-seo-checks__title"><Badge tone={tone}>{points}</Badge><strong>{check.label}</strong></div>{!passed ? compact ? <details className="rv-seo-checks__advice"><summary>How to improve</summary><p>{check.advice}</p></details> : <p>{check.advice}</p> : null}</li>;
    })}</ul></details>
    {compact && aiDraft ? <details className="rv-seo-panel__ai"><summary><span>Draft metadata with AI</span><span className="rv-seo-panel__count">Optional</span></summary><p className="rv-hint">Creates only a meta title and description. Review the draft and save it from the editor.</p>{aiDraft}</details> : aiDraft ? <div className="rv-seo-panel__ai"><p className="rv-hint">Metadata-only draft. Review it, then save from the editor.</p>{aiDraft}</div> : null}
  </section>;
}
