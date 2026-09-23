"use client";

import { useState } from "react";
import { apiFetch, errorMessage, formatNumber, useList } from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import { toast } from "@/components/admin/toast";
import {
  Button,
  Card,
  ConfirmButton,
  Field,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Switch,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { truncate, type Testimonial } from "../types";
import "../content.css";

type TestimonialForm = {
  customerName: string;
  location: string;
  quote: string;
  rating: string;
  isPublished: boolean;
  sortOrder: string;
};

const emptyForm: TestimonialForm = {
  customerName: "",
  location: "",
  quote: "",
  rating: "5",
  isPublished: true,
  sortOrder: "0",
};

const ratingOptions = [1, 2, 3, 4, 5].map((value) => ({
  value: String(value),
  label: `${value} star${value > 1 ? "s" : ""}`,
}));

export default function TestimonialsPage() {
  const list = useList<Testimonial>("/api/admin/testimonials", { pageSize: 20 });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TestimonialForm>(emptyForm);
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof TestimonialForm>(key: K, value: TestimonialForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (item: Testimonial) => {
    setEditingId(item.id);
    setForm({
      customerName: item.customerName,
      location: item.location ?? "",
      quote: item.quote,
      rating: String(item.rating),
      isPublished: item.isPublished,
      sortOrder: String(item.sortOrder),
    });
    setOpen(true);
  };

  const save = async () => {
    if (form.customerName.trim().length < 2) {
      toast.error("Customer name must be at least 2 characters");
      return;
    }
    if (form.quote.trim().length < 2) {
      toast.error("Quote must be at least 2 characters");
      return;
    }

    const sortOrder = Number.parseInt(form.sortOrder, 10);
    const payload = {
      customerName: form.customerName.trim(),
      location: form.location.trim() || null,
      quote: form.quote,
      rating: Number(form.rating),
      isPublished: form.isPublished,
      sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
    };

    setBusy(true);
    try {
      if (editingId) {
        await apiFetch(`/api/admin/testimonials/${editingId}`, { method: "PATCH", json: payload });
        toast.success("Testimonial saved");
      } else {
        await apiFetch("/api/admin/testimonials", { method: "POST", json: payload });
        toast.success("Testimonial created");
      }
      setOpen(false);
      list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: Testimonial) => {
    try {
      await apiFetch(`/api/admin/testimonials/${item.id}`, { method: "DELETE" });
      toast.success("Testimonial deleted");
      list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  };

  const columns: Array<Column<Testimonial>> = [
    {
      key: "customer",
      header: "Customer",
      render: (item) => (
        <div>
          <strong>{item.customerName}</strong>
          {item.location ? <div className="rv-hint">{item.location}</div> : null}
        </div>
      ),
    },
    {
      key: "quote",
      header: "Quote",
      render: (item) => <span className="rv-hint">{truncate(item.quote, 90)}</span>,
    },
    {
      key: "rating",
      header: "Rating",
      render: (item) => (
        <span className="rv-rating">
          {"★".repeat(item.rating)}
          {"☆".repeat(Math.max(0, 5 - item.rating))}
        </span>
      ),
    },
    {
      key: "published",
      header: "Published",
      render: (item) => <StatusBadge status={item.isPublished ? "Published" : "Draft"} />,
    },
    {
      key: "sortOrder",
      header: "Order",
      align: "right",
      render: (item) => formatNumber(item.sortOrder),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "170px",
      render: (item) => (
        <div className="rv-inline" style={{ justifyContent: "flex-end" }}>
          <Button size="sm" onClick={() => openEdit(item)}>
            Edit
          </Button>
          <ConfirmButton
            size="sm"
            title="Delete this testimonial?"
            description="The testimonial will be permanently removed."
            onConfirm={() => remove(item)}
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
        title="Testimonials"
        subtitle="Customer quotes shown across the storefront"
        actions={
          <Button variant="primary" onClick={openCreate}>
            New testimonial
          </Button>
        }
      />

      <div className="rv-content">
        <Card flush>
          <div className="rv-toolbar">
            <TextInput value={list.searchInput} onChange={list.setSearchInput} placeholder="Search testimonials…" />
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
            rowKey={(item) => item.id}
            emptyTitle="No testimonials yet"
            emptyDescription="Collect kind words from customers and publish them here."
            emptyAction={
              <Button variant="primary" onClick={openCreate}>
                New testimonial
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

      <Modal
        open={open}
        title={editingId ? "Edit testimonial" : "New testimonial"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={save}>
              {editingId ? "Save changes" : "Create"}
            </Button>
          </>
        }
      >
        <div className="rv-stack">
          <div className="rv-form-grid">
            <Field label="Customer name">
              <TextInput value={form.customerName} onChange={(value) => update("customerName", value)} />
            </Field>
            <Field label="Location">
              <TextInput value={form.location} onChange={(value) => update("location", value)} placeholder="City, country" />
            </Field>
          </div>
          <Field label="Quote">
            <TextArea rows={5} value={form.quote} onChange={(value) => update("quote", value)} />
          </Field>
          <div className="rv-form-grid">
            <Field label="Rating">
              <Select value={form.rating} onChange={(value) => update("rating", value)} options={ratingOptions} />
            </Field>
            <Field label="Sort order" hint="Lower numbers appear first">
              <TextInput type="number" min={0} value={form.sortOrder} onChange={(value) => update("sortOrder", value)} />
            </Field>
          </div>
          <Switch checked={form.isPublished} onChange={(checked) => update("isPublished", checked)} label="Published" />
        </div>
      </Modal>
    </>
  );
}
