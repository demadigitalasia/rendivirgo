"use client";

import { useEffect, useState } from "react";
import {
  apiFetch,
  errorMessage,
  formatDateTime,
  formatNumber,
  useApi,
  useList,
  type PaginatedResponse,
} from "@/components/admin/api";
import { DataTable, TablePagination, type Column } from "@/components/admin/data-table";
import { toast } from "@/components/admin/toast";
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  Loading,
  PageHeader,
  Switch,
  Tabs,
  TextInput,
} from "@/components/admin/ui";

type AuditLog = {
  id: string;
  adminId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  admin: { id: string; email: string; name: string } | null;
};

type AdminSession = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
};

type AdminProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

type MeResponse = { admin: AdminProfile; session: { expiresAt: string } };

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
};

type NotificationListResponse = PaginatedResponse<Notification> & { unreadCount: number };

function AuditPanel() {
  const state = useList<AuditLog>("/api/admin/audit-logs", { pageSize: 20 });
  const data = state.data;
  const params = state.params;
  const hasFilters = Boolean(params.search || params.entityType || params.action || params.from || params.to);

  const columns: Array<Column<AuditLog>> = [
    {
      key: "createdAt",
      header: "Time",
      render: (log) => formatDateTime(log.createdAt),
    },
    {
      key: "admin",
      header: "Admin",
      render: (log) =>
        log.admin ? (
          <div>
            <div>{log.admin.name}</div>
            <div className="rv-hint">{log.admin.email}</div>
          </div>
        ) : (
          <span className="rv-hint">System</span>
        ),
    },
    {
      key: "action",
      header: "Action",
      render: (log) => <span className="rv-mono">{log.action}</span>,
    },
    {
      key: "entity",
      header: "Entity",
      render: (log) => (
        <div>
          <div>{log.entityType}</div>
          {log.entityId ? <div className="rv-hint rv-mono">{log.entityId}</div> : null}
        </div>
      ),
    },
    {
      key: "summary",
      header: "Summary",
      render: (log) => log.summary,
    },
    {
      key: "ip",
      header: "IP",
      render: (log) => <span className="rv-mono">{log.ip ?? "—"}</span>,
    },
  ];

  return (
    <div className="rv-stack">
      {state.error ? (
        <Card title="Could not load audit logs">
          <p className="rv-error-text">{state.error}</p>
        </Card>
      ) : null}

      <Card flush>
        <div className="rv-toolbar">
          <TextInput value={state.searchInput} onChange={state.setSearchInput} placeholder="Search summary" />
          <TextInput
            value={String(params.entityType ?? "")}
            onChange={(value) => state.update({ entityType: value || undefined, page: 1 })}
            placeholder="Entity type"
          />
          <TextInput
            value={String(params.action ?? "")}
            onChange={(value) => state.update({ action: value || undefined, page: 1 })}
            placeholder="Action"
          />
          <div className="rv-inline">
            <span className="rv-hint">From</span>
            <TextInput
              type="date"
              value={String(params.from ?? "")}
              onChange={(value) => state.update({ from: value || undefined, page: 1 })}
            />
          </div>
          <div className="rv-inline">
            <span className="rv-hint">To</span>
            <TextInput
              type="date"
              value={String(params.to ?? "")}
              onChange={(value) => state.update({ to: value || undefined, page: 1 })}
            />
          </div>
          {hasFilters ? (
            <Button size="sm" onClick={state.reset}>
              Reset
            </Button>
          ) : null}
          <Button size="sm" onClick={state.refresh}>
            Refresh
          </Button>
        </div>

        <DataTable
          columns={columns}
          items={data?.items ?? []}
          loading={state.loading && !data}
          rowKey={(log) => log.id}
          emptyTitle="No audit entries"
          emptyDescription={hasFilters ? "Try adjusting the filters." : "Admin actions will be recorded here."}
        />

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
    </div>
  );
}

function SessionsPanel() {
  const state = useApi<AdminSession[]>("/api/auth/sessions");

  const revoke = async (session: AdminSession) => {
    try {
      await apiFetch(`/api/auth/sessions/${session.id}`, { method: "DELETE" });
      toast.success("Session revoked");
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const columns: Array<Column<AdminSession>> = [
    {
      key: "ip",
      header: "IP",
      render: (session) => <span className="rv-mono">{session.ip ?? "—"}</span>,
    },
    {
      key: "userAgent",
      header: "Device",
      render: (session) => <span className="rv-hint">{session.userAgent ?? "Unknown device"}</span>,
    },
    {
      key: "createdAt",
      header: "Started",
      render: (session) => formatDateTime(session.createdAt),
    },
    {
      key: "expiresAt",
      header: "Expires",
      render: (session) => formatDateTime(session.expiresAt),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (session) => (
        <ConfirmButton
          size="sm"
          title="Revoke this session?"
          description="The device will be signed out and must sign in again."
          confirmLabel="Revoke"
          onConfirm={() => revoke(session)}
        >
          Revoke
        </ConfirmButton>
      ),
    },
  ];

  return (
    <div className="rv-stack">
      {state.error ? (
        <Card title="Could not load sessions">
          <p className="rv-error-text">{state.error}</p>
        </Card>
      ) : null}

      <Card
        title="Active sessions"
        description="Signed-in devices for your admin account. Revoking your current session signs you out here too."
        actions={
          <Button size="sm" onClick={state.refresh}>
            Refresh
          </Button>
        }
        flush
      >
        <DataTable
          columns={columns}
          items={state.data ?? []}
          loading={state.loading && !state.data}
          rowKey={(session) => session.id}
          emptyTitle="No active sessions"
          emptyDescription="Sessions appear here after signing in."
        />
      </Card>
    </div>
  );
}

function SecurityPanel() {
  const me = useApi<MeResponse>("/api/auth/me");
  const [profile, setProfile] = useState({ name: "", email: "", avatarUrl: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!me.data) return;
    setProfile({
      name: me.data.admin.name,
      email: me.data.admin.email,
      avatarUrl: me.data.admin.avatarUrl ?? "",
    });
  }, [me.data]);

  const saveProfile = async () => {
    if (profile.name.trim().length < 2) {
      setProfileError("Name must be at least 2 characters.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
      setProfileError("Enter a valid email address.");
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    try {
      await apiFetch("/api/auth/profile", {
        json: {
          name: profile.name.trim(),
          email: profile.email.trim(),
          avatarUrl: profile.avatarUrl.trim() || null,
        },
      });
      toast.success("Profile updated");
      me.refresh();
    } catch (error) {
      setProfileError(errorMessage(error));
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async () => {
    if (!password.current) {
      setPasswordError("Enter your current password.");
      return;
    }
    if (password.next.length < 10) {
      setPasswordError("The new password must be at least 10 characters.");
      return;
    }
    if (password.next !== password.confirm) {
      setPasswordError("The new password and confirmation do not match.");
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordNotice(null);
    try {
      await apiFetch("/api/auth/change-password", {
        json: { currentPassword: password.current, newPassword: password.next },
      });
      setPassword({ current: "", next: "", confirm: "" });
      setPasswordNotice("Password changed. All other active sessions have been revoked — this device stays signed in.");
      toast.success("Password updated");
    } catch (error) {
      setPasswordError(errorMessage(error));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="rv-split">
      <Card title="Profile" description="Shown across the admin workspace and on audit entries">
        <div className="rv-stack">
          {profileError ? <p className="rv-error-text">{profileError}</p> : null}
          {me.loading && !me.data ? (
            <Loading label="Loading profile…" />
          ) : (
            <>
              <Field label="Name">
                <TextInput value={profile.name} onChange={(value) => setProfile((current) => ({ ...current, name: value }))} />
              </Field>
              <Field label="Email">
                <TextInput
                  type="email"
                  value={profile.email}
                  onChange={(value) => setProfile((current) => ({ ...current, email: value }))}
                />
              </Field>
              <Field label="Avatar URL" hint="Leave blank to remove your avatar">
                <TextInput
                  value={profile.avatarUrl}
                  onChange={(value) => setProfile((current) => ({ ...current, avatarUrl: value }))}
                />
              </Field>
              <div className="rv-inline">
                <Button variant="primary" loading={profileSaving} onClick={saveProfile}>
                  Save profile
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card title="Change password" description="Updating your password signs out every other device">
        <div className="rv-stack">
          {passwordError ? <p className="rv-error-text">{passwordError}</p> : null}
          {passwordNotice ? <p style={{ color: "#2f6144" }}>{passwordNotice}</p> : null}
          <Field label="Current password">
            <TextInput
              type="password"
              value={password.current}
              onChange={(value) => setPassword((current) => ({ ...current, current: value }))}
            />
          </Field>
          <Field label="New password" hint="At least 10 characters">
            <TextInput
              type="password"
              value={password.next}
              onChange={(value) => setPassword((current) => ({ ...current, next: value }))}
            />
          </Field>
          <Field label="Confirm new password">
            <TextInput
              type="password"
              value={password.confirm}
              onChange={(value) => setPassword((current) => ({ ...current, confirm: value }))}
            />
          </Field>
          <div className="rv-inline">
            <Button variant="primary" loading={passwordSaving} onClick={changePassword}>
              Update password
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function NotificationsPanel() {
  const state = useList<Notification>("/api/admin/notifications", { pageSize: 20 });
  const data = state.data as NotificationListResponse | null;
  const unreadOnly = Boolean(state.params.unreadOnly);

  const markRead = async (notification: Notification) => {
    try {
      await apiFetch(`/api/admin/notifications/${notification.id}/read`, { method: "PATCH" });
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const markAllRead = async () => {
    try {
      const result = await apiFetch<{ updated: number }>("/api/admin/notifications/read-all", { method: "POST" });
      toast.success(`${formatNumber(result.updated)} notification(s) marked read`);
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async (notification: Notification) => {
    try {
      await apiFetch(`/api/admin/notifications/${notification.id}`, { method: "DELETE" });
      toast.success("Notification deleted");
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Card
      title="Notifications"
      description={data ? `${formatNumber(data.unreadCount)} unread` : undefined}
      actions={
        <>
          <Switch
            checked={unreadOnly}
            onChange={(checked) => state.update({ unreadOnly: checked ? true : undefined, page: 1 })}
            label="Unread only"
          />
          <Button size="sm" onClick={state.refresh}>
            Refresh
          </Button>
          <Button size="sm" variant="primary" disabled={!data?.unreadCount} onClick={markAllRead}>
            Mark all read
          </Button>
        </>
      }
      flush
    >
      {state.error ? <p className="rv-error-text" style={{ padding: 18 }}>{state.error}</p> : null}

      {state.loading && !data ? (
        <Loading label="Loading notifications…" />
      ) : data?.items.length ? (
        <div className="rv-list">
          {data.items.map((notification) => (
            <div className="rv-list__row" key={notification.id}>
              <div>
                <strong>{notification.title}</strong>
                {notification.body ? <div className="rv-hint">{notification.body}</div> : null}
                <div className="rv-hint">{formatDateTime(notification.createdAt)}</div>
              </div>
              <div className="rv-list__meta rv-inline" style={{ justifyContent: "flex-end" }}>
                {notification.isRead ? <Badge tone="gray">Read</Badge> : <Badge tone="bronze">Unread</Badge>}
                {notification.href ? (
                  <Button size="sm" href={notification.href}>
                    Open
                  </Button>
                ) : null}
                {!notification.isRead ? (
                  <Button size="sm" onClick={() => markRead(notification)}>
                    Mark read
                  </Button>
                ) : null}
                <ConfirmButton
                  size="sm"
                  title="Delete notification?"
                  description="This action cannot be undone."
                  confirmLabel="Delete"
                  onConfirm={() => remove(notification)}
                >
                  Delete
                </ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No notifications"
          description={unreadOnly ? "You are all caught up." : "Notifications about messages and store activity appear here."}
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
  );
}

export default function AdminSystemPage() {
  const [tab, setTab] = useState("audit");

  return (
    <>
      <PageHeader title="System" subtitle="Audit trail, sessions, security and notifications" />

      <div className="rv-content">
        <Card>
          <Tabs
            tabs={[
              { value: "audit", label: "Audit log" },
              { value: "sessions", label: "Sessions" },
              { value: "security", label: "Security" },
              { value: "notifications", label: "Notifications" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </Card>

        {tab === "audit" ? <AuditPanel /> : null}
        {tab === "sessions" ? <SessionsPanel /> : null}
        {tab === "security" ? <SecurityPanel /> : null}
        {tab === "notifications" ? <NotificationsPanel /> : null}
      </div>
    </>
  );
}
