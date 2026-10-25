"use client";

import { useSearchParams } from "next/navigation";
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
type ContactEmail = {
  id: string;
  kind: "AdminNotification" | "CustomerReply";
  status: "Pending" | "Processing" | "Sent" | "Failed";
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
};

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
  emailOutbox?: ContactEmail[];
};

type MessageListResponse = PaginatedResponse<Message> & {
  unreadCount: number;
  emailReadiness: { enabled: boolean; senderConfigured: boolean; acceptedDoesNotMeanDelivered: boolean };
};

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
  const searchParams = useSearchParams();
  const openId = searchParams.get("open");

  useEffect(() => {
    if (openId && !selectedId) setSelectedId(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  useEffect(() => {
    if (!selected) return;
    setReply(selected.adminReply ?? "");
    listRefresh();
  }, [selected?.id, listRefresh]);

  const openMessage = (message: Message) => {
    setSelectedId(message.id);
  };

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/admin/messages/${selectedId}/reply`, { json: { adminReply: reply.trim() } });
      toast.success("Reply saved and queued for email delivery");
      detail.refresh();
      listRefresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const retryEmail = async (emailId: string) => {
    if (!selectedId) return;
    try {
      await apiFetch(`/api/admin/messages/${selectedId}/emails/${emailId}/retry`, { method: "POST" });
      toast.success("Email queued for retry");
      detail.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
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
        {data?.emailReadiness && (!data.emailReadiness.enabled || !data.emailReadiness.senderConfigured) ? (
          <Card title="Email delivery is not ready">
            <p className="rv-error-text">
              {!data.emailReadiness.enabled
                ? "RESEND_API_KEY is not configured. Contact messages are still saved in this inbox, but queued email alerts and replies will wait."
                : "EMAIL_FROM is not configured. Set a verified sender address before queued alerts and replies can be sent."}
            </p>
          </Card>
        ) : null}

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
                ariaLabel="Filter messages by status"
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
                    aria-current={selectedId === message.id ? "true" : undefined}
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

                {selected.emailOutbox?.length ? (
                  <section className="rv-stack" aria-label="Email delivery history">
                    <div className="rv-inline" style={{ justifyContent: "space-between" }}>
                      <div>
                        <h3>Email delivery</h3>
                        <p className="rv-hint">Sent means accepted by the email provider; it does not confirm inbox delivery.</p>
                      </div>
                      <Button size="sm" onClick={detail.refresh}>Refresh status</Button>
                    </div>
                    {selected.emailOutbox.map((email) => (
                      <article className="rv-card rv-stack" key={email.id}>
                        <div className="rv-inline" style={{ justifyContent: "space-between" }}>
                          <strong>{email.kind === "AdminNotification" ? "Admin notification" : "Customer reply"}</strong>
                          <StatusBadge status={email.status} />
                        </div>
                        <p className="rv-hint">
                          {email.attempts} attempt{email.attempts === 1 ? "" : "s"} · queued {formatDateTime(email.createdAt)}
                          {email.sentAt ? ` · accepted ${formatDateTime(email.sentAt)}` : ""}
                        </p>
                        {email.lastError && email.status === "Failed" ? <p className="rv-error-text">{email.lastError}</p> : null}
                        {email.status === "Failed" ? <Button size="sm" onClick={() => void retryEmail(email.id)}>Retry email</Button> : null}
                      </article>
                    ))}
                  </section>
                ) : null}

                {selected.adminReply ? (
                  <div className="rv-inbox__reply">
                    <span className="rv-hint">Your reply</span>
                    <p>{selected.adminReply}</p>
                  </div>
                ) : null}

                <Field label={selected.adminReply ? "Update reply" : "Reply"} hint="Saving a reply marks the message as Replied and queues a customer email">
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
