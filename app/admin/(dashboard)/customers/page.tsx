"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl, formatCurrency, formatDate, formatNumber, useList } from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import { Badge, Button, Card, Field, PageHeader, TextInput } from "@/components/admin/ui";
import "./customers.css";

type CustomerRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  tags: string[];
  wholesaleAccess: boolean;
  wholesaleRequestedAt: string | null;
  acceptsMarketing: boolean;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    countryCode: string | null;
  };
  orderCount: number;
  totalSpent: number;
  totalSpentByCurrency: Record<string, number>;
  lastOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminCustomersPage() {
  const state = useList<CustomerRow>("/api/admin/customers");
  const { update } = state;
  const [tag, setTag] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      update({ tag: tag.trim() || undefined, page: 1 });
    }, 350);
    return () => clearTimeout(timer);
  }, [tag, update]);

  const hasFilters = Boolean(state.params.search || state.params.tag);
  const wholesaleRequestedOnly = state.params.wholesaleRequested === "true";
  const hasActiveFilters = hasFilters || wholesaleRequestedOnly;
  const customerCount = state.data?.total ?? 0;

  const exportUrl = apiUrl("/api/admin/customers/export.csv", {
    search: state.params.search,
    tag: state.params.tag,
    wholesaleRequested: state.params.wholesaleRequested,
  });

  const columns: Array<Column<CustomerRow>> = [
    {
      key: "name",
      header: "Name",
      render: (customer) => <Link href={`/admin/customers/${customer.id}`}>{customer.name}</Link>,
    },
    {
      key: "email",
      header: "Email",
      render: (customer) => <a href={`mailto:${customer.email}`}>{customer.email}</a>,
    },
    {
      key: "phone",
      header: "Phone",
      render: (customer) => customer.phone ?? "—",
    },
    {
      key: "wholesale",
      header: "Wholesale",
      render: (customer) => customer.wholesaleAccess
        ? <Badge tone="green">Enabled</Badge>
        : customer.wholesaleRequestedAt
          ? <Badge tone="amber">Under review</Badge>
          : <span className="rv-hint">—</span>,
    },
    {
      key: "country",
      header: "Country",
      render: (customer) => customer.address.country ?? "—",
    },
    {
      key: "orderCount",
      header: "Orders",
      align: "right",
      render: (customer) => formatNumber(customer.orderCount),
    },
    {
      key: "totalSpent",
      header: "Total spent",
      align: "right",
      render: (customer) => (
        <div>
          {formatCurrency(customer.totalSpentByCurrency?.USD ?? customer.totalSpent, "USD")}
          {customer.totalSpentByCurrency?.IDR !== undefined ? <div className="rv-hint">{formatCurrency(customer.totalSpentByCurrency.IDR, "IDR")}</div> : null}
        </div>
      ),
    },
    {
      key: "lastOrderAt",
      header: "Last order",
      render: (customer) => (customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"),
    },
    {
      key: "tags",
      header: "Tags",
      render: (customer) =>
        customer.tags.length ? (
          <div className="rv-inline">
            {customer.tags.map((entry) => (
              <Badge key={entry}>{entry}</Badge>
            ))}
          </div>
        ) : (
          <span className="rv-hint">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (customer) => (
        <Link className="rv-btn rv-btn--sm" href={`/admin/customers/${customer.id}`}>
          View
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Directory, spend and marketing preferences"
        actions={
          <div className="rv-inline">
            <Button size="sm" onClick={() => window.open(exportUrl, "_blank", "noopener")}>
              Export CSV
            </Button>
            <Button size="sm" onClick={state.refresh}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="rv-content rv-customers-content">
        {state.error ? (
          <Card title="Could not load customers">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        <Card
          title="Customer directory"
          description="Search customer details and review purchase activity."
          actions={<Badge tone="green">{formatNumber(customerCount)} {customerCount === 1 ? "customer" : "customers"}</Badge>}
          flush
          className="rv-customers-card"
        >
          <div className="rv-toolbar rv-customers-toolbar">
            <Field label="Search customers">
              <TextInput
                value={state.searchInput}
                onChange={state.setSearchInput}
                placeholder="Name, email or phone"
              />
            </Field>
            <Field label="Filter by tag">
              <TextInput value={tag} onChange={setTag} placeholder="For example: wholesale" />
            </Field>
            <Button
              size="sm"
              variant={wholesaleRequestedOnly ? "primary" : "default"}
              ariaPressed={wholesaleRequestedOnly}
              onClick={() => state.update({ wholesaleRequested: wholesaleRequestedOnly ? undefined : "true", page: 1 })}
            >
              {wholesaleRequestedOnly ? "Wholesale requests only" : "Wholesale requests"}
            </Button>
            {hasActiveFilters ? (
              <Button
                size="sm"
                onClick={() => {
                  setTag("");
                  state.reset();
                }}
              >
                Clear filters
              </Button>
            ) : <span className="rv-customers-toolbar__tip">Search updates as you type</span>}
          </div>
          <div className="rv-customers-scroll-hint" aria-hidden="true">
            Some fields are hidden at this screen width. Open a customer to view phone, country, and tags.
          </div>

          <DataTable
            columns={columns}
            items={state.data?.items ?? []}
            loading={state.loading && !state.data}
            rowKey={(customer) => customer.id}
            emptyTitle="No customers found"
            emptyDescription={hasActiveFilters ? "Try adjusting the filters." : "Customers will appear here after their first order."}
          />

          {state.data ? (
            <TablePagination
              page={state.data.page}
              pageCount={state.data.pageCount}
              total={state.data.total}
              pageSize={state.data.pageSize}
              onPage={state.setPage}
            />
          ) : null}
        </Card>
      </div>
    </>
  );
}
