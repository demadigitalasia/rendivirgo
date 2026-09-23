"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi, formatDate, formatNumber, formatUSD, type ApiState } from "@/components/admin/api";
import { BarChart } from "@/components/admin/charts";
import { Badge, Button, Card, Loading, PageHeader, Stat, StatusBadge } from "@/components/admin/ui";

type Overview = {
  range: string;
  from: string;
  to: string;
  kpis: {
    revenue: number;
    orders: number;
    avgOrderValue: number;
    newCustomers: number;
    pendingOrders: number;
    unreadMessages: number;
    lowStockCount: number;
    soldUniqueCount: number;
  };
  salesSeries: Array<{ label: string; revenue: number; orders: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    status: string;
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
          <div className="rv-inline">
            {ranges.map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={range === item.value ? "primary" : "default"}
                onClick={() => setRange(item.value)}
              >
                {item.label}
              </Button>
            ))}
            <Button size="sm" onClick={state.refresh}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="rv-content">
        {state.loading && !data ? (
          <Card>
            <Loading label="Loading dashboard…" />
          </Card>
        ) : null}

        {state.error ? (
          <Card title="Could not load dashboard">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        {data ? (
          <>
            <div className="rv-stat-grid">
              <Stat label="Revenue" value={formatUSD(data.kpis.revenue)} hint="Paid orders in range, net of refunds" />
              <Stat label="Orders" value={formatNumber(data.kpis.orders)} hint={`Average ${formatUSD(data.kpis.avgOrderValue)}`} />
              <Stat label="New customers" value={formatNumber(data.kpis.newCustomers)} hint="First purchase or signup in range" />
              <Stat label="Pending orders" value={formatNumber(data.kpis.pendingOrders)} hint="New and processing" />
              <Stat label="Unread messages" value={formatNumber(data.kpis.unreadMessages)} hint="Contact form inbox" />
              <Stat label="Low stock" value={formatNumber(data.kpis.lowStockCount)} hint="Quantity items at 3 or fewer" />
            </div>

            <Card
              title="Revenue trend"
              description="Paid orders, net of refunds"
              actions={<Badge tone="green">{range}</Badge>}
            >
              <BarChart
                data={data.salesSeries.map((point) => ({ label: point.label, value: point.revenue }))}
                formatValue={(value) => formatUSD(value, { maximumFractionDigits: 0 })}
              />
            </Card>

            <div className="rv-split">
              <Card
                title="Recent orders"
                flush
                actions={
                  <Link className="rv-btn rv-btn--sm" href="/admin/orders">
                    View all
                  </Link>
                }
              >
                <div className="rv-list">
                  {data.recentOrders.length ? (
                    data.recentOrders.map((order) => (
                      <Link className="rv-list__row" key={order.id} href={`/admin/orders/${order.id}`}>
                        <div>
                          <strong>{order.orderNumber}</strong>
                          <div className="rv-hint">{order.customerName}</div>
                        </div>
                        <div className="rv-list__meta">
                          <div>{formatUSD(order.total)}</div>
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
                <Card title="Order pipeline" flush>
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

                <Card title="Low stock & aged unique pieces" flush>
                  <div className="rv-list">
                    {data.lowStock.length ? (
                      data.lowStock.map((product) => (
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
              <Card title="Top products" flush>
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

              <Card title="Revenue by category" flush>
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
              Range: {formatDate(data.from)} – {formatDate(data.to)}. {data.kpis.soldUniqueCount} unique piece(s) sold in this
              range.
            </p>
          </>
        ) : null}
      </div>
    </>
  );
}
