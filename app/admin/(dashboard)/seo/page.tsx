"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/components/admin/api";
import { Button, PageHeader, Select, TextInput } from "@/components/admin/ui";
import { ArrowUpRightIcon, CheckIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { auditHtml, flagDuplicateMetadata, robotsAllowsPath, type HreflangAlternate, type HtmlAudit } from "@/lib/seo-html";
import { needsSeoReview, seoRating } from "@/lib/seo-analysis";
import "@/components/admin/seo.css";
import "./seo-audit.css";
import { siteUrl } from "@/lib/seo";
import { SEO_AUDIT_HISTORY_KEY } from "@/lib/seo-audit-history";

type ScanRow = { path: string; result?: HtmlAudit; error?: string };
type AuditRun = { at: string; total: number; successful: number; failed: number; average: number | null; results?: ScanRow[] };
const AUDIT_HISTORY_LIMIT = 10;
const AUDIT_DETAILS_LIMIT = 500;

function readSavedAuditRun(value: unknown): AuditRun | null {
  if (!value || typeof value !== "object") return null;
  const run = value as Record<string, unknown>;
  if (typeof run.at !== "string" || Number.isNaN(Date.parse(run.at))) return null;
  if (![run.total, run.successful, run.failed].every(item => typeof item === "number" && Number.isFinite(item) && item >= 0)) return null;
  if (run.average !== null && (typeof run.average !== "number" || !Number.isFinite(run.average) || run.average < 0 || run.average > 100)) return null;
  const results = Array.isArray(run.results) ? run.results.flatMap((value): ScanRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    if (typeof row.path !== "string" || !row.path.startsWith("/") || row.path.startsWith("//")) return [];
    if (typeof row.error === "string") return [{ path: row.path.slice(0, 2048), error: row.error.slice(0, 500) }];
    if (!row.result || typeof row.result !== "object") return [];
    const result = row.result as Record<string, unknown>;
    if (result.path !== row.path || typeof result.title !== "string" || typeof result.description !== "string" ||
      typeof result.locale !== "string" || typeof result.score !== "number" || !Number.isFinite(result.score) ||
      typeof result.label !== "string" || !["green", "amber", "red"].includes(String(result.tone)) || !Array.isArray(result.checks)) return [];
    const checks = result.checks.flatMap((value): HtmlAudit["checks"] => {
      if (!value || typeof value !== "object") return [];
      const check = value as Record<string, unknown>;
      if (typeof check.id !== "string" || typeof check.label !== "string" || typeof check.points !== "number" ||
        typeof check.max !== "number" || typeof check.advice !== "string") return [];
      const status = ["pass", "review", "action"].includes(String(check.status))
        ? check.status as HtmlAudit["checks"][number]["status"]
        : check.points === check.max ? "pass" : check.points > 0 ? "review" : "action";
      return [{ id: check.id, label: check.label, points: check.points, max: check.max, advice: check.advice, status }];
    });
    if (checks.length !== result.checks.length) return [];
    const normalized: HtmlAudit = {
      path: result.path as string,
      title: result.title,
      description: result.description,
      locale: result.locale,
      score: result.score,
      maxPoints: checks.reduce((sum, check) => sum + check.max, 0),
      applicableChecks: checks.filter(check => check.max > 0).length,
      checks,
      label: result.label,
      tone: result.tone as HtmlAudit["tone"],
    };
    return [{ path: normalized.path.slice(0, 2048), result: normalized }];
  }).slice(0, AUDIT_DETAILS_LIMIT) : undefined;
  return {
    at: run.at,
    total: run.total as number,
    successful: run.successful as number,
    failed: run.failed as number,
    average: run.average as number | null,
    ...(results ? { results } : {}),
  };
}
const routeKind = (path: string) => /\/shop\/[^/]+\/[^/]+/.test(path) ? "Product" : /\/shop\/[^/?]+/.test(path) ? "Category" : /\/blog\/[^/?]+/.test(path) ? "Blog" : "Page";

async function internalLinkOkay(path: string, signal: AbortSignal) {
  const options = { redirect: "manual" as const, credentials: "omit" as const, headers: { "x-rv-seo-audit": "1" }, signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) };
  let response = await fetch(path, { ...options, method: "HEAD" });
  if (response.status === 405 || response.status === 501) {
    response = await fetch(path, { ...options, method: "GET", headers: { ...options.headers, range: "bytes=0-0" } });
    void response.body?.cancel();
  }
  return response.status >= 200 && response.status < 400;
}

export default function SeoAuditPage() {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [issuesOnly, setIssuesOnly] = useState("");
  const [scannedAt, setScannedAt] = useState("");
  const [history, setHistory] = useState<AuditRun[]>([]);
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SEO_AUDIT_HISTORY_KEY) || "[]");
      if (!Array.isArray(saved)) return;
      const runs = saved.flatMap((value) => {
        const run = readSavedAuditRun(value);
        return run ? [run] : [];
      }).slice(0, AUDIT_HISTORY_LIMIT);
      setHistory(runs);
      if (runs[0]?.results) {
        setRows(runs[0].results);
        setScannedAt(new Date(runs[0].at).toLocaleString());
      }
    } catch { setHistoryError("Audit history is unavailable in this browser."); }
  }, []);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function scan() {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(""); setRows([]); setScannedAt("");
    const found: ScanRow[] = [];
    try {
      const response = await fetch("/sitemap.xml", { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]), cache: "no-store" });
      if (!response.ok) throw new Error(`Sitemap request failed (HTTP ${response.status}).`);
      const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
      if (xml.querySelector("parsererror")) throw new Error("The sitemap returned invalid XML.");
      const documents = [xml];
      const seenMaps = new Set<string>();
      for (let index = 0; index < documents.length; index++) {
        const document = documents[index];
        if (document.documentElement.localName !== "sitemapindex") continue;
        for (const location of Array.from(document.getElementsByTagName("loc"))) {
          const original = new URL(location.textContent || "", siteUrl());
          if (original.origin !== new URL(siteUrl()).origin && original.origin !== window.location.origin) throw new Error("Sitemap index contains an unexpected domain.");
          const path = original.pathname + original.search;
          if (seenMaps.has(path)) continue;
          if (seenMaps.size >= 20) throw new Error("Sitemap index limit reached (20). Split this audit into smaller runs.");
          seenMaps.add(path);
          const response = await fetch(path, {signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]), cache:"no-store", redirect:"error"});
          if (!response.ok) throw new Error(`Sitemap request failed (HTTP ${response.status}).`);
          const child = new DOMParser().parseFromString(await response.text(), "application/xml");
          if (child.querySelector("parsererror")) throw new Error("Invalid child sitemap XML.");
          documents.push(child);
        }
      }
      const urlsets = documents.filter(document => document.documentElement.localName === "urlset");
      const nodes = urlsets.flatMap(document => Array.from(document.getElementsByTagName("loc")));
      const alternates = urlsets.flatMap(document => Array.from(document.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "link")));
      const languageAlternates = new Map<string, HreflangAlternate[]>();
      const sitemapPath = (value: string) => {
        const url = new URL(value, siteUrl());
        if (url.origin !== new URL(siteUrl()).origin && url.origin !== window.location.origin) throw new Error("Sitemap URL contains an unexpected domain.");
        url.searchParams.sort();
        return url.pathname + url.search;
      };
      for (const urlset of urlsets) for (const entry of Array.from(urlset.getElementsByTagName("url"))) {
        const location = entry.getElementsByTagName("loc")[0]?.textContent;
        if (!location) continue;
        const entryUrl = new URL(location, siteUrl());
        const localized = Array.from(entry.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "link")).flatMap(link => {
          const language = link.getAttribute("hreflang")?.trim();
          const href = link.getAttribute("href")?.trim();
          return language && href ? [{ language, href }] : [];
        });
        if (localized.length) {
          const currentPath = sitemapPath(entryUrl.href);
          languageAlternates.set(currentPath, localized);
          for (const alternate of localized) {
            const alternatePath = sitemapPath(alternate.href);
            if (!languageAlternates.has(alternatePath)) languageAlternates.set(alternatePath, localized);
          }
        }
      }
      const paths = [...new Set([...nodes.map(node => node.textContent ?? ""), ...alternates.map(node => node.getAttribute("href") ?? "")].filter(Boolean).map(sitemapPath))];
      const normalizeSitemapUrl = (value: string) => {
        const url = new URL(value, siteUrl());
        url.hash = "";
        url.searchParams.sort();
        return url.href;
      };
      const reciprocalLanguageAlternates = new Map<string, boolean>();
      for (const [path, localized] of languageAlternates) {
        const sourceUrl = normalizeSitemapUrl(path);
        const self = localized.find(alternate => normalizeSitemapUrl(alternate.href) === sourceUrl);
        const reciprocal = Boolean(self) && localized.every(alternate => {
          const targetPath = sitemapPath(alternate.href);
          const targetAlternates = languageAlternates.get(targetPath) ?? [];
          return targetAlternates.some(back => back.language.toLowerCase() === self?.language.toLowerCase() && normalizeSitemapUrl(back.href) === sourceUrl);
        });
        reciprocalLanguageAlternates.set(path, reciprocal);
      }
      if (!paths.length) throw new Error("No public URLs were found in the sitemap.");
      let robotsText: string | null = null;
      try {
        const robotsResponse = await fetch("/robots.txt", { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10_000)]), cache: "no-store", redirect: "error", credentials: "omit" });
        if (robotsResponse.ok && robotsResponse.headers.get("content-type")?.toLowerCase().includes("text/plain")) robotsText = await robotsResponse.text();
      } catch (caught) {
        if (abort.signal.aborted) throw caught;
      }
      paths.forEach(path => found.push({ path })); setRows([...found]);
      let cursor = 0;
      const linkChecks = new Map<string, Promise<boolean>>();
      const worker = async () => {
        while (cursor < found.length && !abort.signal.aborted) {
          const index = cursor++; const row = found[index];
          try {
            // Resolve only same-origin paths. Never crawl arbitrary domains from XML.
            const target = new URL(row.path, window.location.origin);
            if (target.origin !== window.location.origin) throw new Error("Cross-origin URL excluded.");
            const res = await fetch(target, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]), cache: "no-store", headers: { "x-rv-seo-audit": "1" }, redirect: "error", credentials: "omit" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            if (!res.headers.get("content-type")?.includes("text/html")) throw new Error("Expected HTML.");
            const html = await res.text();
            const robotsAllowed = robotsText === null ? undefined : robotsAllowsPath(robotsText, row.path);
            row.result = auditHtml(html, row.path, siteUrl(), robotsAllowed, languageAlternates.get(row.path), reciprocalLanguageAlternates.get(row.path) ?? false);
            const parsed = new DOMParser().parseFromString(html,"text/html");
            const internal = [...new Set(Array.from((parsed.querySelector("main") ?? parsed.body).querySelectorAll("a[href]")).map(anchor=>anchor.getAttribute("href") || "").filter(href=>href.startsWith("/") && !href.startsWith("//")).map(href=>href.split("#")[0]).filter(Boolean))].slice(0,20);
            const broken: string[] = [];
            for (const href of internal) {
              if (!linkChecks.has(href)) linkChecks.set(href, internalLinkOkay(href, abort.signal).catch(()=>false));
              if (!await linkChecks.get(href)) broken.push(href);
            }
            if (broken.length) row.result.checks = row.result.checks.map(check=>check.id === "links" ? {...check,points:0,status:"action",advice:`Internal link checks failed: ${broken.join(", ")}. Up to 20 unique relative links per page are checked; review failures manually.`} : check);
            if (/\b(?:noindex|none)\b/i.test(res.headers.get("x-robots-tag") || "")) {
              row.result.checks = row.result.checks.map(check => check.id === "indexable" ? {...check,points:0,status:"action",advice:"The HTTP X-Robots-Tag header prevents indexing."} : check);
            }
            row.result.maxPoints = row.result.checks.reduce((sum, check) => sum + check.max, 0);
            row.result.score = row.result.maxPoints ? Math.round(row.result.checks.reduce((sum, check) => sum + check.points, 0) / row.result.maxPoints * 100) : 0;
            Object.assign(row.result, seoRating(row.result.score));
          } catch (caught) { if (!abort.signal.aborted) row.error = errorMessage(caught); }
          if (!abort.signal.aborted) setRows(found.map(item => ({ ...item })));
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (!abort.signal.aborted) {
        const audited = flagDuplicateMetadata(found.flatMap(row => row.result ? [row.result] : []));
        const auditedByPath = new Map(audited.map(result => [result.path, result]));
        const detailedRows = found.map(row => ({ ...row, ...(row.result ? { result: auditedByPath.get(row.path) ?? row.result } : {}) }));
        setRows(detailedRows);
        setScannedAt(new Date().toLocaleString());
        const run: AuditRun = {at: new Date().toISOString(), total:found.length, successful:audited.length, failed:found.filter(row=>row.error).length, average:audited.length ? Math.round(audited.reduce((sum,row)=>sum+row.score,0)/audited.length) : null, results:detailedRows.slice(0,AUDIT_DETAILS_LIMIT)};
        const updated = [run,...history].slice(0,AUDIT_HISTORY_LIMIT);
        setHistory(updated);
        try { localStorage.setItem(SEO_AUDIT_HISTORY_KEY,JSON.stringify(updated)); } catch { setHistoryError("This scan completed, but browser storage could not save its history."); }
      }
    } catch (caught) { if (!abort.signal.aborted) setError(errorMessage(caught)); }
    finally { if (controller.current === abort) setBusy(false); }
  }
  const completed = rows.filter(row => row.result || row.error).length;
  const results = rows.flatMap(row => row.result ? [row.result] : []);
  const average = results.length ? Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length) : null;
  const shown = rows.filter(row => (!kind || routeKind(row.path) === kind) && (!query || `${row.path} ${row.result?.title ?? ""}`.toLowerCase().includes(query.toLowerCase())) && (!issuesOnly || row.error || (row.result && row.result.score < 80)));
  function exportCsv() {
    const escape = (value: unknown) => { let text = String(value ?? ""); if (/^[=+@-]/.test(text)) text = "'" + text; return `"${text.replaceAll('"','""')}"`; };
    const lines = [["URL","Title","Locale","Score","Error","Improvements"],...shown.map(row=>[row.path,row.result?.title,row.result?.locale,row.result?.score,row.error,row.result?.checks.filter(needsSeoReview).map(check=>`${check.label}: ${check.advice}`).join("; ")])];
    const url = URL.createObjectURL(new Blob(["\uFEFF"+lines.map(line=>line.map(escape).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a"); link.href=url; link.download="seo-audit.csv"; link.click(); URL.revokeObjectURL(url);
  }
  const failed = rows.filter(row => row.error).length;
  const good = results.filter(result => result.score >= 80).length;
  const attention = results.filter(result => result.score < 80).length;
  const displayScore = rows.length || busy ? average : history[0]?.average ?? null;
  const coveragePercent = rows.length ? completed / rows.length * 100 : history[0]?.total ? history[0].successful / history[0].total * 100 : 0;
  const issueGroups = Object.values(results.flatMap(result => result.checks.filter(needsSeoReview)).reduce<Record<string, {label: string; count: number}>>((groups, check) => {
    groups[check.id] ??= {label: check.label, count: 0}; groups[check.id].count++; return groups;
  }, {})).sort((a,b) => b.count-a.count).slice(0,4);
  const dateLabel = (value: string) => new Date(value).toLocaleString("en-GB", {day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
  return <>
    <PageHeader eyebrow="Storefront intelligence" title="SEO Audit" subtitle="Technical checks of public HTML, sitemap language links, and robots.txt. This is not a Google ranking or indexing score." actions={<div className="rv-inline">{busy ? <Button onClick={() => { controller.current?.abort(); setBusy(false); }}>Stop scan</Button> : null}<Button onClick={exportCsv} disabled={!rows.length || busy}>Export CSV</Button><Button variant="primary" loading={busy} onClick={scan}>{rows.length ? "Run audit again" : "Run storefront audit"}</Button></div>} />
    <div className="rv-content rv-audit">
      <section className="rv-audit-overview" aria-label="Audit overview">
        <div className="rv-audit-cover">
          <div className="rv-audit-kicker"><span className="rv-audit-seal" aria-hidden="true">RV</span><span>SEARCH VISIBILITY REPORT</span><span className="rv-audit-edition">ENGLISH ONLY</span></div>
          <div className="rv-audit-cover__body"><div><span className="rv-audit-overline">{busy ? "Technical audit in progress" : average !== null ? "Technical checks · average" : history.length ? "Last completed technical audit" : "Your next improvement starts here"}</span><div className="rv-audit-score">{displayScore ?? "—"}<span>/100</span></div><h2>{busy ? "Reading your storefront." : displayScore === null ? "Make every page discoverable." : displayScore >= 80 ? "A strong technical foundation." : "Review the technical findings."}</h2><p>Metadata, canonical declarations, page structure, images, links, robots.txt access, language alternates, and basic structured data. Indexing and rankings need separate verification.</p></div><div className="rv-audit-scale" aria-hidden="true"><span>GOOD</span>{Array.from({length:10},(_,index)=><i key={index} className={displayScore !== null && index < Math.round(displayScore/10) ? "is-filled" : ""}/>)}<span>NEEDS WORK</span></div></div>
          <div className="rv-audit-cover__foot"><span className={busy ? "rv-audit-live is-busy" : "rv-audit-live"}>{busy ? "Scanning public URLs" : scannedAt ? "Audit complete" : history[0] ? `Last run · ${dateLabel(history[0].at)}` : "Ready for the first scan"}</span><span>RENDI VIRGO · DIGITAL CATALOG</span></div>
        </div>
        <div className="rv-audit-ledger"><div className="rv-audit-section-label">01 / SCAN COVERAGE</div><h2>The storefront, at a glance.</h2><div className="rv-audit-coverage"><strong>{rows.length ? completed : history[0]?.successful ?? "—"}<span> / {rows.length || history[0]?.total || "—"}</span></strong><span>{rows.length ? "URLs checked this run" : history.length ? "URLs in the last completed run" : "Public URLs in your sitemap"}</span></div><div className="rv-audit-progress" role="progressbar" aria-label="Scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(coveragePercent)}><span style={{width:`${coveragePercent}%`}}/></div><dl className="rv-audit-totals"><div><dt><i className="is-green"/>In good shape</dt><dd>{results.length ? good : "—"}</dd></div><div><dt><i className="is-amber"/>Needs improvement</dt><dd>{results.length ? attention : "—"}</dd></div><div><dt><i className="is-red"/>Could not be scanned</dt><dd>{rows.length ? failed : "—"}</dd></div></dl><p>Scores describe successfully scanned pages. Review failed URLs separately.</p></div>
      </section>
      {error ? <p role="alert" className="rv-audit-alert">{error}</p> : null}
      <div className="rv-audit-workspace">
        <section className="rv-audit-register" aria-labelledby="audit-results-title">
          <div className="rv-audit-register__heading"><div><div className="rv-audit-section-label">02 / PAGE REGISTER</div><h2 id="audit-results-title">Where discovery begins.</h2><p>Inspect the pages behind your storefront.</p></div><span className="rv-audit-count">{shown.length}<small>URLs shown</small></span></div>
          <div className="rv-audit-filters"><label><span>Find a page</span><TextInput value={query} onChange={setQuery} placeholder="Search by URL or page title…" /></label><label><span>Content type</span><Select value={kind} onChange={setKind} ariaLabel="Content type" placeholder="All content" options={["Page", "Product", "Category", "Blog"].map(value => ({value,label:value}))}/></label><label><span>Show</span><Select value={issuesOnly} onChange={setIssuesOnly} ariaLabel="Score filter" placeholder="All results" options={[{value:"yes",label:"Needs improvement / failed"}]}/></label></div>
          <div className="rv-audit-register__table"><table aria-label="Public page technical audit results"><thead><tr><th>Page / destination</th><th>Content</th><th>Technical score</th><th>Findings</th></tr></thead><tbody>{shown.map((row,index) => { const issues=row.result?.checks.filter(needsSeoReview) ?? []; return <tr key={row.path}><td><div className="rv-audit-page"><span className="rv-audit-row-number">{String(index+1).padStart(2,"0")}</span><div><a href={row.path} target="_blank" rel="noreferrer">{row.result?.title || row.path}<ArrowUpRightIcon size={13} /></a><small>{row.path}</small></div></div></td><td><span className="rv-audit-type">{routeKind(row.path)}</span></td><td>{row.result ? <div className={`rv-audit-row-score is-${row.result.tone}`}><strong>{row.result.score}<span>/100</span></strong><div><i style={{width:`${row.result.score}%`}}/></div><small>{row.result.applicableChecks} applicable checks</small></div> : <span className="rv-hint">{row.error ? "Unavailable" : busy ? "Scanning…" : "Not scanned"}</span>}</td><td>{row.error ? <span role="status" className="rv-audit-failure">{row.error}</span> : row.result ? issues.length ? <details className="rv-audit-findings"><summary><span>{issues.length}</span> improvements</summary><ul>{issues.map(check=><li key={check.id}><strong>{check.label}</strong><p>{check.advice}</p></li>)}</ul></details> : <span className="rv-audit-clear"><CheckIcon size={13} /> All checks passed</span> : <span className="rv-hint">—</span>}</td></tr>})}</tbody></table></div>
          {!shown.length ? <div className="rv-audit-empty"><SearchIcon size={32} /><h3>{rows.length ? "No pages match these filters." : "A clearer view of your storefront."}</h3><p>{rows.length ? "Try another title, URL, or content type." : "Run an audit to inspect English storefront pages. Each result includes a score and practical next steps."}</p>{rows.length ? <Button size="sm" onClick={()=>{setQuery("");setKind("");setIssuesOnly("");}}>Clear filters</Button> : <Button size="sm" onClick={scan} loading={busy}>Run storefront check</Button>}</div> : null}
          <div className="rv-audit-register__foot"><span>{busy ? `Checking ${completed} of ${rows.length} URLs…` : scannedAt ? `Completed ${scannedAt}` : "Results appear after a scan."}</span><span>GOOD 80–100 · REVIEW 50–79 · ATTENTION 0–49</span></div>
        </section>
        <aside className="rv-audit-sidebar">
          <section className="rv-audit-priorities"><div className="rv-audit-section-label">03 / EDITOR’S DESK</div><h2>Start with the details.</h2><p>The most common findings in this run.</p>{issueGroups.length ? <ol>{issueGroups.map((group,index)=><li key={group.label}><span>{String(index+1).padStart(2,"0")}</span><strong>{group.label}</strong><small>{group.count} pages</small></li>)}</ol> : <div className="rv-audit-sidebar-note">{busy ? "Finding patterns as your pages are checked…" : "Run an audit to reveal the checks that need the most attention."}</div>}<nav aria-label="SEO editors">{[{label:"Products",href:"/admin/products"},{label:"Categories",href:"/admin/categories"},{label:"Journal",href:"/admin/content/blog"},{label:"Pages",href:"/admin/content/pages"},{label:"Homepage",href:"/admin/content/home"}].map(item=><a key={item.href} href={item.href}>{item.label}<ArrowUpRightIcon size={13} /></a>)}</nav></section>
          <section className="rv-audit-history"><div className="rv-audit-section-label">AUDIT NOTEBOOK</div><h2>Previous checks.</h2>{historyError ? <p role="status">{historyError}</p> : null}{history.length ? <ol>{history.slice(0,4).map((run,index)=><li key={`${run.at}-${index}`}><div><time dateTime={run.at}>{dateLabel(run.at)}</time><small>{run.successful}/{run.total} checked · {run.failed} failed</small></div><strong>{run.average ?? "—"}<span>/100</span></strong></li>)}</ol> : <p>Your first completed audit will appear here.</p>}<small>Last {AUDIT_HISTORY_LIMIT} runs and per-URL details for up to {AUDIT_DETAILS_LIMIT} URLs saved in this browser.</small></section>
          <details className="rv-audit-method"><summary>What this report measures <PlusIcon size={15} /></summary><p>Technical checks cover public HTML, metadata, canonical declarations, headings, image alt attributes, basic JSON-LD fields, HTTP indexing headers, Googlebot access rules from robots.txt when it can be retrieved, HTML hreflang consistency with the sitemap and sitemap reciprocity, and up to 20 relative internal links per page. They do not prove Google will crawl, index, or rank a URL, and they do not assess whether the translations are accurate.</p><p>Editorial readiness scores live in each content editor. Those use different checklists by content type and should only be compared within the same type. Character counts and word counts are writing prompts, not Google limits or ranking factors.</p><p>Search Console indexing status, backlinks, Core Web Vitals, and complete rich-result eligibility are not measured. Review them with <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Google Search Console</a> and <a href="https://pagespeed.web.dev/" target="_blank" rel="noreferrer">PageSpeed Insights</a>. Link checks use HEAD with a ranged GET fallback; some destinations may still block automated checks. The average excludes URLs that could not be fetched.</p></details>
        </aside>
      </div>
    </div>
  </>;
}
