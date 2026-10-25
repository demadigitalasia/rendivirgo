"use client";

import { AiDraft } from "@/components/admin/ai-draft";
import { SeoPanel } from "@/components/admin/seo-panel";
import { dictionaries } from "@/lib/i18n";

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
import { BlogBodyEditor } from "@/components/admin/blog-body-editor";
import { contentSeoInput, plainText } from "@/lib/seo-analysis";
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
import { contentStatusOptions, parseTags, translationStatusOptions, type BlogAuthorType, type BlogPost, type ContentStatus, type TranslationStatus } from "../../types";
import "./blog-editor.css";

type BlogForm = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  tags: string;
  status: ContentStatus;
  author: string;
  authorType: BlogAuthorType;
  authorUrl: string;
  readMinutes: string;
  publishedAt: string;
  metaTitle: string;
  metaDescription: string;
  coverImage: string;
  coverAlt: string;
  coverAltId: string;
  titleId: string;
  excerptId: string;
  bodyId: string;
  tagsId: string;
  metaTitleId: string;
  metaDescriptionId: string;
  idTranslationStatus: TranslationStatus;
};


const emptyForm: BlogForm = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  tags: "",
  status: "Draft",
  author: "RENDI VIRGO",
  authorType: "Organization",
  authorUrl: "",
  readMinutes: "5",
  publishedAt: "",
  metaTitle: "",
  metaDescription: "",
  coverImage: "",
  coverAlt: "",
  coverAltId: "",
  titleId: "",
  excerptId: "",
  bodyId: "",
  tagsId: "",
  metaTitleId: "",
  metaDescriptionId: "",
  idTranslationStatus: "Missing",
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
    authorType: post.authorType ?? "Organization",
    authorUrl: post.authorUrl ?? "",
    readMinutes: String(post.readMinutes),
    publishedAt: toDateTimeInputValue(post.publishedAt),
    metaTitle: post.metaTitle ?? "",
    metaDescription: post.metaDescription ?? "",
    coverImage: post.coverImage ?? "",
    coverAlt: post.coverAlt ?? "",
    coverAltId: post.coverAltId ?? "",
    titleId: post.titleId ?? "",
    excerptId: post.excerptId ?? "",
    bodyId: post.bodyId ?? "",
    tagsId: post.tagsId.join(", "),
    metaTitleId: post.metaTitleId ?? "",
    metaDescriptionId: post.metaDescriptionId ?? "",
    idTranslationStatus: post.idTranslationStatus ?? "Missing",
  };
}

function estimateReadMinutes(body: string) {
  const words = plainText(body).split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
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

  const update = <K extends keyof BlogForm>(key: K, value: BlogForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };



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

    const isPublishing = (!state.data || state.data.status !== form.status) && (form.status === "Published" || form.status === "Scheduled");
    if (isPublishing && !form.excerpt.trim()) {
      toast.error("Add an article excerpt before publishing.");
      return;
    }
    if (isPublishing && !form.body.trim()) {
      toast.error("Add article content before publishing.");
      return;
    }
    if (isPublishing && form.status === "Scheduled" && (!form.publishedAt || new Date(form.publishedAt).getTime() <= Date.now())) {
      toast.error("Scheduled articles need a publication date in the future.");
      return;
    }

    const payload: Record<string, unknown> = {
      title,
      slug: form.slug.trim() || undefined,
      excerpt: form.excerpt,
      body: form.body,
      coverImage: form.coverImage || null,
      coverAlt: form.coverAlt.trim() || null,
      coverAltId: form.coverAltId.trim() || null,
      tags: parseTags(form.tags),
      status: form.status,
      author: form.author.trim() || "RENDI VIRGO",
      authorType: form.authorType,
      authorUrl: form.authorUrl.trim() || null,
      metaTitle: form.metaTitle.trim() || null,
      metaDescription: form.metaDescription.trim() || null,
      titleId: form.titleId.trim() || null,
      excerptId: form.excerptId.trim() || null,
      bodyId: form.bodyId,
      tagsId: parseTags(form.tagsId),
      metaTitleId: form.metaTitleId.trim() || null,
      metaDescriptionId: form.metaDescriptionId.trim() || null,
      idTranslationStatus: form.idTranslationStatus,
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
    <div className="rv-blog-editor-page">
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

      <div className="rv-content rv-blog-editor-content">
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
          <div className="rv-blog-editor-layout">
            <div className="rv-blog-editor-main">
              <Card
                className="rv-blog-editor-card rv-blog-editor-article"
                title="Article"
                description="Draft article copy and SEO metadata, then review each field before saving."

              >
                <div className="rv-stack">
                  <Field label="Title">
                    <TextInput value={form.title} onChange={(value) => update("title", value)} placeholder="Post title" />
                  </Field>
                  <AiDraft kind="blog" title="Draft article and SEO" sourceVersion={JSON.stringify(form)} currentValues={form} context={{ title: form.title, body: form.body, excerpt: form.excerpt, tags: form.tags }} onApply={draft => setForm(current => ({ ...current, ...draft }))} />
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
                  <Field label="Body" hint="Use the toolbar to format paragraphs and preview the article.">
                    <BlogBodyEditor value={form.body} onChange={(value) => update("body", value)} />
                  </Field>
                </div>
              </Card>
            </div>

            <aside className="rv-blog-editor-rail">
              <Card className="rv-blog-editor-card" title="Publishing" description="Set visibility, timing, and author details.">
                <div className="rv-stack rv-blog-editor-publishing">
                  <div className="rv-form-grid rv-blog-editor-publishing-grid">
                    <Field label="Status">
                      <Select
                        value={form.status}
                        onChange={(value) => update("status", value as ContentStatus)}
                        options={contentStatusOptions}
                      />
                    </Field>
                    <Field label="Author type">
                      <Select
                        value={form.authorType}
                        onChange={(value) => update("authorType", value as BlogAuthorType)}
                        options={[
                          { value: "Organization", label: "Organization" },
                          { value: "Person", label: "Person" },
                        ]}
                      />
                    </Field>
                    <Field label="Author">
                      <TextInput value={form.author} onChange={(value) => update("author", value)} />
                    </Field>
                    <Field label="Read minutes">
                      <div className="rv-blog-editor-read-time-control">
                        <TextInput
                          type="number"
                          min={1}
                          max={240}
                          value={form.readMinutes}
                          onChange={(value) => update("readMinutes", value)}
                        />
                        <Button size="sm" onClick={() => update("readMinutes", String(estimateReadMinutes(form.body)))}>Estimate</Button>
                      </div>
                    </Field>
                  </div>
                  <Field label="Author profile URL" hint="Optional; add a public profile or About page for a person author.">
                    <TextInput
                      type="url"
                      value={form.authorUrl}
                      onChange={(value) => update("authorUrl", value)}
                      placeholder="https://rendivirgo.com/about-us"
                    />
                  </Field>
                  <Field label="Published at" hint={isNew ? "Optional; set a date and time to schedule this post." : "Leave blank to keep the current schedule."}>
                    <TextInput
                      type="datetime-local"
                      value={form.publishedAt}
                      onChange={(value) => update("publishedAt", value)}
                    />
                  </Field>
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

              <Card className="rv-blog-editor-card rv-blog-editor-cover" title="Cover & SEO" description="Choose the cover image and search preview.">
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
                  <Field label="Cover image alt text" hint="Briefly describe what is visible in the cover image.">
                    <TextInput value={form.coverAlt} onChange={(value) => update("coverAlt", value)} />
                  </Field>
                </div>
              </Card>
              <SeoPanel compact translationStatus={form.idTranslationStatus}
                input={{ ...contentSeoInput({ title: form.title, slug: form.slug, body: form.body, metaTitle: form.metaTitle, metaDescription: form.metaDescription, coverImage: form.coverImage, coverAlt: form.coverAlt }, "blog"),
                  publicTitleFallback: `${form.title} | RENDI VIRGO ${dictionaries.en.journal.eyebrow}`,
                  publicDescriptionFallback: form.excerpt }}
                translation={contentSeoInput({ title: form.titleId, slug: form.slug, body: form.bodyId, metaTitle: form.metaTitleId, metaDescription: form.metaDescriptionId, coverImage: form.coverImage, coverAlt: form.coverAltId }, "blog")}
                onMetadata={draft => setForm(current => ({ ...current, metaTitle: draft.metaTitle, metaDescription: draft.metaDescription }))}
              />
            </aside>

            <div className="rv-blog-editor-translation">
              <Card className="rv-blog-editor-card" title="Bahasa Indonesia" description="Add a reviewed Indonesian version. Set the status to Ready when all required fields are translated.">
                <div className="rv-stack">
                  <div className="rv-form-grid rv-blog-editor-translation-fields">
                    <Field label="Translation status">
                      <Select value={form.idTranslationStatus} onChange={(value) => update("idTranslationStatus", value as TranslationStatus)} options={translationStatusOptions} />
                    </Field>
                    <Field label="Title">
                      <TextInput value={form.titleId} onChange={(value) => update("titleId", value)} />
                    </Field>
                    <Field label="Tags" hint="Pisahkan dengan koma">
                      <TextInput value={form.tagsId} onChange={(value) => update("tagsId", value)} />
                    </Field>
                    <Field label="Alt teks sampul" hint="Jelaskan isi gambar dalam bahasa Indonesia secara singkat.">
                      <TextInput value={form.coverAltId} onChange={(value) => update("coverAltId", value)} />
                    </Field>
                  </div>
                  <Field label="Ringkasan">
                    <TextArea rows={3} value={form.excerptId} onChange={(value) => update("excerptId", value)} />
                  </Field>
                  <Field label="Isi artikel" hint="Gunakan toolbar untuk mengatur format dan melihat pratinjau.">
                    <BlogBodyEditor value={form.bodyId} onChange={(value) => update("bodyId", value)} />
                  </Field>
                  <div className="rv-form-grid">
                    <Field label="Judul meta">
                      <TextInput value={form.metaTitleId} onChange={(value) => update("metaTitleId", value)} />
                    </Field>
                    <Field label="Deskripsi meta">
                      <TextArea rows={3} value={form.metaDescriptionId} onChange={(value) => update("metaDescriptionId", value)} />
                    </Field>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
