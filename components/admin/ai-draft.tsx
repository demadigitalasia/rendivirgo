"use client";

import { useRef, useState } from "react";
import { prepareAiApply, canUndoAi } from "@/lib/ai-draft-state";
import { apiFetch, errorMessage } from "./api";
import { Button, Field, TextArea, Select } from "./ui";
import "./seo.css";

const fieldLabels: Record<string, string> = {
  title: "Title", body: "Content", metaTitle: "SEO title", metaDescription: "Meta description",
  heroTitle: "Hero heading", heroSubtitle: "Hero description", ownerBio: "Founder introduction", subtitle: "Subtitle", ctaLabel: "Button text",
  description: "Description", excerpt: "Excerpt", tags: "Tags",
};

export function AiDraft({ kind, title = "Generate AI", context, sourceVersion, currentValues, onApply }: {
  kind: "seo" | "page" | "home" | "banner" | "product" | "category" | "blog";
  title?: string;
  context: Record<string, unknown>;
  sourceVersion?: string;
  currentValues?: object;
  onApply: (draft: Record<string, string>) => void;
}) {
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState("");
  const language = "en";
  const [mode, setMode] = useState("replace");
  const [sourceMode, setSourceMode] = useState("full");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [undo, setUndo] = useState<{ values: Record<string, string>; applied: Record<string, string> } | null>(null);
  const current = currentValues as Record<string, unknown> | undefined;
  const snapshot = useRef("");
  const request = useRef(0);
  async function generate() {
    const version = ++request.current;
    setDraft(null);
    const source = sourceMode === "brief"
      ? { title: context.title ?? context.name ?? context.heroTitle, contentType: context.contentType }
      : Object.fromEntries(Object.entries(context).filter(([key]) => !key.endsWith("Id") && !/^id[A-Z]/.test(key) && !/translationStatus/i.test(key)));
    const serialized = JSON.stringify(source);
    snapshot.current = JSON.stringify([sourceVersion ?? JSON.stringify(context), brief, sourceMode]);
    if (sourceMode === "brief" && brief.trim().length < 2) { setError("Add verified facts to the brief before using title and brief only."); return; }
    if (serialized.length > 24000) { setError("Source content exceeds the request limit. Choose title and brief only, then provide the relevant verified facts."); return; }
    setBusy(true); setError("");
    try {
      const output = await apiFetch<Record<string, string>>("/api/admin/content/generate-copy", { method: "POST", json: { kind, brief, context: serialized } });
      if (version === request.current) { setDraft(output); setSelected(Object.fromEntries(Object.keys(output).map(key => [key, true]))); }
    } catch (caught) { if (version === request.current) setError(errorMessage(caught)); }
    finally { if (version === request.current) setBusy(false); }
  }
  return <div className="rv-ai-draft">
    <div className="rv-inline"><Select value={mode} onChange={setMode} ariaLabel="AI apply mode" options={[{value:"replace",label:"Replace selected fields"},{value:"empty",label:"Fill empty fields only"}]} /><Select value={sourceMode} onChange={setSourceMode} ariaLabel="AI source content" options={[{value:"full",label:"Use existing content and facts"},{value:"brief",label:"Use title and brief only"}]} /></div>
    <Field label="AI brief / verified facts" hint="Include confirmed facts and existing URLs. Only approved copy fields are sent to your configured OpenRouter model; product pricing and stock are excluded. Do not enter customer personal data. Generated text stays a draft."><TextArea rows={2} maxLength={4000} value={brief} onChange={setBrief} /></Field>
    <Button size="sm" loading={busy} onClick={generate}>{title}</Button>
    {error ? <p role="alert" className="rv-error-text">{error}</p> : null}
    {undo ? <Button size="sm" onClick={() => {
      if (!current || !canUndoAi(current, undo.applied)) { setError("These fields changed after Apply. Undo is unavailable to protect your edits."); return; }
      onApply(undo.values); setUndo(null); setError("");
    }}>Undo last AI apply</Button> : null}
    {draft ? <div className="rv-ai-draft-preview"><strong>Review generated draft</strong>{Object.entries(draft).filter(([key]) => !key.endsWith("Id") && !/^id[A-Z]/.test(key) && !/translationStatus/i.test(key)).map(([key, value]) => <div key={key}>{current ? <label className="rv-inline"><input type="checkbox" checked={selected[key] ?? false} onChange={event => setSelected(previous => ({ ...previous, [key]: event.target.checked }))} />Apply {fieldLabels[key] ?? key}</label> : null}{current ? <details><summary>Current saved-in-form text</summary><p style={{whiteSpace:"pre-wrap"}}>{String(current[key] ?? "") || "Empty"}</p></details> : null}<Field label={fieldLabels[key] ?? key}><TextArea rows={key.toLowerCase().includes("body") || key === "description" ? 6 : 2} value={value} onChange={next => setDraft(current => current ? { ...current, [key]: next } : current)} /></Field></div>)}<div className="rv-inline"><Button size="sm" variant="primary" onClick={() => {
      if (snapshot.current !== JSON.stringify([sourceVersion ?? JSON.stringify(context), brief, sourceMode])) { setError("The source changed after generation. Generate a fresh draft before applying."); return; }
      const output = prepareAiApply({generatedAt: snapshot.current, currentVersion: JSON.stringify([sourceVersion ?? JSON.stringify(context), brief, sourceMode]), draft, current: current ?? context, selected, language, mode});
      if (current && canUndoAi(current, output)) { setError("No fields would change. Select a field or change the apply mode."); return; }
      if (current) setUndo({ values: Object.fromEntries(Object.keys(output).map(key => [key, String(current[key] ?? "")])), applied: output });
      onApply(output); setDraft(null); setError("");
    }}>Apply draft to form</Button><Button size="sm" onClick={() => setDraft(null)}>Discard</Button></div><p className="rv-hint">Applying updates only the selected English fields. Review, then save manually. {kind === "banner" ? "The button link and selected image are preserved." : null}</p></div> : null}
  </div>;
}
