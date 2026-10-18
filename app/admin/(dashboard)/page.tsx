"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi, formatCurrency, formatDate, formatDateTime, formatNumber, formatUSD, type ApiState } from "@/components/admin/api";
import { BarChart } from "@/components/admin/charts";
import { Badge, Button, Card, Loading, PageHeader, Stat, StatusBadge } from "@/components/admin/ui";

type Overview = {
  range: string;
  from: string;
  to: string;
  generatedAt: string;
  comparison: {
    from: string;
    to: string;
    revenue: number;
    orders: number;
    allOrders: number;
    newCustomers: number;
    paidOrders: number;
  };
  kpis: {
    revenue: number;
    orders: number;
    allOrders: number;
    avgOrderValue: number;
    newCustomers: number;
    pendingOrders: number;
    unreadMessages: number;
    lowStockCount: number;
    soldUniqueCount: number;
  };
  posKpis: { revenue: number; orders: number };
  salesSeries: Array<{ label: string; revenue: number; orders: number }>;
  posSalesSeries: Array<{ label: string; revenue: number; orders: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    currency: string;
    status: string;
    source: string;
    paymentStatus: string;
    placedAt: string;
  }>;
  topProducts: Array<{ productId: string; name: string; sku: string | null; quantity: number; revenue: number }>;
  lowStock: Array<{
    id: string;
    name: string;
    sku: string;
    category: string;
    stockModel: string;
    stockQuantity: number;
    status: string;
    ageDays: number;
  }>;
  categoryRevenue: Array<{ id: string; name: string; quantity: number; revenue: number }>;
};

const ranges = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "12m", label: "12 months" },
];

function compactSeries(series: Overview["salesSeries"], range: string) {
  if (range === "12m") {
    const formatter = new Intl.DateTimeFormat("en-US", { month: "short" });
    const monthlyPoints = series.map((point) => {
      const date = new Date(Number(point.label.slice(0, 4)), Number(point.label.slice(5, 7)) - 1, 1);
      return { point, month: formatter.format(date), year: String(date.getFullYear()).slice(-2) };
    });
    const monthCounts = new Map<string, number>();
    for (const { month } of monthlyPoints) monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);

    return monthlyPoints.map(({ point, month, year }) => ({
      ...point,
      label: monthCounts.get(month)! > 1 ? `${month} '${year}` : month,
    }));
  }

  if ((range !== "30d" && range !== "90d") || series.length < 14) return series;

  const bucketSize = range === "90d" ? 14 : 7;

  return Array.from({ length: Math.ceil(series.length / bucketSize) }, (_, index) => {
    const bucket = series.slice(index * bucketSize, index * bucketSize + bucketSize);
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    return {
      label: range === "90d" ? first.label.slice(5) : `${first.label.slice(5)}–${last.label.slice(5)}`,
      revenue: bucket.reduce((total, point) => total + point.revenue, 0),
      orders: bucket.reduce((total, point) => total + point.orders, 0),
    };
  });
}

function trendViewLabel(range: string) {
  if (range === "30d") return "weekly";
  if (range === "90d") return "2-week";
  return range === "12m" ? "monthly" : "daily";
}

function changePercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "No change" : "New";
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

function MetricHint({ current, previous, detail }: { current: number; previous: number; detail: string }) {
  const change = changePercent(current, previous);
  const tone = change.startsWith("-") ? "rv-kpi-delta rv-kpi-delta--down" : "rv-kpi-delta rv-kpi-delta--up";
  return (
    <span>
      {detail} · <span className={tone}>{change} vs previous period</span>
    </span>
  );
}

export default function AdminDashboardPage() {
  const [range, setRange] = useState("30d");
  const state: ApiState<Overview> = useApi<Overview>(`/api/admin/reports/overview?range=${range}`);

  const data = state.data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Store performance at a glance"
        actions={
          <div className="rv-dashboard-toolbar">
            <div className="rv-dashboard-toolbar__controls">
              <div className="rv-range-control" role="group" aria-label="Dashboard date range">
                {ranges.map((item) => (
                  <Button
                    key={item.value}
                    size="sm"
                    variant={range === item.value ? "primary" : "default"}
                    ariaPressed={range === item.value}
                    onClick={() => setRange(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <Button size="sm" onClick={state.refresh}>
                Refresh
              </Button>
            </div>
            {data ? (
              <span className="rv-dashboard-toolbar__date">
                Period: {formatDate(data.from)} – {formatDate(data.to)}
              </span>
            ) : null}
          </div>
        }
      />

      <div className="rv-content rv-dashboard-content">
        {state.loading && !data ? (
          <Card>
            <Loading label="Loading dashboard…" />
          </Card>
        ) : null}

        {state.error ? (
          <Card title={data ? "Dashboard update failed" : "Could not load dashboard"}>
            <p className="rv-error-text">{state.error}</p>
            {data ? <p className="rv-hint">Showing the last successful snapshot. Try refresh again before making decisions.</p> : null}
            <Button size="sm" onClick={state.refresh}>Try again</Button>
          </Card>
        ) : null}

        {data ? (
          <>
            <section className="rv-dashboard-section" aria-labelledby="core-performance-heading">
              <div className="rv-dashboard-section__heading">
                <div>
                  <span className="rv-dashboard-section__eyebrow">Selected period</span>
                  <h2 id="core-performance-heading" className="rv-dashboard-section__title">Core performance</h2>
                  <p className="rv-dashboard-section__hint">Online revenue and orders, workshop sales, and new customers.</p>
                </div>
              </div>
              <div className="rv-stat-grid rv-stat-grid--primary">
                <Stat
                  label="Revenue"
                  value={formatUSD(data.kpis.revenue)}
                  hint={<MetricHint current={data.kpis.revenue} previous={data.comparison.revenue} detail="Net paid orders" />}
                  tone="primary"
                />
                <Stat
                  label="Paid orders"
                  value={formatNumber(data.kpis.orders)}
                  hint={<MetricHint current={data.kpis.orders} previous={data.comparison.orders} detail={`All orders ${formatNumber(data.kpis.allOrders)} · Average ${formatUSD(data.kpis.avgOrderValue)}`} />}
                  tone="primary"
                />
                <Stat
                  label="New customers"
                  value={formatNumber(data.kpis.newCustomers)}
                  hint={<MetricHint current={data.kpis.newCustomers} previous={data.comparison.newCustomers} detail="First purchase or signup" />}
                  tone="primary"
                />
                <Stat
                  label="Workshop POS revenue"
                  value={formatCurrency(data.posKpis.revenue, "IDR")}
                  hint={`${formatNumber(data.posKpis.orders)} paid POS order(s) · net of refunds`}
                  tone="primary"
                />
              </div>
            </section>

            <section className="rv-dashboard-section rv-dashboard-section--attention" aria-labelledby="needs-attention-heading">
              <div className="rv-dashboard-section__heading">
                <div>
                  <span className="rv-dashboard-section__eyebrow">Live snapshot</span>
                  <h2 id="needs-attention-heading" className="rv-dashboard-section__title">Needs attention</h2>
                  <p className="rv-dashboard-section__hint">Current operating state · independent of the selected period.</p>
                </div>
                <div className="rv-dashboard-section__actions" aria-label="Quick actions">
                  <Button size="sm" variant="primary" href="/admin/products/new">New product</Button>
                  <Button size="sm" href="/admin/discounts">Manage discounts</Button>
                </div>
              </div>
              <div className="rv-stat-grid rv-stat-grid--attention">
                <Stat href="/admin/orders" label="Pending orders" value={formatNumber(data.kpis.pendingOrders)} hint="New and processing · Open orders" tone="attention" />
                <Stat href="/admin/messages" label="Unread messages" value={formatNumber(data.kpis.unreadMessages)} hint="Contact form inbox · Open inbox" tone="attention" />
                <Stat href="/admin/products" label="Low stock" value={formatNumber(data.kpis.lowStockCount)} hint="Quantity items at 3 or fewer · Review stock" tone="danger" />
              </div>
            </section>

            <div className="rv-split rv-split--charts">
              <Card
                title="Revenue trend"
                description={`Net paid orders · ${trendViewLabel(range)} view · USD`}
                actions={<Badge tone="green">{range}</Badge>}
              >
                <BarChart
                  data={compactSeries(data.salesSeries, range).map((point) => ({ label: point.label, value: point.revenue }))}
                  formatValue={(value) => formatUSD(value, { maximumFractionDigits: 0 })}
                  ariaLabel={`Revenue by period for ${range}, in USD`}
                  height={180}
                />
              </Card>
              <Card
                title="Orders trend"
                description={`Paid orders · ${trendViewLabel(range)} view · count`}
                actions={<Badge tone="blue">{range}</Badge>}
              >
                <BarChart
                  data={compactSeries(data.salesSeries, range).map((point) => ({ label: point.label, value: point.orders }))}
                  formatValue={(value) => formatNumber(value)}
                  ariaLabel={`Paid orders by period for ${range}`}
                  height={180}
                />
              </Card>
              <Card className="rv-card--chart-wide" title="Workshop POS revenue trend" description="Paid workshop orders · IDR, shown separately from USD online revenue" actions={<Badge tone="green">IDR</Badge>}>
                <BarChart
                  data={compactSeries(data.posSalesSeries, range).map((point) => ({ label: point.label, value: point.revenue }))}
                  formatValue={(value) => formatCurrency(value, "IDR")}
                  ariaLabel={`Workshop POS revenue by period for ${range}, in IDR`}
                  height={180}
                />
              </Card>
            </div>

            <div className="rv-split">
              <Card
                title="Recent orders"
                description="Current snapshot · latest orders across the store"
                flush
                actions={
                  <Link className="rv-btn rv-btn--sm" href="/admin/orders">
                    View all
                  </Link>
                }
              >
                <div className="rv-list">
                  {data.recentOrders.length ? (
                    data.recentOrders.slice(0, 5).map((order) => (
                      <Link className="rv-list__row" key={order.id} href={`/admin/orders/${order.id}`}>
                        <div>
                          <strong>{order.orderNumber}</strong>
                          <div className="rv-hint">{order.customerName}</div>
                        </div>
                        <div className="rv-list__meta">
                          <div>{formatCurrency(order.total, order.currency)}</div>
                          {order.source === "POS" ? <Badge tone="blue">Workshop POS</Badge> : null}
                          <StatusBadge status={order.status} />
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="rv-empty">No orders yet</div>
                  )}
                </div>
              </Card>

              <div className="rv-stack">
                <Card title="Order pipeline" description="Current snapshot · all order statuses" flush>
                  <div className="rv-list">
                    {data.statusBreakdown
                      .filter((entry) => entry.count > 0)
                      .map((entry) => (
                        <div className="rv-list__row" key={entry.status}>
                          <StatusBadge status={entry.status} />
                          <span className="rv-list__meta">{formatNumber(entry.count)}</span>
                        </div>
                      ))}
                    {data.statusBreakdown.every((entry) => entry.count === 0) ? (
                      <div className="rv-empty">No orders yet</div>
                    ) : null}
                  </div>
                </Card>

                <Card
                  title="Low stock & aged unique pieces"
                  description="Current inventory snapshot"
                  flush
                  actions={<Link className="rv-btn rv-btn--sm" href="/admin/products">View all</Link>}
                >
                  <div className="rv-list">
                    {data.lowStock.length ? (
                      data.lowStock.slice(0, 5).map((product) => (
                        <Link className="rv-list__row" key={product.id} href={`/admin/products/${product.id}`}>
                          <div>
                            <strong>{product.name}</strong>
                            <div className="rv-hint">
                              {product.sku} · {product.category}
                            </div>
                          </div>
                          <div className="rv-list__meta">
                            {product.stockModel === "Unique" ? (
                              <Badge tone="amber">{product.ageDays}d unsold</Badge>
                            ) : (
                              <Badge tone={product.stockQuantity <= 1 ? "red" : "amber"}>{product.stockQuantity} left</Badge>
                            )}
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="rv-empty">Stock levels are healthy</div>
                    )}
                  </div>
                </Card>
              </div>
            </div>

            <div className="rv-split">
              <Card title="Top products" description="Selected period · paid orders" flush>
                <div className="rv-table-wrap">
                  <table className="rv-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Units</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.length ? (
                        data.topProducts.map((product) => (
                          <tr key={product.productId}>
                            <td>
                              <Link href={`/admin/products/${product.productId}`}>{product.name}</Link>
                              <div className="rv-hint">{product.sku ?? "—"}</div>
                            </td>
                            <td>{formatNumber(product.quantity)}</td>
                            <td>{formatUSD(product.revenue)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3}>
                            <div className="rv-empty">No sales in this range</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Revenue by category" description="Selected period · paid orders" flush>
                <div className="rv-list">
                  {data.categoryRevenue.length ? (
                    data.categoryRevenue.slice(0, 8).map((category) => (
                      <div className="rv-list__row" key={category.id}>
                        <div>
                          <strong>{category.name}</strong>
                          <div className="rv-hint">{formatNumber(category.quantity)} units</div>
                        </div>
                        <span className="rv-list__meta">{formatUSD(category.revenue)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="rv-empty">No category sales yet</div>
                  )}
                </div>
              </Card>
            </div>

            <p className="rv-hint">
              Previous period: {formatDate(data.comparison.from)} – {formatDate(data.comparison.to)}. Current operations are live snapshot data. {data.kpis.soldUniqueCount} unique piece(s) sold in the selected
              period. Last updated: {formatDateTime(state.lastUpdated ?? data.generatedAt)}.
            </p>
          </>
        ) : null}
      </div>
    </>
  );
}
