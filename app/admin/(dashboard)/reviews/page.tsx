"use client";

import { apiFetch, errorMessage, formatDate, useList } from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import { toast } from "@/components/admin/toast";
import { Badge, Button, Card, ConfirmButton, PageHeader, Select, TextInput } from "@/components/admin/ui";

type ReviewRow = {
  id: string;
  product: { id: string; name: string; slug: string };
  name: string;
  email: string;
  rating: number;
  title: string | null;
  body: string;
  status: "Pending" | "Published" | "Rejected";
  verifiedPurchase: boolean;
  createdAt: string;
};

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Published", label: "Published" },
  { value: "Rejected", label: "Rejected" },
];

const statusTone = (status: ReviewRow["status"]) => {
  if (status === "Published") return "green" as const;
  if (status === "Rejected") return "red" as const;
  return "amber" as const;
};

export default function AdminReviewsPage() {
  const state = useList<ReviewRow>("/api/admin/reviews", { status: "Pending" });
  const status = String(state.params.status ?? "");

  const setStatus = (next: string) => {
    state.update({ status: next || undefined, page: 1 });
  };

  const moderate = async (review: ReviewRow, nextStatus: "Published" | "Rejected", message: string) => {
    try {
      await apiFetch(`/api/admin/reviews/${review.id}`, { method: "PATCH", json: { status: nextStatus } });
      toast.success(message);
      state.refresh();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const remove = async (review: ReviewRow) => {
    try {
      await apiFetch(`/api/admin/reviews/${review.id}`, { method: "DELETE" });
      toast.success("Review deleted");
      state.refresh();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const columns: Array<Column<ReviewRow>> = [
    {
      key: "product",
      header: "Product",
      render: (review) => <span>{review.product.name}</span>,
    },
    {
      key: "review",
      header: "Review",
      render: (review) => (
        <div className="rv-stack" style={{ gap: 4 }}>
          <span>
            {"★".repeat(review.rating)}
            {"☆".repeat(5 - review.rating)} <strong>{review.title ?? "(no headline)"}</strong>
          </span>
          <span className="rv-hint">{review.body.length > 140 ? `${review.body.slice(0, 140)}…` : review.body}</span>
          <span className="rv-hint">
            {review.name} · {review.email}
            {review.verifiedPurchase ? " · verified purchase" : ""}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (review) => <Badge tone={statusTone(review.status)}>{review.status}</Badge>,
    },
    {
      key: "createdAt",
      header: "Submitted",
      render: (review) => formatDate(review.createdAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (review) => (
        <div className="rv-inline">
          {review.status !== "Published" ? (
            <Button size="sm" onClick={() => void moderate(review, "Published", "Review published")}>
              Approve
            </Button>
          ) : null}
          {review.status !== "Rejected" ? (
            <Button size="sm" onClick={() => void moderate(review, "Rejected", "Review rejected")}>
              Reject
            </Button>
          ) : null}
          <ConfirmButton
            size="sm"
            confirmLabel="Delete review"
            title="Delete this review?"
            description="The review will be permanently removed."
            onConfirm={() => remove(review)}
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
        title="Reviews"
        subtitle="Moderate customer reviews before they appear on product pages"
        actions={
          <Button size="sm" onClick={state.refresh}>
            Refresh
          </Button>
        }
      />

      <div className="rv-content">
        {state.error ? (
          <Card title="Could not load reviews">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        <Card flush>
          <div className="rv-toolbar">
            <TextInput value={state.searchInput} onChange={state.setSearchInput} placeholder="Search product, name, email or text" />
            <Select value={status} onChange={setStatus} options={statusOptions} />
          </div>

          <DataTable
            columns={columns}
            items={state.data?.items ?? []}
            loading={state.loading && !state.data}
            rowKey={(review) => review.id}
            emptyTitle="No reviews found"
            emptyDescription={status === "Pending" ? "Nothing waiting for moderation." : "Try a different filter."}
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
