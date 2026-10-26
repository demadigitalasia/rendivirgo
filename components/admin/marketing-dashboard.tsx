"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl, formatDate, formatNumber, formatUSD, useApi, type ApiState } from "@/components/admin/api";
import { DataTable, type Column } from "@/components/admin/data-table";
import { Badge, Button, Card, EmptyState, Field, Loading, PageHeader, Select, Stat, TextInput } from "@/components/admin/ui";

type CampaignRange = "7d" | "30d" | "90d" | "12m";

type CampaignReport = {
  range: CampaignRange;
  from: string;
  to: string;
  totals: { paidOrders: number; revenue: number; customRequests: number };
  campaigns: Array<{
    campaign: string;
    source: string | null;
    medium: string | null;
    content: string | null;
    term: string | null;
    discountCode: string | null;
    paidOrders: number;
    revenue: number;
    customRequests: number;
  }>;
};

const ranges = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "12m", label: "12 months" },
];

export function MarketingDashboard() {
  const [origin, setOrigin] = useState("");
  const [targetPath, setTargetPath] = useState("/shop");
  const [source, setSource] = useState("instagram");
  const [medium, setMedium] = useState("social");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [range, setRange] = useState<CampaignRange>("30d");

  useEffect(() => setOrigin(window.location.origin), []);

  const generatedLink = useMemo(() => {
    const path = targetPath.trim();
    if (!origin || !path.startsWith("/") || path.startsWith("//") || !source.trim() || !medium.trim() || !campaign.trim()) return "";
    try {
      const url = new URL(path, origin);
      if (url.origin !== origin) return "";
      url.searchParams.set("utm_source", source.trim());
      url.searchParams.set("utm_medium", medium.trim());
      url.searchParams.set("utm_campaign", campaign.trim());
      if (content.trim()) url.searchParams.set("utm_content", content.trim());
      if (term.trim()) url.searchParams.set("utm_term", term.trim());
      if (discountCode.trim()) url.searchParams.set("discount_code", discountCode.trim().toUpperCase());
      return url.toString();
    } catch {
      return "";
    }
  }, [campaign, content, discountCode, medium, origin, source, targetPath, term]);

  const copyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const report: ApiState<CampaignReport> = useApi<CampaignReport>(apiUrl("/api/admin/reports/campaigns", { range }));
  const data = report.data;

  const columns: Array<Column<CampaignReport["campaigns"][number]>> = [
    { key: "campaign", header: "Campaign", render: (row) => <strong>{row.campaign}</strong> },
    {
      key: "channel",
      header: "Source / medium",
      render: (row) => <span>{[row.source, row.medium].filter(Boolean).join(" / ") || "—"}</span>,
    },
    { key: "content", header: "Content", render: (row) => row.content || "—" },
    { key: "term", header: "Term", render: (row) => row.term || "—" },
    { key: "discount", header: "Discount", render: (row) => row.discountCode || "—" },
    { key: "orders", header: "Paid orders", align: "right", render: (row) => formatNumber(row.paidOrders) },
    { key: "revenue", header: "Net revenue", align: "right", render: (row) => formatUSD(row.revenue) },
    { key: "customRequests", header: "Custom requests", align: "right", render: (row) => formatNumber(row.customRequests) },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Campaigns"
        subtitle="Create trackable links and see which campaigns bring paid orders and custom requests."
      />

      <div className="rv-content">
        <Card title="Create a campaign link" description="Share the generated link in social posts, email, or ads. The target must be a path on this website.">
          <div className="rv-form-grid">
            <Field label="Landing page path" hint="For example, /shop or /lapidary/custom-order">
              <TextInput value={targetPath} onChange={setTargetPath} placeholder="/shop" maxLength={500} />
            </Field>
            <Field label="Source" hint="Where the link will be shared, such as instagram or newsletter">
              <TextInput value={source} onChange={setSource} placeholder="instagram" required maxLength={120} />
            </Field>
            <Field label="Medium" hint="Channel type, such as social, email, or cpc">
              <TextInput value={medium} onChange={setMedium} placeholder="social" required maxLength={120} />
            </Field>
            <Field label="Campaign name" hint="Use the same name across links that belong to one promotion">
              <TextInput value={campaign} onChange={setCampaign} placeholder="october-stone-edit" required maxLength={160} />
            </Field>
            <Field label="Content variant" hint="Optional label for a post, creative, or placement">
              <TextInput value={content} onChange={setContent} placeholder="blue-tourmaline-reel" maxLength={200} />
            </Field>
            <Field label="Term" hint="Optional keyword or audience label">
              <TextInput value={term} onChange={setTerm} placeholder="tourmaline" maxLength={200} />
            </Field>
            <Field label="Discount code" hint="Optional. It will be prefilled and validated at retail checkout.">
              <TextInput value={discountCode} onChange={setDiscountCode} placeholder="OCTOBER10" maxLength={80} />
            </Field>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
            {generatedLink ? (
              <div className="rv-notice" aria-live="polite">
                <strong>Campaign link</strong>
                <div className="rv-mono" style={{ overflowWrap: "anywhere", marginTop: 8 }}>{generatedLink}</div>
              </div>
            ) : (
              <p className="rv-hint">Enter a campaign name and a same-site path to generate the link.</p>
            )}
            <div className="rv-inline">
              <Button variant="primary" onClick={() => void copyLink()} disabled={!generatedLink}>
                {copied ? "Copied" : "Copy campaign link"}
              </Button>
              {origin.includes("localhost") ? <span className="rv-hint">On the live website, this link will use the production domain.</span> : null}
            </div>
          </div>
        </Card>

        <Card
          title="Campaign results"
          description={data ? `${formatDate(data.from)} – ${formatDate(data.to)} · Paid orders and submitted custom requests` : "Paid orders and custom requests attributed to UTM campaign links."}
          actions={
            <div className="rv-inline">
              <Select value={range} onChange={(value) => setRange(value as CampaignRange)} options={ranges} ariaLabel="Campaign report range" />
              <Button size="sm" onClick={report.refresh} disabled={report.loading}>Refresh</Button>
            </div>
          }
        >
          {report.loading && !data ? <Loading label="Loading campaign results…" /> : null}
          {report.error ? <p className="rv-error-text">{report.error}</p> : null}
          {data ? (
            <>
              <div className="rv-stat-grid" style={{ marginBottom: 20 }}>
                <Stat label="Paid orders" value={formatNumber(data.totals.paidOrders)} hint="Online and wholesale orders" />
                <Stat label="Net revenue" value={formatUSD(data.totals.revenue)} hint="After recorded refunds" />
                <Stat label="Custom requests" value={formatNumber(data.totals.customRequests)} hint="Lapidary forms submitted" />
              </div>
              <DataTable
                columns={columns}
                items={data.campaigns}
                rowKey={(row) => `${row.campaign}:${row.source ?? ""}:${row.medium ?? ""}:${row.content ?? ""}:${row.term ?? ""}:${row.discountCode ?? ""}`}
                loading={report.loading}
                emptyTitle="No attributed conversions in this range"
                emptyDescription="Share a campaign link and this report will count paid orders and custom requests that use it."
              />
              <div className="rv-inline" style={{ marginTop: 12 }}>
                <Badge tone="blue">UTM attribution</Badge>
                <span className="rv-hint">This report does not include visitor or click counts.</span>
              </div>
            </>
          ) : null}
          {!report.loading && !data && !report.error ? <EmptyState title="Campaign results are unavailable" /> : null}
        </Card>
      </div>
    </>
  );
}
