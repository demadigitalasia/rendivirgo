"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, errorMessage, formatDateTime, useApi, type ApiState } from "@/components/admin/api";
import { toast } from "@/components/admin/toast";
import {
  Button,
  Card,
  ConfirmButton,
  Field,
  KeyValue,
  Loading,
  PageHeader,
  Select,
  Switch,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { contentStatusOptions, type ContentPage, type ContentStatus } from "../../types";

type PageForm = {
  title: string;
  slug: string;
  body: string;
  status: ContentStatus;
  showInFooter: boolean;
  sortOrder: string;
  metaTitle: string;
  metaDescription: string;
};

const emptyForm: PageForm = {
  title: "",
  slug: "",
  body: "",
  status: "Published",
  showInFooter: true,
  sortOrder: "0",
  metaTitle: "",
  metaDescription: "",
};

function formFrom(page: ContentPage): PageForm {
  return {
    title: page.title,
    slug: page.slug,
    body: page.body,
    status: page.status,
    showInFooter: page.showInFooter,
    sortOrder: String(page.sortOrder),
    metaTitle: page.metaTitle ?? "",
    metaDescription: page.metaDescription ?? "",
  };
}

export default function PageEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const isNew = id === "new";

  const state: ApiState<ContentPage> = useApi<ContentPage>(isNew ? null : `/api/admin/pages/${id}`);
  const [form, setForm] = useState<PageForm>(emptyForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.data) setForm(formFrom(state.data));
  }, [state.data]);

  const update = <K extends keyof PageForm>(key: K, value: PageForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const title = form.title.trim();
    if (title.length < 2) {
      toast.error("Title must be at least 2 characters");
      return;
    }

    const sortOrder = Number.parseInt(form.sortOrder, 10);

    const payload: Record<string, unknown> = {
      title,
      slug: form.slug.trim() || undefined,
      body: form.body,
      status: form.status,
      showInFooter: form.showInFooter,
      sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
      metaTitle: form.metaTitle.trim() || null,
      metaDescription: form.metaDescription.trim() || null,
    };

    setBusy(true);
    try {
      if (isNew) {
        const page = await apiFetch<ContentPage>("/api/admin/pages", { method: "POST", json: payload });
        toast.success("Page created");
        router.replace(`/admin/content/pages/${page.id}`);
      } else {
        const page = await apiFetch<ContentPage>(`/api/admin/pages/${id}`, { method: "PATCH", json: payload });
        state.setData(page);
        toast.success("Page saved");
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await apiFetch(`/api/admin/pages/${id}`, { method: "DELETE" });
      toast.success("Page deleted");
      router.push("/admin/content/pages");
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New page" : "Edit page"}
        subtitle={isNew ? "Create a static page" : state.data?.title}
        actions={
          <div className="rv-inline">
            <Button href="/admin/content/pages">Back</Button>
            {!isNew && state.data ? (
              <ConfirmButton
                title="Delete this page?"
                description="The page and its content will be permanently removed."
                onConfirm={remove}
              >
                Delete
              </ConfirmButton>
            ) : null}
            <Button variant="primary" loading={busy} disabled={!isNew && !state.data} onClick={save}>
              {isNew ? "Create page" : "Save changes"}
            </Button>
          </div>
        }
      />

      <div className="rv-content">
        {!isNew && state.loading && !state.data ? (
          <Card>
            <Loading label="Loading page…" />
          </Card>
        ) : null}

        {state.error ? (
          <Card title="Could not load page">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        {isNew || state.data ? (
          <>
            <Card title="Page">
              <div className="rv-stack">
                <div className="rv-form-grid">
                  <Field label="Title">
                    <TextInput value={form.title} onChange={(value) => update("title", value)} placeholder="Page title" />
                  </Field>
                  <Field label="Slug" hint="Leave blank to generate from the title">
                    <TextInput value={form.slug} onChange={(value) => update("slug", value)} placeholder="page-slug" />
                  </Field>
                </div>
                <Field label="Body" hint="Plain text or Markdown">
                  <TextArea code rows={18} value={form.body} onChange={(value) => update("body", value)} />
                </Field>
              </div>
            </Card>

            <div className="rv-split">
              <Card title="Settings">
                <div className="rv-stack">
                  <div className="rv-form-grid">
                    <Field label="Status">
                      <Select
                        value={form.status}
                        onChange={(value) => update("status", value as ContentStatus)}
                        options={contentStatusOptions}
                      />
                    </Field>
                    <Field label="Sort order" hint="Lower numbers appear first">
                      <TextInput
                        type="number"
                        min={0}
                        value={form.sortOrder}
                        onChange={(value) => update("sortOrder", value)}
                      />
                    </Field>
                  </div>
                  <Switch
                    checked={form.showInFooter}
                    onChange={(checked) => update("showInFooter", checked)}
                    label="Show in footer"
                  />
                  {!isNew && state.data ? (
                    <KeyValue
                      entries={[
                        { label: "Created", value: formatDateTime(state.data.createdAt) },
                        { label: "Updated", value: formatDateTime(state.data.updatedAt) },
                      ]}
                    />
                  ) : null}
                </div>
              </Card>

              <Card title="SEO">
                <div className="rv-stack">
                  <Field label="Meta title" hint="Defaults to the page title">
                    <TextInput value={form.metaTitle} onChange={(value) => update("metaTitle", value)} />
                  </Field>
                  <Field label="Meta description">
                    <TextArea
                      rows={3}
                      value={form.metaDescription}
                      onChange={(value) => update("metaDescription", value)}
                    />
                  </Field>
                </div>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
