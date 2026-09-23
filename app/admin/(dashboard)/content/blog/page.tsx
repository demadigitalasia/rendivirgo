"use client";

import Link from "next/link";
import { apiFetch, errorMessage, formatDateTime, formatNumber, useList } from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import { toast } from "@/components/admin/toast";
import { Badge, Button, Card, ConfirmButton, PageHeader, Select, StatusBadge, TextInput } from "@/components/admin/ui";
import { contentStatusOptions, type BlogPost } from "../types";

export default function BlogListPage() {
  const list = useList<BlogPost>("/api/admin/blog", { pageSize: 20 });

  const remove = async (post: BlogPost) => {
    try {
      await apiFetch(`/api/admin/blog/${post.id}`, { method: "DELETE" });
      toast.success("Post deleted");
      list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  };

  const columns: Array<Column<BlogPost>> = [
    {
      key: "title",
      header: "Post",
      render: (post) => (
        <div>
          <Link href={`/admin/content/blog/${post.id}`}>{post.title}</Link>
          <div className="rv-hint">/{post.slug}</div>
        </div>
      ),
    },
    {
      key: "tags",
      header: "Tags",
      render: (post) =>
        post.tags.length ? (
          <div className="rv-inline">
            {post.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} tone="bronze">
                {tag}
              </Badge>
            ))}
            {post.tags.length > 3 ? <Badge tone="gray">+{post.tags.length - 3}</Badge> : null}
          </div>
        ) : (
          <span className="rv-hint">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (post) => <StatusBadge status={post.status} />,
    },
    {
      key: "publishedAt",
      header: "Published",
      render: (post) => (post.publishedAt ? <span>{formatDateTime(post.publishedAt)}</span> : <span className="rv-hint">—</span>),
    },
    {
      key: "views",
      header: "Views",
      align: "right",
      render: (post) => formatNumber(post.views),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "170px",
      render: (post) => (
        <div className="rv-inline" style={{ justifyContent: "flex-end" }}>
          <Button size="sm" href={`/admin/content/blog/${post.id}`}>
            Edit
          </Button>
          <ConfirmButton
            size="sm"
            title="Delete this post?"
            description="The post and its content will be permanently removed."
            onConfirm={() => remove(post)}
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
        title="Blog"
        subtitle="Articles, stories and studio notes"
        actions={
          <Button variant="primary" href="/admin/content/blog/new">
            New post
          </Button>
        }
      />

      <div className="rv-content">
        <Card flush>
          <div className="rv-toolbar">
            <TextInput value={list.searchInput} onChange={list.setSearchInput} placeholder="Search posts…" />
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
            rowKey={(post) => post.id}
            emptyTitle="No posts yet"
            emptyDescription="Write your first article to share it with customers."
            emptyAction={
              <Button variant="primary" href="/admin/content/blog/new">
                New post
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
