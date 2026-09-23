"use client";

import Link from "next/link";
import { formatDate, formatNumber, formatUSD, useList, type PaginatedResponse } from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import { Button, Card, PageHeader, Select, Stat, StatusBadge, TextInput } from "@/components/admin/ui";

type OrderRow = {
  id: string;
  orderNumber: string;
  customerId: string | null;
  email: string;
  customerName: string;
  phone: string | null;
  status: string;
  paymentStatus: string;
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
  pending: number;
  paid: number;
};

type OrdersResponse = PaginatedResponse<OrderRow> & { summary: OrderSummary };

const orderStatuses = ["New", "Processing", "Packed", "Shipped", "Completed", "Cancelled", "Returned"];

const paymentStatuses = ["Pending", "Paid", "Failed", "Refunded", "PartiallyRefunded"];

const labelize = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2");

const statusOptions = orderStatuses.map((value) => ({ value, label: labelize(value) }));

const paymentOptions = paymentStatuses.map((value) => ({ value, label: labelize(value) }));

export default function AdminOrdersPage() {
  const state = useList<OrderRow>("/api/admin/orders");
  const data = state.data as OrdersResponse | null;
  const params = state.params;

  const hasFilters = Boolean(params.search || params.status || params.paymentStatus || params.from || params.to);

  const columns: Array<Column<OrderRow>> = [
    {
      key: "orderNumber",
      header: "Order",
      render: (order) => <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>,
    },
    {
      key: "placedAt",
      header: "Date",
      render: (order) => formatDate(order.placedAt),
    },
    {
      key: "customer",
      header: "Customer",
      render: (order) => (
        <div>
          <div>{order.customerName}</div>
          <div className="rv-hint">{order.email}</div>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (order) => formatUSD(order.total),
    },
    {
      key: "status",
      header: "Status",
      render: (order) => <StatusBadge status={order.status} />,
    },
    {
      key: "paymentStatus",
      header: "Payment",
      render: (order) => <StatusBadge status={order.paymentStatus} />,
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

      <div className="rv-content">
        {data?.summary ? (
          <div className="rv-stat-grid">
            <Stat label="Orders" value={formatNumber(data.summary.count)} hint="Matching current filters" />
            <Stat label="Revenue" value={formatUSD(data.summary.revenue)} hint="Paid orders, net of refunds" />
            <Stat label="Pending payment" value={formatNumber(data.summary.pending)} hint="Awaiting payment" />
            <Stat label="Paid" value={formatNumber(data.summary.paid)} hint="Paid or partially refunded" />
          </div>
        ) : null}

        {state.error ? (
          <Card title="Could not load orders">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        <Card flush>
          <div className="rv-toolbar">
            <TextInput value={state.searchInput} onChange={state.setSearchInput} placeholder="Search order, name or email" />
            <Select
              value={String(params.status ?? "")}
              onChange={(value) => state.update({ status: value || undefined, page: 1 })}
              options={statusOptions}
              placeholder="All statuses"
            />
            <Select
              value={String(params.paymentStatus ?? "")}
              onChange={(value) => state.update({ paymentStatus: value || undefined, page: 1 })}
              options={paymentOptions}
              placeholder="All payments"
            />
            <div className="rv-inline">
              <span className="rv-hint">From</span>
              <TextInput
                type="date"
                value={String(params.from ?? "")}
                onChange={(value) => state.update({ from: value || undefined, page: 1 })}
              />
            </div>
            <div className="rv-inline">
              <span className="rv-hint">To</span>
              <TextInput
                type="date"
                value={String(params.to ?? "")}
                onChange={(value) => state.update({ to: value || undefined, page: 1 })}
              />
            </div>
            {hasFilters ? (
              <Button size="sm" onClick={state.reset}>
                Reset
              </Button>
            ) : null}
          </div>

          <DataTable
            columns={columns}
            items={data?.items ?? []}
            loading={state.loading && !data}
            rowKey={(order) => order.id}
            emptyTitle="No orders found"
            emptyDescription={hasFilters ? "Try adjusting the filters." : "Orders will appear here as customers check out."}
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
