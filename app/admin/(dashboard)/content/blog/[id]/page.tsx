"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  apiFetch,
  errorMessage,
  formatDateTime,
  formatNumber,
  toDateTimeInputValue,
  useApi,
  type ApiState,
} from "@/components/admin/api";
import { MediaPicker } from "@/components/admin/media";
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
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { contentStatusOptions, parseTags, type BlogPost, type ContentStatus } from "../../types";

type BlogForm = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  tags: string;
  status: ContentStatus;
  author: string;
  readMinutes: string;
  publishedAt: string;
  metaTitle: string;
  metaDescription: string;
  coverImage: string;
};

const emptyForm: BlogForm = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  tags: "",
  status: "Draft",
  author: "RENDI VIRGO",
  readMinutes: "5",
  publishedAt: "",
  metaTitle: "",
  metaDescription: "",
  coverImage: "",
};

function formFrom(post: BlogPost): BlogForm {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    tags: post.tags.join(", "),
    status: post.status,
    author: post.author,
    readMinutes: String(post.readMinutes),
    publishedAt: toDateTimeInputValue(post.publishedAt),
    metaTitle: post.metaTitle ?? "",
    metaDescription: post.metaDescription ?? "",
    coverImage: post.coverImage ?? "",
  };
}

export default function BlogEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const isNew = id === "new";

  const state: ApiState<BlogPost> = useApi<BlogPost>(isNew ? null : `/api/admin/blog/${id}`);
  const [form, setForm] = useState<BlogForm>(emptyForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.data) setForm(formFrom(state.data));
  }, [state.data]);

  const update = <K extends keyof BlogForm>(key: K, value: BlogForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const title = form.title.trim();
    if (title.length < 2) {
      toast.error("Title must be at least 2 characters");
      return;
    }

    const readMinutes = Number.parseInt(form.readMinutes, 10);
    if (form.readMinutes.trim() !== "" && (!Number.isInteger(readMinutes) || readMinutes < 1 || readMinutes > 240)) {
      toast.error("Read minutes must be between 1 and 240");
      return;
    }

    const payload: Record<string, unknown> = {
      title,
      slug: form.slug.trim() || undefined,
      excerpt: form.excerpt,
      body: form.body,
      coverImage: form.coverImage || null,
      tags: parseTags(form.tags),
      status: form.status,
      author: form.author.trim() || "RENDI VIRGO",
      metaTitle: form.metaTitle.trim() || null,
      metaDescription: form.metaDescription.trim() || null,
    };
    if (Number.isInteger(readMinutes)) payload.readMinutes = readMinutes;
    if (form.publishedAt) payload.publishedAt = new Date(form.publishedAt).toISOString();

    setBusy(true);
    try {
      if (isNew) {
        const post = await apiFetch<BlogPost>("/api/admin/blog", { method: "POST", json: payload });
        toast.success("Post created");
        router.replace(`/admin/content/blog/${post.id}`);
      } else {
        const post = await apiFetch<BlogPost>(`/api/admin/blog/${id}`, { method: "PATCH", json: payload });
        state.setData(post);
        toast.success("Post saved");
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await apiFetch(`/api/admin/blog/${id}`, { method: "DELETE" });
      toast.success("Post deleted");
      router.push("/admin/content/blog");
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New post" : "Edit post"}
        subtitle={isNew ? "Draft a new blog article" : state.data?.title}
        actions={
          <div className="rv-inline">
            <Button href="/admin/content/blog">Back</Button>
            {!isNew && state.data ? (
              <ConfirmButton
                title="Delete this post?"
                description="The post and its content will be permanently removed."
                onConfirm={remove}
              >
                Delete
              </ConfirmButton>
            ) : null}
            <Button variant="primary" loading={busy} disabled={!isNew && !state.data} onClick={save}>
              {isNew ? "Create post" : "Save changes"}
            </Button>
          </div>
        }
      />

      <div className="rv-content">
        {!isNew && state.loading && !state.data ? (
          <Card>
            <Loading label="Loading post…" />
          </Card>
        ) : null}

        {state.error ? (
          <Card title="Could not load post">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        {isNew || state.data ? (
          <>
            <Card title="Article">
              <div className="rv-stack">
                <Field label="Title">
                  <TextInput value={form.title} onChange={(value) => update("title", value)} placeholder="Post title" />
                </Field>
                <div className="rv-form-grid">
                  <Field label="Slug" hint="Leave blank to generate from the title">
                    <TextInput value={form.slug} onChange={(value) => update("slug", value)} placeholder="post-slug" />
                  </Field>
                  <Field label="Tags" hint="Comma separated">
                    <TextInput value={form.tags} onChange={(value) => update("tags", value)} placeholder="stones, guide" />
                  </Field>
                </div>
                <Field label="Excerpt" hint="Shown in listings and search results">
                  <TextArea rows={3} value={form.excerpt} onChange={(value) => update("excerpt", value)} />
                </Field>
                <Field label="Body" hint="Plain text or Markdown">
                  <TextArea code rows={18} value={form.body} onChange={(value) => update("body", value)} />
                </Field>
              </div>
            </Card>

            <div className="rv-split">
              <Card title="Publishing">
                <div className="rv-stack">
                  <div className="rv-form-grid">
                    <Field label="Status">
                      <Select
                        value={form.status}
                        onChange={(value) => update("status", value as ContentStatus)}
                        options={contentStatusOptions}
                      />
                    </Field>
                    <Field label="Author">
                      <TextInput value={form.author} onChange={(value) => update("author", value)} />
                    </Field>
                  </div>
                  <div className="rv-form-grid">
                    <Field label="Read minutes">
                      <TextInput
                        type="number"
                        min={1}
                        max={240}
                        value={form.readMinutes}
                        onChange={(value) => update("readMinutes", value)}
                      />
                    </Field>
                    <Field label="Published at" hint="Leave blank to keep the current schedule">
                      <TextInput
                        type="datetime-local"
                        value={form.publishedAt}
                        onChange={(value) => update("publishedAt", value)}
                      />
                    </Field>
                  </div>
                  {!isNew && state.data ? (
                    <KeyValue
                      entries={[
                        { label: "Views", value: formatNumber(state.data.views) },
                        { label: "Created", value: formatDateTime(state.data.createdAt) },
                        { label: "Updated", value: formatDateTime(state.data.updatedAt) },
                      ]}
                    />
                  ) : null}
                </div>
              </Card>

              <Card title="Cover & SEO">
                <div className="rv-stack">
                  <MediaPicker
                    label="Cover image"
                    folder="blog"
                    multiple={false}
                    value={form.coverImage ? [form.coverImage] : []}
                    onChange={(urls) => update("coverImage", urls[0] ?? "")}
                  />
                  <Field label="Meta title" hint="Defaults to the post title">
                    <TextInput value={form.metaTitle} onChange={(value) => update("metaTitle", value)} />
                  </Field>
                  <Field label="Meta description">
                    <TextArea rows={3} value={form.metaDescription} onChange={(value) => update("metaDescription", value)} />
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
