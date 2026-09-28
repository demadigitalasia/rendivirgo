"use client";

import { apiUrl, formatDate, useList } from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import { Badge, Button, Card, PageHeader } from "@/components/admin/ui";

type SubscriberRow = {
  id: string;
  email: string;
  locale: string | null;
  source: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function AdminNewsletterPage() {
  const state = useList<SubscriberRow>("/api/admin/newsletter");
  const hasFilters = Boolean(state.params.search);

  const exportUrl = apiUrl("/api/admin/newsletter/export.csv", {
    search: state.params.search,
  });

  const columns: Array<Column<SubscriberRow>> = [
    {
      key: "email",
      header: "Email",
      render: (subscriber) => <a href={`mailto:${subscriber.email}`}>{subscriber.email}</a>,
    },
    {
      key: "locale",
      header: "Language",
      render: (subscriber) => (subscriber.locale ? subscriber.locale.toUpperCase() : "—"),
    },
    {
      key: "source",
      header: "Source",
      render: (subscriber) => subscriber.source ?? "—",
    },
    {
      key: "isActive",
      header: "Status",
      render: (subscriber) => (
        <Badge tone={subscriber.isActive ? "green" : "default"}>
          {subscriber.isActive ? "Subscribed" : "Unsubscribed"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Subscribed",
      render: (subscriber) => formatDate(subscriber.createdAt),
    },
  ];

  return (
    <>
      <PageHeader
        title="Newsletter"
        subtitle="Footer signups and export for your mailing tool"
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
          <Card title="Could not load subscribers">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        <Card flush>
          <DataTable
            columns={columns}
            items={state.data?.items ?? []}
            loading={state.loading && !state.data}
            rowKey={(subscriber) => subscriber.id}
            emptyTitle="No subscribers yet"
            emptyDescription={hasFilters ? "Try a different search." : "Signups from the storefront footer will appear here."}
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
