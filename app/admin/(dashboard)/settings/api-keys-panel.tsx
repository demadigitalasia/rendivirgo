"use client";

import { useMemo, useState } from "react";
import { apiFetch, errorMessage, useApi, type ApiState } from "@/components/admin/api";
import { Badge, Button, Card, Field, Loading, Select, TextInput } from "@/components/admin/ui";
import { toast } from "@/components/admin/toast";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

const SCOPE_DOMAINS = ["catalog", "content", "orders", "uploads", "settings"] as const;
const SCOPE_LABELS: Record<(typeof SCOPE_DOMAINS)[number], string> = {
  catalog: "Products & catalog",
  content: "Content & marketing",
  orders: "Orders & lapidary",
  uploads: "Media uploads",
  settings: "Settings & shipping",
};

export function ApiKeysPanel() {
  const state: ApiState<ApiKeyRow[]> = useApi<ApiKeyRow[]>("/api/admin/api-keys");
  const [name, setName] = useState("");
  const [domains, setDomains] = useState<Record<string, "" | "read" | "write">>({});
  const [fullAccess, setFullAccess] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [revokedToken, setRevokedToken] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedScopes = useMemo(() => {
    if (fullAccess) return ["*"];
    const scopes = Object.entries(domains).flatMap(([domain, level]) => (level ? [`${domain}:${level}`] : []));
    return Array.from(new Set(scopes));
  }, [domains, fullAccess]);

  const create = async () => {
    setBusy(true);
    try {
      const result = await apiFetch<{ token: string }>("/api/admin/api-keys", {
        json: {
          name: name.trim(),
          scopes: selectedScopes,
          ...(expiresInDays ? { expiresInDays: Number(expiresInDays) } : {}),
        },
      });
      setRevokedToken(result.token);
      setCopied(false);
      setName("");
      setDomains({});
      setFullAccess(false);
      setExpiresInDays("");
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (key: ApiKeyRow) => {
    if (!window.confirm(`Revoke API key "${key.name}"? Clients using it will immediately lose access.`)) return;
    try {
      await apiFetch(`/api/admin/api-keys/${encodeURIComponent(key.id)}`, { method: "DELETE" });
      toast.success("API key revoked");
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(revokedToken);
      setCopied(true);
    } catch {
      toast.error("Could not copy — select the key text manually");
    }
  };

  const canCreate = Boolean(name.trim()) && selectedScopes.length > 0 && !busy;

  return (
    <>
      {revokedToken ? (
        <Card title="Copy your API key now" description="This is the only time the full key is shown. It is stored hashed and cannot be retrieved later.">
          <div className="rv-stack">
            <code style={{ wordBreak: "break-all" }}>{revokedToken}</code>
            <div className="rv-inline">
              <Button variant="primary" size="sm" onClick={copyToken}>{copied ? "Copied" : "Copy key"}</Button>
              <Button size="sm" onClick={() => setRevokedToken("")}>Done — hide it</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card title="Create API key" description="API keys let external agents (such as Hermes via MCP) call the admin API with Bearer auth. Grant the smallest scope set that is needed.">
        <div className="rv-stack">
          <div className="rv-form-grid">
            <Field label="Key name">
              <TextInput value={name} onChange={setName} placeholder="e.g. Hermes agent" />
            </Field>
            <Field label="Expires">
              <Select
                value={expiresInDays}
                onChange={setExpiresInDays}
                options={[
                  { value: "", label: "Never" },
                  { value: "30", label: "30 days" },
                  { value: "90", label: "90 days" },
                  { value: "365", label: "1 year" },
                ]}
              />
            </Field>
          </div>
          <div className="rv-form-grid">
            {SCOPE_DOMAINS.map((domain) => (
              <Field key={domain} label={SCOPE_LABELS[domain]}>
                <Select
                  value={domains[domain] ?? ""}
                  onChange={(value) => setDomains((current) => ({ ...current, [domain]: value as "" | "read" | "write" }))}
                  disabled={fullAccess}
                  options={[
                    { value: "", label: "No access" },
                    { value: "read", label: "Read only" },
                    { value: "write", label: "Read & write" },
                  ]}
                />
              </Field>
            ))}
          </div>
          <label className="rv-inline" style={{ gap: 8 }}>
            <input type="checkbox" checked={fullAccess} onChange={(event) => setFullAccess(event.target.checked)} />
            <span>Full access (*)</span>
          </label>
          <div className="rv-inline">
            <Button variant="primary" onClick={create} loading={busy} disabled={!canCreate}>Create API key</Button>
            {!fullAccess && selectedScopes.length ? (
              <span className="rv-hint">Scopes: {selectedScopes.join(", ")}</span>
            ) : null}
          </div>
        </div>
      </Card>

      <Card
        title="API keys"
        description="Keys are shown by their prefix only. Revoke any key that is no longer needed."
        actions={<Button size="sm" onClick={state.refresh} disabled={state.loading}>Refresh</Button>}
      >
        {state.loading && !state.data ? <Loading label="Loading API keys…" /> : state.error ? (
          <p className="rv-error-text">{state.error}</p>
        ) : state.data?.length ? (
          <div className="rv-stack">
            {state.data.map((key) => (
              <div key={key.id} className="rv-inline" style={{ justifyContent: "space-between", alignItems: "flex-start", borderTop: "1px solid var(--rv-border, #ddd)", paddingTop: 12 }}>
                <div>
                  <strong>{key.name}</strong> <span className="rv-hint">· {key.keyPrefix}…</span>
                  <div className="rv-inline" style={{ flexWrap: "wrap", gap: 6 }}>
                    {key.scopes.map((scope) => (
                      <Badge key={scope} tone={scope === "*" ? "red" : "blue"}>{scope}</Badge>
                    ))}
                  </div>
                  <p className="rv-hint">
                    Created {new Date(key.createdAt).toLocaleString()}
                    {key.lastUsedAt ? ` · last used ${new Date(key.lastUsedAt).toLocaleString()}` : " · never used"}
                    {key.expiresAt ? ` · expires ${new Date(key.expiresAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="rv-stack" style={{ alignItems: "flex-end" }}>
                  <Badge tone={key.revokedAt ? "gray" : "green"}>{key.revokedAt ? "Revoked" : "Active"}</Badge>
                  {!key.revokedAt ? <Button size="sm" variant="danger" onClick={() => revoke(key)}>Revoke</Button> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rv-hint">No API keys yet. Create one above to give an external agent access.</p>
        )}
      </Card>
    </>
  );
}
