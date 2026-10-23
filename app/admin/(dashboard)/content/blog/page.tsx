"use client";

import { SeoBadge } from "@/components/admin/seo-panel";
import { contentSeoInput } from "@/lib/seo-analysis";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, errorMessage, formatDateTime, formatNumber, useList } from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import { toast } from "@/components/admin/toast";
import { Badge, Button, Card, ConfirmButton, Field, PageHeader, Select, StatusBadge, TextInput } from "@/components/admin/ui";
import { contentStatusOptions, type BlogPost } from "../types";
import "../blog.css";

export default function BlogListPage() {
  const router = useRouter();
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

  const hasFilters = Boolean(String(list.params.search ?? list.searchInput).trim() || list.params.status);
  const clearFilters = () => list.reset();

  const columns: Array<Column<BlogPost>> = [
    {
      key: "title",
      header: "Post",
      render: (post) => (
        <div className="rv-blog-post-cell">
          <Link className="rv-blog-post-cell__title" href={`/admin/content/blog/${post.id}`}>{post.title}</Link>
          <div className="rv-blog-post-cell__slug">/{post.slug}</div>
        </div>
      ),
    },
    {
      key: "seo",
      header: "SEO Score · EN",
      width: "144px",
      render: (post) => (
        <SeoBadge
          variant="table"
          input={contentSeoInput(post, "blog")}
          onClick={() => router.push(`/admin/content/blog/${post.id}`)}
        />
      ),
    },
    {
      key: "tags",
      header: "Tags",
      render: (post) =>
        post.tags.length ? (
          <div className="rv-inline">
            {post.tags.slice(0, 3).map((tag, index) => (
              <Badge key={`${tag}-${index}`} tone="bronze">
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
      render: (post) =>
        post.publishedAt ? (
          <time className="rv-blog-published" dateTime={post.publishedAt}>{formatDateTime(post.publishedAt)}</time>
        ) : (
          <span className="rv-hint">Not published</span>
        ),
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
        <div className="rv-inline rv-blog-row-actions">
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

      <div className="rv-content rv-blog-list-content">
        <Card
          flush
          className="rv-blog-list-card"
          title="Article library"
          description="Manage publication status, tags, and readership for your studio stories."
          actions={list.data ? <Badge tone="green">{formatNumber(list.data.total)} posts</Badge> : null}
        >
          <div className="rv-toolbar rv-blog-list-toolbar">
            <Field className="rv-blog-list-toolbar__search" label="Search articles" hint="Search by title or slug">
              <TextInput value={list.searchInput} onChange={list.setSearchInput} placeholder="Try “cabochon” or a URL slug" />
            </Field>
            <Field className="rv-blog-list-toolbar__status" label="Publication status">
              <Select
                value={String(list.params.status ?? "")}
                onChange={(value) => list.update({ status: value || undefined, page: 1 })}
                options={contentStatusOptions}
                placeholder="All statuses"
              />
            </Field>
            {hasFilters ? <Button className="rv-blog-list-toolbar__reset" onClick={clearFilters}>Clear filters</Button> : null}
          </div>

          {list.error ? (
            <div className="rv-blog-list-error">
              <p className="rv-error-text">{list.error}</p>
            </div>
          ) : null}

          <div className="rv-blog-list-table">
            <DataTable
              columns={columns}
              items={list.data?.items ?? []}
              loading={list.loading && !list.data}
              rowKey={(post) => post.id}
              emptyTitle={hasFilters ? "No matching articles" : "No articles yet"}
              emptyDescription={hasFilters ? "Try another search or clear the filters to see all articles." : "Write your first article to share it with customers."}
              emptyAction={
                hasFilters ? (
                  <Button onClick={clearFilters}>Clear filters</Button>
                ) : (
                  <Button variant="primary" href="/admin/content/blog/new">New post</Button>
                )
              }
              ariaLabel="Blog articles"
            />
          </div>

          {list.data?.items.length ? <p className="rv-blog-list-scroll-hint">Scroll horizontally to see every column.</p> : null}

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
