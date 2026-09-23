"use client";

import { useState } from "react";
import { apiFetch, errorMessage, formatNumber, useList } from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import { MediaPicker } from "@/components/admin/media";
import { toast } from "@/components/admin/toast";
import {
  Badge,
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
import {
  bannerPlacementOptions,
  bannerPlacementTones,
  truncate,
  type Banner,
  type BannerPlacement,
} from "../types";

type BannerForm = {
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  placement: BannerPlacement;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm: BannerForm = {
  title: "",
  subtitle: "",
  imageUrl: "",
  ctaLabel: "",
  ctaHref: "",
  placement: "HomeHero",
  sortOrder: "0",
  isActive: true,
};

export default function BannersPage() {
  const list = useList<Banner>("/api/admin/banners", { pageSize: 20 });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof BannerForm>(key: K, value: BannerForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (item: Banner) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      subtitle: item.subtitle ?? "",
      imageUrl: item.imageUrl ?? "",
      ctaLabel: item.ctaLabel ?? "",
      ctaHref: item.ctaHref ?? "",
      placement: item.placement,
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
    });
    setOpen(true);
  };

  const save = async () => {
    if (form.title.trim().length < 2) {
      toast.error("Title must be at least 2 characters");
      return;
    }

    const sortOrder = Number.parseInt(form.sortOrder, 10);
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      imageUrl: form.imageUrl || null,
      ctaLabel: form.ctaLabel.trim() || null,
      ctaHref: form.ctaHref.trim() || null,
      placement: form.placement,
      sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
      isActive: form.isActive,
    };

    setBusy(true);
    try {
      if (editingId) {
        await apiFetch(`/api/admin/banners/${editingId}`, { method: "PATCH", json: payload });
        toast.success("Banner saved");
      } else {
        await apiFetch("/api/admin/banners", { method: "POST", json: payload });
        toast.success("Banner created");
      }
      setOpen(false);
      list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: Banner) => {
    try {
      await apiFetch(`/api/admin/banners/${item.id}`, { method: "DELETE" });
      toast.success("Banner deleted");
      list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  };

  const columns: Array<Column<Banner>> = [
    {
      key: "image",
      header: "Image",
      width: "72px",
      render: (item) =>
        item.imageUrl ? (
          <img className="rv-table__thumb" src={item.imageUrl} alt="" />
        ) : (
          <span className="rv-hint">—</span>
        ),
    },
    {
      key: "title",
      header: "Banner",
      render: (item) => (
        <div>
          <strong>{item.title}</strong>
          {item.subtitle ? <div className="rv-hint">{truncate(item.subtitle, 80)}</div> : null}
        </div>
      ),
    },
    {
      key: "placement",
      header: "Placement",
      render: (item) => <Badge tone={bannerPlacementTones[item.placement]}>{item.placement}</Badge>,
    },
    {
      key: "active",
      header: "Active",
      render: (item) => <StatusBadge status={item.isActive ? "Published" : "Draft"} />,
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
            title="Delete this banner?"
            description="The banner will be permanently removed."
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
        title="Banners"
        subtitle="Hero and promotional imagery"
        actions={
          <Button variant="primary" onClick={openCreate}>
            New banner
          </Button>
        }
      />

      <div className="rv-content">
        <Card flush>
          <div className="rv-toolbar">
            <TextInput value={list.searchInput} onChange={list.setSearchInput} placeholder="Search banners…" />
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
            emptyTitle="No banners yet"
            emptyDescription="Add hero or promo artwork for the storefront."
            emptyAction={
              <Button variant="primary" onClick={openCreate}>
                New banner
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
        title={editingId ? "Edit banner" : "New banner"}
        onClose={() => setOpen(false)}
        wide
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
            <Field label="Title">
              <TextInput value={form.title} onChange={(value) => update("title", value)} />
            </Field>
            <Field label="Placement">
              <Select
                value={form.placement}
                onChange={(value) => update("placement", value as BannerPlacement)}
                options={bannerPlacementOptions}
              />
            </Field>
          </div>
          <Field label="Subtitle">
            <TextArea rows={2} value={form.subtitle} onChange={(value) => update("subtitle", value)} />
          </Field>
          <MediaPicker
            label="Image"
            folder="banners"
            multiple={false}
            value={form.imageUrl ? [form.imageUrl] : []}
            onChange={(urls) => update("imageUrl", urls[0] ?? "")}
          />
          <div className="rv-form-grid">
            <Field label="CTA label">
              <TextInput value={form.ctaLabel} onChange={(value) => update("ctaLabel", value)} placeholder="Shop now" />
            </Field>
            <Field label="CTA link">
              <TextInput value={form.ctaHref} onChange={(value) => update("ctaHref", value)} placeholder="/shop" />
            </Field>
          </div>
          <div className="rv-form-grid">
            <Field label="Sort order" hint="Lower numbers appear first">
              <TextInput type="number" min={0} value={form.sortOrder} onChange={(value) => update("sortOrder", value)} />
            </Field>
            <div className="rv-field">
              <span className="rv-label">Visibility</span>
              <Switch checked={form.isActive} onChange={(checked) => update("isActive", checked)} label="Active" />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
