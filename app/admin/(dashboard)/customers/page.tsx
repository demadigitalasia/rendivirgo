"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl, formatDate, formatNumber, formatUSD, useList } from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import { Badge, Button, Card, PageHeader, TextInput } from "@/components/admin/ui";

type CustomerRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  tags: string[];
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

  const exportUrl = apiUrl("/api/admin/customers/export.csv", {
    search: state.params.search,
    tag: state.params.tag,
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
      render: (customer) => formatUSD(customer.totalSpent),
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

      <div className="rv-content">
        {state.error ? (
          <Card title="Could not load customers">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        <Card flush>
          <div className="rv-toolbar">
            <TextInput
              value={state.searchInput}
              onChange={state.setSearchInput}
              placeholder="Search name, email or phone"
            />
            <TextInput value={tag} onChange={setTag} placeholder="Filter by tag" />
            {hasFilters ? (
              <Button
                size="sm"
                onClick={() => {
                  setTag("");
                  state.reset();
                }}
              >
                Reset
              </Button>
            ) : null}
          </div>

          <DataTable
            columns={columns}
            items={state.data?.items ?? []}
            loading={state.loading && !state.data}
            rowKey={(customer) => customer.id}
            emptyTitle="No customers found"
            emptyDescription={hasFilters ? "Try adjusting the filters." : "Customers will appear here after their first order."}
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
