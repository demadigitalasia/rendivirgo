"use client";

import { useEffect, useState } from "react";
import {
  apiFetch,
  errorMessage,
  formatDate,
  formatDateTime,
  formatNumber,
  useApi,
  useList,
  type PaginatedResponse,
} from "@/components/admin/api";
import { TablePagination } from "@/components/admin/data-table";
import { toast } from "@/components/admin/toast";
import {
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  KeyValue,
  Loading,
  PageHeader,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import "./messages.css";

type MessageStatus = "New" | "Read" | "Replied" | "Archived";

type Message = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  body: string;
  status: MessageStatus;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type MessageListResponse = PaginatedResponse<Message> & { unreadCount: number };

const statusOptions = [
  { value: "New", label: "New" },
  { value: "Read", label: "Read" },
  { value: "Replied", label: "Replied" },
  { value: "Archived", label: "Archived" },
];

export default function AdminMessagesPage() {
  const state = useList<Message>("/api/admin/messages", { pageSize: 15 });
  const data = state.data as MessageListResponse | null;
  const params = state.params;
  const hasFilters = Boolean(params.search || params.status);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useApi<Message>(selectedId ? `/api/admin/messages/${selectedId}` : null);
  const selected = detail.data && detail.data.id === selectedId ? detail.data : null;
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const listRefresh = state.refresh;

  useEffect(() => {
    if (!selected) return;
    listRefresh();
  }, [selected?.id, listRefresh]);

  const openMessage = (message: Message) => {
    setSelectedId(message.id);
    setReply(message.adminReply ?? "");
  };

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/admin/messages/${selectedId}/reply`, { json: { adminReply: reply.trim() } });
      toast.success("Reply saved");
      detail.refresh();
      listRefresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status: MessageStatus) => {
    if (!selectedId) return;
    setStatusSaving(true);
    try {
      await apiFetch(`/api/admin/messages/${selectedId}`, { method: "PATCH", json: { status } });
      toast.success(`Message marked ${status.toLowerCase()}`);
      detail.refresh();
      listRefresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setStatusSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    try {
      await apiFetch(`/api/admin/messages/${selectedId}`, { method: "DELETE" });
      toast.success("Message deleted");
      setSelectedId(null);
      listRefresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle="Customer messages from the contact form"
        actions={
          <Button size="sm" onClick={state.refresh}>
            Refresh
          </Button>
        }
      />

      <div className="rv-content">
        {state.error ? (
          <Card title="Could not load messages">
            <p className="rv-error-text">{state.error}</p>
          </Card>
        ) : null}

        <div className="rv-split rv-inbox">
          <Card
            title="Messages"
            description={data ? `${formatNumber(data.unreadCount)} unread` : undefined}
            flush
          >
            <div className="rv-toolbar">
              <TextInput value={state.searchInput} onChange={state.setSearchInput} placeholder="Search name, email or subject" />
              <Select
                value={String(params.status ?? "")}
                onChange={(value) => state.update({ status: value || undefined, page: 1 })}
                options={statusOptions}
                placeholder="All statuses"
              />
              {hasFilters ? (
                <Button size="sm" onClick={state.reset}>
                  Reset
                </Button>
              ) : null}
            </div>

            {state.loading && !data ? (
              <Loading label="Loading messages…" />
            ) : data?.items.length ? (
              <div className="rv-inbox__list">
                {data.items.map((message) => (
                  <button
                    type="button"
                    key={message.id}
                    className={[
                      "rv-inbox__item",
                      selectedId === message.id ? "is-selected" : "",
                      message.status === "New" ? "is-unread" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => openMessage(message)}
                  >
                    <div className="rv-inbox__row">
                      <strong>{message.name}</strong>
                      <span className="rv-hint">{formatDate(message.createdAt)}</span>
                    </div>
                    <div className="rv-inbox__subject">{message.subject}</div>
                    <div className="rv-inbox__row">
                      <span className="rv-hint">{message.email}</span>
                      <StatusBadge status={message.status} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No messages"
                description={hasFilters ? "Try adjusting the filters." : "Messages from the contact form will appear here."}
              />
            )}

            {data ? (
              <TablePagination
                page={data.page}
                pageCount={data.pageCount}
                total={data.total}
                pageSize={data.pageSize}
                onPage={state.setPage}
              />
            ) : null}
          </Card>

          <Card
            title={selected ? selected.subject : "Message detail"}
            description={selected ? `Received ${formatDateTime(selected.createdAt)}` : undefined}
            actions={selected ? <StatusBadge status={selected.status} /> : null}
          >
            {!selectedId ? (
              <EmptyState title="No message selected" description="Choose a message from the list to read and reply." />
            ) : detail.loading && !selected ? (
              <Loading label="Loading message…" />
            ) : detail.error ? (
              <p className="rv-error-text">{detail.error}</p>
            ) : selected ? (
              <div className="rv-stack">
                <KeyValue
                  entries={[
                    { label: "From", value: selected.name },
                    {
                      label: "Email",
                      value: (
                        <a href={`mailto:${selected.email}`} className="rv-mono">
                          {selected.email}
                        </a>
                      ),
                    },
                    { label: "Phone", value: selected.phone ?? "—" },
                    { label: "Received", value: formatDateTime(selected.createdAt) },
                    ...(selected.repliedAt ? [{ label: "Replied", value: formatDateTime(selected.repliedAt) }] : []),
                  ]}
                />

                <div className="rv-inbox__body">{selected.body}</div>

                {selected.adminReply ? (
                  <div className="rv-inbox__reply">
                    <span className="rv-hint">Your reply</span>
                    <p>{selected.adminReply}</p>
                  </div>
                ) : null}

                <Field label={selected.adminReply ? "Update reply" : "Reply"} hint="Saving a reply marks the message as Replied">
                  <TextArea value={reply} onChange={setReply} rows={5} placeholder="Write your reply…" />
                </Field>

                <div className="rv-inline">
                  <Button variant="primary" loading={sending} disabled={!reply.trim()} onClick={sendReply}>
                    {selected.adminReply ? "Update reply" : "Send reply"}
                  </Button>
                  <Button disabled={statusSaving || selected.status === "Archived"} onClick={() => changeStatus("Archived")}>
                    Archive
                  </Button>
                  <ConfirmButton
                    size="sm"
                    title="Delete this message?"
                    description="This permanently removes the message from the inbox."
                    confirmLabel="Delete"
                    onConfirm={remove}
                  >
                    Delete
                  </ConfirmButton>
                </div>

                <Field label="Status">
                  <Select
                    value={selected.status}
                    disabled={statusSaving}
                    onChange={(value) => changeStatus(value as MessageStatus)}
                    options={statusOptions}
                  />
                </Field>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
