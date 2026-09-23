"use client";

import Link from "next/link";
import { apiFetch, errorMessage, formatDateTime, formatNumber, useList } from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import { toast } from "@/components/admin/toast";
import { Badge, Button, Card, ConfirmButton, PageHeader, Select, StatusBadge, TextInput } from "@/components/admin/ui";
import { contentStatusOptions, type ContentPage } from "../types";

export default function PagesListPage() {
  const list = useList<ContentPage>("/api/admin/pages", { pageSize: 20 });

  const remove = async (page: ContentPage) => {
    try {
      await apiFetch(`/api/admin/pages/${page.id}`, { method: "DELETE" });
      toast.success("Page deleted");
      list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  };

  const columns: Array<Column<ContentPage>> = [
    {
      key: "title",
      header: "Page",
      render: (page) => (
        <div>
          <Link href={`/admin/content/pages/${page.id}`}>{page.title}</Link>
          <div className="rv-hint">/{page.slug}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (page) => <StatusBadge status={page.status} />,
    },
    {
      key: "footer",
      header: "Footer",
      render: (page) =>
        page.showInFooter ? <Badge tone="green">In footer</Badge> : <Badge tone="gray">Hidden</Badge>,
    },
    {
      key: "sortOrder",
      header: "Order",
      align: "right",
      render: (page) => formatNumber(page.sortOrder),
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (page) => <span className="rv-hint">{formatDateTime(page.updatedAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "170px",
      render: (page) => (
        <div className="rv-inline" style={{ justifyContent: "flex-end" }}>
          <Button size="sm" href={`/admin/content/pages/${page.id}`}>
            Edit
          </Button>
          <ConfirmButton
            size="sm"
            title="Delete this page?"
            description="The page and its content will be permanently removed."
            onConfirm={() => remove(page)}
          >
            Delete
          </ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Pages"
        subtitle="Static pages such as about, care and policies"
        actions={
          <Button variant="primary" href="/admin/content/pages/new">
            New page
          </Button>
        }
      />

      <div className="rv-content">
        <Card flush>
          <div className="rv-toolbar">
            <TextInput value={list.searchInput} onChange={list.setSearchInput} placeholder="Search pages…" />
            <Select
              value={String(list.params.status ?? "")}
              onChange={(value) => list.update({ status: value || undefined, page: 1 })}
              options={contentStatusOptions}
              placeholder="All statuses"
            />
          </div>

          {list.error ? (
            <div style={{ padding: "0 18px 14px" }}>
              <p className="rv-error-text">{list.error}</p>
            </div>
          ) : null}

          <DataTable
            columns={columns}
            items={list.data?.items ?? []}
            loading={list.loading && !list.data}
            rowKey={(page) => page.id}
            emptyTitle="No pages yet"
            emptyDescription="Create pages for about, care instructions or policies."
            emptyAction={
              <Button variant="primary" href="/admin/content/pages/new">
                New page
              </Button>
            }
          />

          {list.data ? (
            <TablePagination
              page={list.data.page}
              pageCount={list.data.pageCount}
              total={list.data.total}
              pageSize={list.data.pageSize}
              onPage={list.setPage}
            />
          ) : null}
        </Card>
      </div>
    </>
  );
}
