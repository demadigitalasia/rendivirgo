"use client";

import { useState } from "react";
import { apiUrl, formatDate, formatNumber, formatUSD, useApi, type ApiState } from "@/components/admin/api";
import { BarChart, LineChart } from "@/components/admin/charts";
import { DataTable, type Column } from "@/components/admin/data-table";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Loading,
  PageHeader,
  Select,
  Stat,
  Tabs,
  TextInput,
} from "@/components/admin/ui";

type RangeValue = "7d" | "30d" | "90d" | "12m";
type GroupValue = "day" | "week" | "month";
type GroupSelection = GroupValue | "";

type SalesReport = {
  from: string;
  to: string;
  groupBy: GroupValue;
  series: Array<{ label: string; revenue: number; orders: number }>;
  total: { revenue: number; orders: number; avgOrderValue: number };
};

type ProductsReport = {
  range: string;
  from: string;
  to: string;
  topProducts: Array<{
    productId: string;
    name: string;
    sku: string | null;
    slug: string | null;
    quantity: number;
    revenue: number;
  }>;
  categoryRevenue: Array<{ categoryId: string; name: string; quantity: number; revenue: number }>;
  originRevenue: Array<{ origin: string; quantity: number; revenue: number }>;
  stoneTypeRevenue: Array<{ stoneType: string; quantity: number; revenue: number }>;
  soldVsAvailable: { sold: number; available: number; reserved: number };
};

type CustomersReport = {
  range: string;
  from: string;
  to: string;
  topCustomers: Array<{
    customerId: string;
    name: string;
    email: string | null;
    country: string | null;
    orderCount: number;
    totalSpent: number;
  }>;
  newVsRepeat: { newCustomers: number; repeatCustomers: number };
  countries: Array<{ country: string; count: number }>;
};

type TrafficReport = {
  integrated: boolean;
  note: string;
  series: Array<{ label: string; value: number }>;
};

const ranges: Array<{ value: RangeValue; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "12m", label: "12 months" },
];

const groupOptions: Array<{ value: GroupValue; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export default function AdminReportsPage() {
  const [tab, setTab] = useState("sales");
  const [range, setRange] = useState<RangeValue>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [groupBy, setGroupBy] = useState<GroupSelection>("");

  const custom = Boolean(from || to);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Sales, product and customer analytics"
        actions={
          <div className="rv-inline">
            {ranges.map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={!custom && range === item.value ? "primary" : "default"}
                onClick={() => {
                  setRange(item.value);
                  setFrom("");
                  setTo("");
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        }
      />

      <div className="rv-content">
        <Card>
          <Tabs
            tabs={[
              { value: "sales", label: "Sales" },
              { value: "products", label: "Products" },
              { value: "customers", label: "Customers" },
              { value: "traffic", label: "Traffic" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </Card>

        {tab === "sales" ? (
          <SalesTab
            range={range}
            from={from}
            to={to}
            groupBy={groupBy}
            onFrom={setFrom}
            onTo={setTo}
            onGroupBy={setGroupBy}
          />
        ) : null}
        {tab === "products" ? <ProductsTab range={range} /> : null}
        {tab === "customers" ? <CustomersTab range={range} /> : null}
        {tab === "traffic" ? <TrafficTab /> : null}
      </div>
    </>
  );
}

function SalesTab({
  range,
  from,
  to,
  groupBy,
  onFrom,
  onTo,
  onGroupBy,
}: {
  range: RangeValue;
  from: string;
  to: string;
  groupBy: GroupSelection;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onGroupBy: (value: GroupSelection) => void;
}) {
  const custom = Boolean(from || to);
  const params = custom ? { from, to, groupBy: groupBy || undefined } : { range, groupBy: groupBy || undefined };
  const state: ApiState<SalesReport> = useApi<SalesReport>(apiUrl("/api/admin/reports/sales", params));
  const exportUrl = apiUrl("/api/admin/reports/export/sales.csv", params);
  const data = state.data;

  const columns: Array<Column<SalesReport["series"][number]>> = [
    { key: "label", header: "Period", render: (point) => point.label },
    { key: "orders", header: "Orders", align: "right", render: (point) => formatNumber(point.orders) },
    { key: "revenue", header: "Revenue", align: "right", render: (point) => formatUSD(point.revenue) },
    {
      key: "average",
      header: "Average order",
      align: "right",
      render: (point) => formatUSD(point.orders > 0 ? point.revenue / point.orders : 0),
    },
  ];

  return (
    <>
      <Card
        title="Range"
        description="A custom range overrides the quick range buttons"
        actions={
          <div className="rv-inline">
            <Button size="sm" onClick={state.refresh} disabled={state.loading}>
              Refresh
            </Button>
            {custom ? (
              <Button
                size="sm"
                onClick={() => {
                  onFrom("");
                  onTo("");
                }}
              >
                Use quick range
              </Button>
            ) : null}
            <Button size="sm" variant="primary" onClick={() => window.open(exportUrl, "_blank", "noopener")}>
              Export CSV
            </Button>
          </div>
        }
      >
        <div className="rv-form-grid">
          <Field label="From">
            <TextInput type="date" value={from} onChange={onFrom} />
          </Field>
          <Field label="To">
            <TextInput type="date" value={to} onChange={onTo} />
          </Field>
          <Field label="Group by" hint="Auto follows the quick range">
            <Select
              value={groupBy}
              onChange={(value) => onGroupBy(value as GroupSelection)}
              options={groupOptions}
              placeholder="Auto"
            />
          </Field>
        </div>
      </Card>

      {state.loading && !data ? (
        <Card>
          <Loading label="Loading sales report…" />
        </Card>
      ) : null}

      {state.error ? (
        <Card title="Could not load sales report">
          <p className="rv-error-text">{state.error}</p>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="rv-stat-grid">
            <Stat label="Revenue" value={formatUSD(data.total.revenue)} hint="Paid orders, net of refunds" />
            <Stat label="Orders" value={formatNumber(data.total.orders)} hint={`Grouped by ${data.groupBy}`} />
            <Stat
              label="Average order"
              value={formatUSD(data.total.avgOrderValue)}
              hint={`${formatDate(data.from)} – ${formatDate(data.to)}`}
            />
          </div>

          <Card title="Revenue trend" actions={<Badge tone="green">{data.groupBy}</Badge>}>
            <LineChart data={data.series.map((point) => ({ label: point.label, value: point.revenue }))} />
          </Card>

          <Card title="Orders per period">
            <BarChart
              data={data.series.map((point) => ({ label: point.label, value: point.orders }))}
              formatValue={(value) => formatNumber(value)}
            />
          </Card>

          <Card title="Series" description="Rows behind the charts" flush>
            <DataTable
              columns={columns}
              items={data.series}
              rowKey={(point) => point.label}
              emptyTitle="No sales in this range"
              emptyDescription="Paid orders will appear here once they land."
            />
          </Card>
        </>
      ) : null}
    </>
  );
}

function ProductsTab({ range }: { range: RangeValue }) {
  const state: ApiState<ProductsReport> = useApi<ProductsReport>(apiUrl("/api/admin/reports/products", { range }));
  const exportUrl = apiUrl("/api/admin/reports/export/products.csv", { range });
  const data = state.data;
  const productRanks = new Map((data?.topProducts ?? []).map((product, index) => [product.productId, index + 1]));

  const productColumns: Array<Column<ProductsReport["topProducts"][number]>> = [
    { key: "rank", header: "#", width: "44px", render: (product) => productRanks.get(product.productId) ?? "—" },
    {
      key: "name",
      header: "Product",
      render: (product) => (
        <div className="rv-product-cell">
          <strong>{product.name}</strong>
          <span className="rv-hint rv-mono">{product.sku ?? "—"}</span>
        </div>
      ),
    },
    { key: "quantity", header: "Units", align: "right", render: (product) => formatNumber(product.quantity) },
    { key: "revenue", header: "Revenue", align: "right", render: (product) => formatUSD(product.revenue) },
  ];

  const categoryColumns: Array<Column<ProductsReport["categoryRevenue"][number]>> = [
    { key: "name", header: "Category", render: (category) => category.name },
    { key: "quantity", header: "Units", align: "right", render: (category) => formatNumber(category.quantity) },
    { key: "revenue", header: "Revenue", align: "right", render: (category) => formatUSD(category.revenue) },
  ];

  const originColumns: Array<Column<ProductsReport["originRevenue"][number]>> = [
    { key: "origin", header: "Origin", render: (entry) => entry.origin },
    { key: "quantity", header: "Units", align: "right", render: (entry) => formatNumber(entry.quantity) },
    { key: "revenue", header: "Revenue", align: "right", render: (entry) => formatUSD(entry.revenue) },
  ];

  const stoneColumns: Array<Column<ProductsReport["stoneTypeRevenue"][number]>> = [
    { key: "stoneType", header: "Stone type", render: (entry) => entry.stoneType },
    { key: "quantity", header: "Units", align: "right", render: (entry) => formatNumber(entry.quantity) },
    { key: "revenue", header: "Revenue", align: "right", render: (entry) => formatUSD(entry.revenue) },
  ];

  return (
    <>
      {state.loading && !data ? (
        <Card>
          <Loading label="Loading product report…" />
        </Card>
      ) : null}

      {state.error ? (
        <Card title="Could not load product report">
          <p className="rv-error-text">{state.error}</p>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="rv-stat-grid">
            <Stat label="Sold" value={formatNumber(data.soldVsAvailable.sold)} hint="Products marked sold" />
            <Stat label="Available" value={formatNumber(data.soldVsAvailable.available)} hint="Published products" />
            <Stat label="Reserved" value={formatNumber(data.soldVsAvailable.reserved)} hint="Products on hold" />
          </div>

          <Card
            title="Top products"
            description="Ranked by units sold, top 20"
            flush
            actions={
              <Button size="sm" variant="primary" onClick={() => window.open(exportUrl, "_blank", "noopener")}>
                Export CSV
              </Button>
            }
          >
            <DataTable
              columns={productColumns}
              items={data.topProducts}
              rowKey={(product) => product.productId}
              emptyTitle="No product sales in this range"
              emptyDescription="Paid order items will be aggregated here."
            />
          </Card>

          <div className="rv-split">
            <Card title="Revenue by category">
              <BarChart
                data={data.categoryRevenue.slice(0, 8).map((category) => ({ label: category.name, value: category.revenue }))}
                formatValue={(value) => formatUSD(value, { maximumFractionDigits: 0 })}
              />
            </Card>

            <Card title="Revenue by origin" flush>
              <DataTable
                columns={originColumns}
                items={data.originRevenue}
                rowKey={(entry) => entry.origin}
                emptyTitle="No origin data"
              />
            </Card>
          </div>

          <div className="rv-split">
            <Card title="Category breakdown" flush>
              <DataTable
                columns={categoryColumns}
                items={data.categoryRevenue}
                rowKey={(category) => category.categoryId}
                emptyTitle="No category sales"
              />
            </Card>

            <Card title="Revenue by stone type" flush>
              <DataTable
                columns={stoneColumns}
                items={data.stoneTypeRevenue}
                rowKey={(entry) => entry.stoneType}
                emptyTitle="No stone type data"
              />
            </Card>
          </div>
        </>
      ) : null}
    </>
  );
}

function CustomersTab({ range }: { range: RangeValue }) {
  const state: ApiState<CustomersReport> = useApi<CustomersReport>(apiUrl("/api/admin/reports/customers", { range }));
  const data = state.data;

  const customerColumns: Array<Column<CustomersReport["topCustomers"][number]>> = [
    {
      key: "name",
      header: "Customer",
      render: (customer) => (
        <div className="rv-product-cell">
          <strong>{customer.name}</strong>
          <span className="rv-hint">{customer.email ?? "—"}</span>
        </div>
      ),
    },
    { key: "country", header: "Country", render: (customer) => customer.country ?? "—" },
    { key: "orders", header: "Orders", align: "right", render: (customer) => formatNumber(customer.orderCount) },
    { key: "spent", header: "Total spent", align: "right", render: (customer) => formatUSD(customer.totalSpent) },
  ];

  const countryColumns: Array<Column<CustomersReport["countries"][number]>> = [
    { key: "country", header: "Country", render: (entry) => entry.country },
    { key: "count", header: "Customers", align: "right", render: (entry) => formatNumber(entry.count) },
  ];

  return (
    <>
      {state.loading && !data ? (
        <Card>
          <Loading label="Loading customer report…" />
        </Card>
      ) : null}

      {state.error ? (
        <Card title="Could not load customer report">
          <p className="rv-error-text">{state.error}</p>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="rv-stat-grid">
            <Stat label="New customers" value={formatNumber(data.newVsRepeat.newCustomers)} hint="Signed up in range" />
            <Stat
              label="Repeat customers"
              value={formatNumber(data.newVsRepeat.repeatCustomers)}
              hint="Two or more orders, all time"
            />
            <Stat
              label="Listed countries"
              value={formatNumber(data.countries.length)}
              hint={`${formatDate(data.from)} – ${formatDate(data.to)}`}
            />
          </div>

          <div className="rv-split">
            <Card title="Top customers" description="By total spent in range" flush>
              <DataTable
                columns={customerColumns}
                items={data.topCustomers}
                rowKey={(customer) => customer.customerId}
                emptyTitle="No customer orders in this range"
              />
            </Card>

            <Card title="New vs repeat">
              <BarChart
                data={[
                  { label: "New", value: data.newVsRepeat.newCustomers },
                  { label: "Repeat", value: data.newVsRepeat.repeatCustomers },
                ]}
                formatValue={(value) => formatNumber(value)}
                height={160}
              />
            </Card>
          </div>

          <Card title="Customers by country" description="Top 10 countries, all time" flush>
            <DataTable
              columns={countryColumns}
              items={data.countries}
              rowKey={(entry) => entry.country}
              emptyTitle="No country data yet"
            />
          </Card>
        </>
      ) : null}
    </>
  );
}

function TrafficTab() {
  const state: ApiState<TrafficReport> = useApi<TrafficReport>("/api/admin/reports/traffic");
  const data = state.data;

  return (
    <>
      {state.loading && !data ? (
        <Card>
          <Loading label="Checking analytics integration…" />
        </Card>
      ) : null}

      {state.error ? (
        <Card title="Could not load traffic report">
          <p className="rv-error-text">{state.error}</p>
        </Card>
      ) : null}

      {data ? (
        <Card title="Traffic & analytics">
          <div className="rv-stack">
            <div className="rv-inline">
              <Badge tone={data.integrated ? "green" : "amber"}>{data.integrated ? "Connected" : "Not connected"}</Badge>
              <span className="rv-hint">{data.note}</span>
            </div>
            {data.integrated ? (
              data.series.length ? (
                <BarChart
                  data={data.series.map((point) => ({ label: point.label, value: point.value }))}
                  formatValue={(value) => formatNumber(value)}
                />
              ) : (
                <p className="rv-hint">No traffic data for this period.</p>
              )
            ) : (
              <EmptyState
                title="Traffic analytics are not connected"
                description="No visitor, session or channel data is available yet. Connect Google Analytics (or another provider) before traffic metrics can be reported here."
              />
            )}
          </div>
        </Card>
      ) : null}
    </>
  );
}
