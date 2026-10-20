"use client";

import Link from "next/link";
import { formatCurrency, formatDate, formatNumber, formatUSD, useList, type PaginatedResponse } from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import { Button, Card, PageHeader, Select, Stat, StatusBadge, TextInput } from "@/components/admin/ui";
import "./orders-page.css";

type OrderRow = {
  id: string;
  orderNumber: string;
  customerId: string | null;
  email: string | null;
  customerName: string;
  phone: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  source: string;
  paymentProofUploadedAt: string | null;
  currency: string;
  subtotal: number;
  shippingCost: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  refundedAmount: number;
  placedAt: string;
  itemCount: number;
};

type OrderSummary = {
  count: number;
  revenue: number;
  revenueByCurrency: Record<string, number>;
  pending: number;
  paid: number;
};

type OrdersResponse = PaginatedResponse<OrderRow> & { summary: OrderSummary };

const orderStatuses = ["New", "Processing", "Packed", "Shipped", "Completed", "Cancelled", "Returned"];

const paymentStatuses = ["Pending", "Paid", "Failed", "Refunded", "PartiallyRefunded"];

const labelize = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2");

const statusOptions = orderStatuses.map((value) => ({ value, label: labelize(value) }));

const paymentOptions = paymentStatuses.map((value) => ({ value, label: labelize(value) }));
const sourceOptions = ["Online", "POS", "Wholesale"].map((value) => ({ value, label: value === "POS" ? "Workshop POS" : value }));

export default function AdminOrdersPage() {
  const state = useList<OrderRow>("/api/admin/orders");
  const data = state.data as OrdersResponse | null;
  const params = state.params;

  const proofQueueActive = params.proofQueue === "true";
  const hasFilters = Boolean(params.search || params.status || params.paymentStatus || params.source || params.from || params.to || proofQueueActive);

  const columns: Array<Column<OrderRow>> = [
    {
      key: "orderNumber",
      header: "Order",
      render: (order) => (
        <div className="rv-order-number-cell">
          <Link className="rv-order-number" href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
          <span className="rv-hint">{formatNumber(order.itemCount)} {order.itemCount === 1 ? "item" : "items"}</span>
        </div>
      ),
    },
    {
      key: "placedAt",
      header: "Date",
      render: (order) => <time className="rv-order-date" dateTime={order.placedAt}>{formatDate(order.placedAt)}</time>,
    },
    {
      key: "customer",
      header: "Customer",
      render: (order) => (
        <div className="rv-order-customer">
          <strong>{order.customerName}</strong>
          <div className="rv-order-customer__meta">
            <span className="rv-hint">{order.email ?? "No email"}</span>
            <span className={`rv-order-source rv-order-source--${order.source.toLowerCase()}`}>
              {order.source === "POS" ? "Workshop POS" : order.source}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (order) => <strong className="rv-order-total">{formatCurrency(order.total, order.currency)}</strong>,
    },
    {
      key: "status",
      header: "Status",
      render: (order) => <StatusBadge status={order.status} />,
    },
    {
      key: "paymentStatus",
      header: "Payment",
      render: (order) => (
        <div>
          <StatusBadge status={order.paymentStatus} />
          {order.paymentMethod === "BankTransfer" && order.paymentProofUploadedAt ? (
            <div className="rv-hint rv-order-receipt-age">
              Receipt {Math.max(0, Math.floor((Date.now() - Date.parse(order.paymentProofUploadedAt)) / 86_400_000))} day(s) ago
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (order) => (
        <Link className="rv-btn rv-btn--sm" href={`/admin/orders/${order.id}`}>
          View
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Track fulfilment, payments and refunds"
        actions={
          <Button size="sm" onClick={state.refresh}>
            Refresh
          </Button>
        }
      />

      <div className="rv-content rv-orders-content">
        {data?.summary ? (
          <div className="rv-stat-grid rv-stat-grid--orders">
            <Stat label="Orders" value={formatNumber(data.summary.count)} hint="Matching current filters" />
            <Stat label="Revenue · USD" value={formatUSD(data.summary.revenueByCurrency?.USD ?? 0)} hint="Paid orders, net of refunds" />
            {data.summary.revenueByCurrency?.IDR !== undefined ? <Stat label="Revenue · IDR" value={formatCurrency(data.summary.revenueByCurrency.IDR, "IDR")} hint="Workshop POS, net of refunds" /> : null}
            <Stat label="Pending payment" value={formatNumber(data.summary.pending)} hint="Awaiting payment" />
            <Stat label="Paid" value={formatNumber(data.summary.paid)} hint="Paid or partially refunded" />
          </div>
        ) : null}

        {state.error ? (
          <Card title="Could not load orders">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        <Card className="rv-card--orders" flush>
          <div className="rv-orders-card-heading">
            <div>
              <span className="rv-orders-card-heading__eyebrow">ORDER MANAGEMENT</span>
              <h2>Order register</h2>
              <p>Search, filter, and review recent customer orders.</p>
            </div>
            {data ? <span className="rv-orders-card-heading__count">{formatNumber(data.total)} orders</span> : null}
          </div>

          <div className="rv-toolbar rv-orders-toolbar">
            <div className="rv-orders-toolbar__main">
              <Button
                className="rv-orders-toolbar__queue-button"
                size="sm"
                variant={proofQueueActive ? "primary" : "default"}
                onClick={() => state.update({ proofQueue: proofQueueActive ? undefined : "true", page: 1 })}
              >
                {proofQueueActive ? "Showing transfer receipts" : "Review transfer receipts"}
              </Button>
              <div className="rv-orders-toolbar__search">
                <label className="rv-sr-only" htmlFor="orders-search">Search orders by number, customer name, or email</label>
                <TextInput
                  id="orders-search"
                  value={state.searchInput}
                  onChange={state.setSearchInput}
                  placeholder="Search order, name or email"
                />
              </div>
            </div>

            <div className="rv-orders-toolbar__filters">
              <div className="rv-orders-toolbar__field">
                <label className="rv-label" htmlFor="orders-status">Status</label>
                <Select
                  id="orders-status"
                  value={String(params.status ?? "")}
                  onChange={(value) => state.update({ status: value || undefined, page: 1 })}
                  options={statusOptions}
                  placeholder="All statuses"
                  ariaLabel="Filter orders by status"
                />
              </div>
              <div className="rv-orders-toolbar__field">
                <label className="rv-label" htmlFor="orders-payment-status">Payment</label>
                <Select
                  id="orders-payment-status"
                  value={String(params.paymentStatus ?? "")}
                  onChange={(value) => state.update({ paymentStatus: value || undefined, page: 1 })}
                  options={paymentOptions}
                  placeholder="All payments"
                  ariaLabel="Filter orders by payment status"
                />
              </div>
              <div className="rv-orders-toolbar__field">
                <label className="rv-label" htmlFor="orders-source">Source</label>
                <Select
                  id="orders-source"
                  value={String(params.source ?? "")}
                  onChange={(value) => state.update({ source: value || undefined, page: 1 })}
                  options={sourceOptions}
                  placeholder="All sources"
                  ariaLabel="Filter orders by source"
                />
              </div>
              <div className="rv-orders-toolbar__date-range" role="group" aria-label="Filter by order date">
                <span className="rv-label">Order date</span>
                <div className="rv-orders-toolbar__dates">
                  <label className="rv-orders-toolbar__field">
                    <span className="rv-hint">From</span>
                    <TextInput
                      type="date"
                      value={String(params.from ?? "")}
                      onChange={(value) => state.update({ from: value || undefined, page: 1 })}
                    />
                  </label>
                  <label className="rv-orders-toolbar__field">
                    <span className="rv-hint">To</span>
                    <TextInput
                      type="date"
                      value={String(params.to ?? "")}
                      onChange={(value) => state.update({ to: value || undefined, page: 1 })}
                    />
                  </label>
                </div>
              </div>
              {hasFilters ? (
                <div className="rv-orders-toolbar__reset">
                  <Button size="sm" onClick={state.reset}>
                    Reset filters
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <DataTable
            columns={columns}
            items={data?.items ?? []}
            loading={state.loading && !data}
            rowKey={(order) => order.id}
            ariaLabel="Orders"
            emptyTitle="No orders found"
            emptyDescription={hasFilters ? "Try adjusting the filters." : "Orders will appear here as customers check out."}
            emptyAction={hasFilters ? <Button size="sm" onClick={state.reset}>Clear filters</Button> : <Button size="sm" href="/admin/products">View products</Button>}
          />

          {data ? (
            <TablePagination
              page={data.page}
              pageCount={data.pageCount}
              total={data.total}
              pageSize={data.pageSize}
              onPage={state.setPage}
            />
          ) : null}
        </Card>
      </div>
    </>
  );
}
