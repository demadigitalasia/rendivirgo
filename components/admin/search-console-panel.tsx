"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, errorMessage, useApi, type ApiState } from "@/components/admin/api";
import { Badge, Button, Card, Loading, Select } from "@/components/admin/ui";

type MetricRow = { key: string; clicks: number; impressions: number; ctr: number; position: number };
type SearchConsolePeriod = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQueries: MetricRow[];
  topPages: MetricRow[];
};
type SearchConsoleReport = {
  siteUrl: string;
  currentRange: { startDate: string; endDate: string };
  previousRange: { startDate: string; endDate: string };
  current: SearchConsolePeriod;
  previous: SearchConsolePeriod;
  generatedAt: string;
  note: string;
};
type SearchConsoleStatus = {
  configured: boolean;
  missingConfig: string[];
  connected: boolean;
  siteUrl: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  report: SearchConsoleReport | null;
};
type SearchConsoleSite = { siteUrl: string; permissionLevel: string };
type SearchConsoleInsight = {
  title: string;
  observation: string;
  action: string;
  priority: "high" | "medium" | "low";
  pageUrl: string | null;
  evidenceRows: Array<{
    period: "current" | "previous";
    dimension: "overview" | "query" | "page";
    key: string | null;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
};

const integrationPath = "/api/admin/integrations/search-console";

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 }).format(value);
}

function formatPosition(value: number) {
  return value ? value.toFixed(1) : "—";
}

function dateRange(range: SearchConsoleReport["currentRange"]) {
  return `${range.startDate} – ${range.endDate}`;
}

function evidenceRange(report: SearchConsoleReport, period: "current" | "previous") {
  return dateRange(period === "current" ? report.currentRange : report.previousRange);
}

function Metric({ label, current, previous, format, direction }: {
  label: string;
  current: number;
  previous: number;
  format: (value: number) => string;
  direction: "higher" | "lower";
  deltaUnit?: string;
}) {
  const change = current - previous;
  const ratio = previous > 0 ? change / previous : null;
  const hasPreviousBaseline = previous > 0;
  const favorable = direction === "higher" ? change > 0 : change < 0;
  const unfavorable = direction === "higher" ? change < 0 : change > 0;
  const tone = favorable ? "is-up" : unfavorable ? "is-down" : "";
  const delta = label === "Average position"
    ? `${Math.abs(change).toFixed(1)} positions`
    : label === "Average CTR"
      ? `${(Math.abs(change) * 100).toFixed(2)} percentage points`
      : format(Math.abs(change));
  const directionLabel = favorable ? "improved" : unfavorable ? "declined" : "unchanged";
  const relativeChange = label === "Average position" || ratio === null ? "" : ` (${formatPercent(Math.abs(ratio))} relative change)`;
  const changeText = hasPreviousBaseline
    ? `${delta} ${directionLabel}${relativeChange} vs previous period`
    : "No previous-period baseline";
  return <div className="rv-gsc-metric"><span>{label}</span><strong>{format(current)}</strong><small className={tone}>{changeText}</small></div>;
}

export function SearchConsolePanel() {
  const state: ApiState<SearchConsoleStatus> = useApi<SearchConsoleStatus>(integrationPath);
  const sitesState: ApiState<SearchConsoleSite[]> = useApi<SearchConsoleSite[]>(state.data?.connected ? `${integrationPath}/sites` : null);
  const [selectedSite, setSelectedSite] = useState("");
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [insights, setInsights] = useState<SearchConsoleInsight[]>([]);

  useEffect(() => {
    if (state.data?.siteUrl) setSelectedSite(state.data.siteUrl);
  }, [state.data?.siteUrl]);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("gsc");
    if (result === "connected") setMessage("Google Search Console connected. Select the RENDI VIRGO property to continue.");
    if (result === "error") setError("Google authorization did not finish. Check the Google OAuth setup and try again.");
  }, []);

  const report = state.data?.report ?? null;
  const siteOptions = useMemo(() => (sitesState.data ?? []).map((site) => ({ value: site.siteUrl, label: `${site.siteUrl} · ${site.permissionLevel.replaceAll("_", " ")}` })), [sitesState.data]);

  async function runAction(name: string, callback: () => Promise<void>) {
    setAction(name);
    setError("");
    setMessage("");
    try {
      await callback();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setAction("");
    }
  }

  async function connect() {
    await runAction("connect", async () => {
      const result = await apiFetch<{ authorizationUrl: string }>(`${integrationPath}/connect`, { method: "POST" });
      window.location.assign(result.authorizationUrl);
    });
  }

  async function chooseSite() {
    if (!selectedSite) return;
    await runAction("site", async () => {
      const result = await apiFetch<SearchConsoleStatus>(`${integrationPath}/site`, { json: { siteUrl: selectedSite } });
      state.setData(result);
      setInsights([]);
      setMessage("Search Console property selected.");
    });
  }

  async function refreshReport() {
    await runAction("sync", async () => {
      const result = await apiFetch<SearchConsoleReport>(`${integrationPath}/sync`, { method: "POST" });
      state.setData((current) => current ? { ...current, report: result, lastSyncedAt: result.generatedAt } : current);
      setInsights([]);
      setMessage("Search performance data refreshed.");
    });
  }

  async function generateInsights() {
    await runAction("insights", async () => {
      const result = await apiFetch<{ generatedAt: string; insights: SearchConsoleInsight[] }>(`${integrationPath}/insights`, { method: "POST" });
      setInsights(result.insights);
      setMessage("Recommendations generated from the saved Search Console report.");
    });
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google Search Console and remove the saved connection from RENDI VIRGO?")) return;
    await runAction("disconnect", async () => {
      const result = await apiFetch<{ googleRevoked: boolean }>(integrationPath, { method: "DELETE" });
      state.setData({ configured: state.data?.configured ?? false, missingConfig: state.data?.missingConfig ?? [], connected: false, siteUrl: null, connectedAt: null, lastSyncedAt: null, report: null });
      setInsights([]);
      setMessage(result.googleRevoked ? "Search Console disconnected and Google access revoked." : "Search Console was disconnected locally. Google did not confirm revoking access; remove RENDI VIRGO in your Google Account connections if needed.");
    });
  }

  if (state.loading && !state.data) return <Card title="Google Search Console"><Loading label="Loading Search Console connection…" /></Card>;
  if (state.error && !state.data) return <Card title="Google Search Console"><p className="rv-error-text">{state.error}</p><Button size="sm" onClick={state.refresh}>Try again</Button></Card>;

  return <Card
    className="rv-gsc-card"
    title="Google Search Console"
    description="Connect RENDI VIRGO’s verified property and turn search performance into evidence-based recommendations for the admin team."
    actions={<Badge tone={state.data?.connected ? "green" : state.data?.configured ? "gray" : "amber"}>{state.data?.connected ? "Connected" : state.data?.configured ? "Not connected" : "Needs setup"}</Badge>}
  >
    {!state.data?.configured ? <div className="rv-notice rv-notice--warning">
      <strong>OAuth setup is required</strong>
      <p>Add these API environment values, register the exact callback URL in Google Cloud, then restart the API:</p>
      <code>{state.data?.missingConfig.join(", ")}</code>
    </div> : null}

    {state.data?.connected ? <div className="rv-stack">
      <div className="rv-gsc-connection">
        <div><span className="rv-label">Google account connection</span><p>Read-only access. The refresh token stays encrypted on the API server.</p></div>
        <Button size="sm" onClick={disconnect} disabled={Boolean(action)}>{action === "disconnect" ? "Disconnecting…" : "Disconnect"}</Button>
      </div>
      {sitesState.loading && !sitesState.data ? <Loading label="Loading Search Console properties…" /> : sitesState.error ? <div className="rv-notice rv-notice--warning"><strong>Could not load properties</strong><p>{sitesState.error}</p><Button size="sm" onClick={sitesState.refresh}>Try again</Button></div> : <div className="rv-gsc-property">
        <label className="rv-field"><span className="rv-label">Property for this SEO report</span><Select value={selectedSite} onChange={setSelectedSite} options={siteOptions} placeholder="Choose a property" ariaLabel="Search Console property" disabled={!siteOptions.length || Boolean(action)} /></label>
        <Button variant="primary" onClick={chooseSite} loading={action === "site"} disabled={!selectedSite || selectedSite === state.data.siteUrl || Boolean(action)}>Use property</Button>
      </div>}
      {!siteOptions.length && !sitesState.loading && !sitesState.error ? <p className="rv-hint">The connected Google account has no Search Console properties. Add it to the verified RENDI VIRGO property, then refresh the property list.</p> : null}
      {state.data.siteUrl ? <div className="rv-gsc-report-actions"><div><strong>{state.data.siteUrl}</strong><small>{state.data.lastSyncedAt ? `Last refreshed ${new Date(state.data.lastSyncedAt).toLocaleString("en-US")}` : "No performance report has been loaded yet."}</small></div><Button variant="primary" onClick={refreshReport} loading={action === "sync"} disabled={Boolean(action)}>{report ? "Refresh performance" : "Load performance"}</Button></div> : null}
      {report ? <>
        <div className="rv-gsc-periods"><span>Current: {dateRange(report.currentRange)}</span><span>Previous: {dateRange(report.previousRange)}</span></div>
        {report.current.impressions < 100 || report.current.clicks < 20 ? <p className="rv-gsc-low-sample" role="status">Low sample in the current period ({formatInteger(report.current.impressions)} impressions, {formatInteger(report.current.clicks)} clicks). AI suggestions are marked low priority and should be treated as exploratory.</p> : null}
        <div className="rv-gsc-metrics">
          <Metric label="Clicks" current={report.current.clicks} previous={report.previous.clicks} format={formatInteger} direction="higher" />
          <Metric label="Impressions" current={report.current.impressions} previous={report.previous.impressions} format={formatInteger} direction="higher" />
          <Metric label="Average CTR" current={report.current.ctr} previous={report.previous.ctr} format={formatPercent} direction="higher" />
          <Metric label="Average position" current={report.current.position} previous={report.previous.position} format={formatPosition} direction="lower" />
        </div>
        <p className="rv-gsc-note">{report.note}</p>
        <div className="rv-gsc-tables">
          <div><h3>Highest impressions in the top 25 click-ranked pages</h3><MetricTable rows={report.current.topPages.slice(0, 8)} empty="No page data for this period." /></div>
          <div><h3>Top search queries</h3><MetricTable rows={report.current.topQueries.slice(0, 8)} empty="No query data for this period." /></div>
        </div>
        <div className="rv-gsc-ai-actions"><div><strong>AI recommendations</strong><p>Uses the saved metrics only. Recommendations stay in this dashboard; the AI does not edit or publish pages.</p></div><Button onClick={generateInsights} loading={action === "insights"} disabled={Boolean(action)}>Generate recommendations</Button></div>
        {insights.length ? <ol className="rv-gsc-insights">{insights.map((insight, index) => <li key={`${insight.title}-${index}`}>
          <div className="rv-gsc-insight-heading"><h3>{insight.title}</h3><Badge tone={insight.priority === "high" ? "red" : insight.priority === "medium" ? "amber" : "gray"}>{insight.priority} priority</Badge></div>
          <p>{insight.observation}</p>
          <div className="rv-gsc-insight-evidence"><strong>Verified report rows</strong><ul>{insight.evidenceRows.map((row, rowIndex) => <li key={`${row.period}-${row.dimension}-${row.key ?? "overview"}-${rowIndex}`}>
            <span><b>{row.dimension === "overview" ? "Site overview" : row.key}</b><small>{evidenceRange(report, row.period)} · {row.period} period</small></span>
            <span>{formatInteger(row.clicks)} clicks · {formatInteger(row.impressions)} impressions · {formatPercent(row.ctr)} CTR · position {formatPosition(row.position)}</span>
          </li>)}</ul></div>
          <p><strong>Suggested action:</strong> {insight.action}</p>
          {insight.pageUrl ? <a href={insight.pageUrl} target="_blank" rel="noreferrer">Open related page</a> : null}
        </li>)}</ol> : null}
      </> : null}
    </div> : <div className="rv-stack">
      <p>Connect the Google account that can view RENDI VIRGO’s Search Console property. The connection requests read-only search performance access and is used only in this admin SEO report.</p>
      <div className="rv-gsc-connect-row"><span>Only RENDI VIRGO site metrics are shown here. Store customers do not need to connect their Google accounts.</span><Button variant="primary" onClick={connect} loading={action === "connect"} disabled={!state.data?.configured || Boolean(action)}>Connect Google Search Console</Button></div>
    </div>}
    {error ? <p className="rv-error-text" role="alert">{error}</p> : null}
    {message ? <p className="rv-hint" role="status">{message}</p> : null}
  </Card>;
}

function MetricTable({ rows, empty }: { rows: MetricRow[]; empty: string }) {
  if (!rows.length) return <p className="rv-hint">{empty}</p>;
  return <div className="rv-gsc-table-wrap"><table className="rv-gsc-table"><thead><tr><th>Query / page</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key}><td>{row.key}</td><td>{formatInteger(row.clicks)}</td><td>{formatInteger(row.impressions)}</td><td>{formatPercent(row.ctr)}</td><td>{formatPosition(row.position)}</td></tr>)}</tbody></table></div>;
}
