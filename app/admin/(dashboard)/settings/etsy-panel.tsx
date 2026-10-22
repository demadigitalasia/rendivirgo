"use client";

import { useState } from "react";
import { apiFetch, errorMessage, useApi, type ApiState } from "@/components/admin/api";
import { Badge, Button, Card, Loading, StatusBadge } from "@/components/admin/ui";
import { toast } from "@/components/admin/toast";

type EtsyJob = {
  productId: string;
  productName: string;
  sku: string;
  status: string;
  lastError: string | null;
  updatedAt: string;
  listingId: string | null;
  listingUrl: string | null;
};

type EtsyStatus = {
  configured: boolean;
  missingConnectionConfig: string[];
  missingListingConfig: string[];
  connected: boolean;
  shop: { id: string; name: string; currencyCode: string; connectedAt: string } | null;
  sync: { Pending: number; Processing: number; Synced: number; Failed: number };
  recentJobs: EtsyJob[];
};

type EtsyShopProfiles = {
  shippingProfiles: Array<{ id: string; title: string; originCountry: string | null }>;
  returnPolicies: Array<{ id: string; acceptsReturns: boolean; acceptsExchanges: boolean; returnDeadline: number | null }>;
  readinessProfiles: Array<{
    id: string;
    state: string;
    minProcessingDays: number | null;
    maxProcessingDays: number | null;
    label: string | null;
  }>;
};

type EtsyDraftCandidate = {
  id: string;
  name: string;
  sku: string;
  currency: string;
  price: number;
  hasImage: boolean;
};

export function EtsySettingsPanel() {
  const state: ApiState<EtsyStatus> = useApi<EtsyStatus>("/api/admin/integrations/etsy");
  const [busy, setBusy] = useState(false);
  const status = state.data;
  const profiles = useApi<EtsyShopProfiles>(status?.connected ? "/api/admin/integrations/etsy/shop-profiles" : null);
  const candidates = useApi<EtsyDraftCandidate[]>(status?.connected ? "/api/admin/integrations/etsy/sync-candidates" : null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [readinessState, setReadinessState] = useState<"" | "ready_to_ship" | "made_to_order">("");
  const [minProcessingTime, setMinProcessingTime] = useState("");
  const [maxProcessingTime, setMaxProcessingTime] = useState("");
  const [processingTimeUnit, setProcessingTimeUnit] = useState<"days" | "weeks">("days");

  const connect = async () => {
    setBusy(true);
    try {
      const result = await apiFetch<{ authorizationUrl: string }>("/api/admin/integrations/etsy/connect", { method: "POST" });
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  };

  const retryFailed = async () => {
    setBusy(true);
    try {
      const result = await apiFetch<{ queued: number }>("/api/admin/integrations/etsy/retry", { method: "POST" });
      toast.success(`${result.queued} Etsy listing job${result.queued === 1 ? "" : "s"} queued`);
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect the saved Etsy credentials? Existing Etsy listings will remain as they are.")) return;
    setBusy(true);
    try {
      await apiFetch("/api/admin/integrations/etsy", { method: "DELETE" });
      toast.success("Etsy shop disconnected");
      state.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const createReadinessProfile = async () => {
    setProfileBusy(true);
    try {
      const profile = await apiFetch<{ id: string }>("/api/admin/integrations/etsy/shop-profiles/readiness", {
        json: {
          readinessState,
          minProcessingTime: Number(minProcessingTime),
          maxProcessingTime: Number(maxProcessingTime),
          processingTimeUnit,
        },
      });
      toast.success(`Processing profile created: ${profile.id}. Set this as ETSY_DEFAULT_READINESS_STATE_ID in Coolify.`);
      setReadinessState("");
      setMinProcessingTime("");
      setMaxProcessingTime("");
      profiles.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setProfileBusy(false);
    }
  };

  const syncDraftProduct = async () => {
    if (!selectedProductId) return;
    setSyncBusy(true);
    try {
      await apiFetch(`/api/admin/integrations/etsy/sync/${encodeURIComponent(selectedProductId)}`, { method: "POST" });
      toast.success("Draft product queued for Etsy. It will remain inactive until you publish it.");
      state.refresh();
      candidates.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSyncBusy(false);
    }
  };

  const refreshConnectionData = () => {
    state.refresh();
    if (status?.connected) {
      profiles.refresh();
      candidates.refresh();
    }
  };

  if (state.loading && !status) return <Card><Loading label="Loading Etsy connection…" /></Card>;
  if (state.error && !status) {
    return <Card title="Could not load Etsy settings"><p className="rv-error-text">{state.error}</p></Card>;
  }

  return (
    <>
      <Card
        title="Etsy shop connection"
        description="Connect the RENDI VIRGO API to your own Etsy shop. OAuth tokens are encrypted on the server."
        actions={status ? <Badge tone={status.connected ? "green" : "gray"}>{status.connected ? "Connected" : "Not connected"}</Badge> : null}
      >
        {!status ? null : (
          <div className="rv-stack">
            {status.shop ? (
              <div className="rv-form-grid">
                <div><span className="rv-label">Shop</span><div>{status.shop.name}</div></div>
                <div><span className="rv-label">Shop ID</span><div>{status.shop.id}</div></div>
                <div><span className="rv-label">Shop currency</span><div>{status.shop.currencyCode}</div></div>
                <div><span className="rv-label">Connected</span><div>{new Date(status.shop.connectedAt).toLocaleString()}</div></div>
              </div>
            ) : (
              <p>Connect your Etsy shop to authorize the integration. Connecting does not queue your existing catalog.</p>
            )}

            {!status.configured ? (
              <div className="rv-notice rv-notice--warning">
                <strong>API connection settings are missing</strong>
                <p>Add these server environment values, then restart the API:</p>
                <code>{status.missingConnectionConfig.join(", ")}</code>
              </div>
            ) : null}

            {status.missingListingConfig.length ? (
              <div className="rv-notice rv-notice--warning">
                <strong>Listing defaults are incomplete</strong>
                <p>Connect first to inspect your shop profiles. Then set these API environment values in Coolify and restart the API before syncing:</p>
                <code>{status.missingListingConfig.join(", ")}</code>
              </div>
            ) : null}

            <p className="rv-hint">
              The first Etsy listing is created only when you choose an unlinked local Draft product without variants. After it is linked, product edits sync automatically; changing that product to Published activates its Etsy listing. Etsy order imports and order-driven stock changes are not included.
            </p>

            <div className="rv-inline">
              <Button variant="primary" onClick={connect} loading={busy} disabled={!status.configured}>
                {status.connected ? "Reconnect Etsy shop" : "Connect Etsy shop"}
              </Button>
              <Button onClick={refreshConnectionData} disabled={state.loading || busy || profileBusy || syncBusy}>Refresh status & profiles</Button>
              {status.connected ? (
                <Button variant="danger" onClick={disconnect} loading={busy}>Disconnect</Button>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      {status?.connected ? (
        <Card
          title="Etsy shop profiles"
          description="Use these IDs for the matching Coolify environment variables. Profile reads do not change your shop."
          actions={<Button size="sm" onClick={profiles.refresh} disabled={profiles.loading || profileBusy}>Refresh profiles</Button>}
        >
          {profiles.loading && !profiles.data ? <Loading label="Loading Etsy shop profiles…" /> : profiles.error ? (
            <div className="rv-notice rv-notice--warning">
              <strong>Could not load shop profiles</strong>
              <p>{profiles.error} If this connection was authorized before the shop read/write scopes were added, reconnect and approve the requested Etsy permissions.</p>
            </div>
          ) : profiles.data ? (
            <div className="rv-stack">
              <div>
                <strong>Shipping profiles</strong>
                {profiles.data.shippingProfiles.length ? profiles.data.shippingProfiles.map((profile) => (
                  <p key={profile.id}><code>{profile.id}</code> · {profile.title}{profile.originCountry ? ` · ${profile.originCountry}` : ""}</p>
                )) : <p className="rv-hint">No shipping profiles returned for this shop.</p>}
              </div>
              <div>
                <strong>Return policies</strong>
                {profiles.data.returnPolicies.length ? profiles.data.returnPolicies.map((policy) => (
                  <p key={policy.id}><code>{policy.id}</code> · returns {policy.acceptsReturns ? "accepted" : "not accepted"} · exchanges {policy.acceptsExchanges ? "accepted" : "not accepted"}{policy.returnDeadline !== null ? ` · ${policy.returnDeadline} days` : ""}</p>
                )) : <p className="rv-hint">No return policies returned for this shop.</p>}
              </div>
              <div>
                <strong>Processing profiles</strong>
                {profiles.data.readinessProfiles.length ? profiles.data.readinessProfiles.map((profile) => (
                  <p key={profile.id}><code>{profile.id}</code> · {profile.label || profile.state}</p>
                )) : <p className="rv-hint">No processing profiles returned. Create one below using the processing times that match your shop.</p>}
              </div>
              <div className="rv-notice">
                <strong>Create a processing profile</strong>
                <p>If an existing profile matches your dispatch schedule, use its ID above. Create a new one only if none match; copy its ID to Coolify as ETSY_DEFAULT_READINESS_STATE_ID.</p>
                <div className="rv-form-grid">
                  <label className="rv-field"><span className="rv-label">Readiness</span>
                    <select className="rv-input" value={readinessState} onChange={(event) => setReadinessState(event.target.value as typeof readinessState)}>
                      <option value="">Choose readiness</option>
                      <option value="ready_to_ship">Ready to ship</option>
                      <option value="made_to_order">Made to order</option>
                    </select>
                  </label>
                  <label className="rv-field"><span className="rv-label">Minimum time</span>
                    <input className="rv-input" type="number" min="1" max="10" step="1" value={minProcessingTime} onChange={(event) => setMinProcessingTime(event.target.value)} />
                  </label>
                  <label className="rv-field"><span className="rv-label">Maximum time</span>
                    <input className="rv-input" type="number" min="1" max="10" step="1" value={maxProcessingTime} onChange={(event) => setMaxProcessingTime(event.target.value)} />
                  </label>
                  <label className="rv-field"><span className="rv-label">Unit</span>
                    <select className="rv-input" value={processingTimeUnit} onChange={(event) => setProcessingTimeUnit(event.target.value as typeof processingTimeUnit)}>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                    </select>
                  </label>
                </div>
                <Button
                  variant="primary"
                  onClick={createReadinessProfile}
                  loading={profileBusy}
                  disabled={!readinessState || !minProcessingTime || !maxProcessingTime || Number(minProcessingTime) < 1 || Number(maxProcessingTime) < Number(minProcessingTime) || Number(maxProcessingTime) > 10}
                >Create processing profile</Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {status?.connected ? (
        <Card title="First Etsy draft sync" description="Select one unlinked local Draft product. This creates an inactive Etsy draft listing.">
          <div className="rv-stack">
            {status.missingListingConfig.length ? (
              <p className="rv-hint">Finish the Coolify listing defaults above before queuing a product.</p>
            ) : (
              <>
                <label className="rv-field"><span className="rv-label">Draft product</span>
                  <select className="rv-input" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} disabled={candidates.loading || !candidates.data?.length}>
                    <option value="">Choose a single-item Draft product</option>
                    {(candidates.data ?? []).map((product) => (
                      <option key={product.id} value={product.id}>{product.name} · {product.sku} · {product.currency} {product.price}{product.hasImage ? "" : " · no photo"}</option>
                    ))}
                  </select>
                </label>
                {candidates.error ? <p className="rv-error-text">{candidates.error}</p> : null}
                {!candidates.loading && !candidates.error && !candidates.data?.length ? <p className="rv-hint">No single-item Draft products are available. Create or change one product to Draft in Products first.</p> : null}
                <Button variant="primary" onClick={syncDraftProduct} loading={syncBusy} disabled={!selectedProductId || status.missingListingConfig.length > 0 || candidates.loading}>Queue Etsy draft</Button>
              </>
            )}
          </div>
        </Card>
      ) : null}

      <Card
        title="Listing sync"
        description="Jobs run in the API background worker and retry transient Etsy errors automatically."
        actions={status?.connected ? <Button size="sm" onClick={retryFailed} loading={busy} disabled={!status.sync.Failed || status.missingListingConfig.length > 0}>Retry failed</Button> : null}
      >
        {!status ? null : (
          <div className="rv-stack">
            <div className="rv-inline">
              <Badge tone="amber">Pending {status.sync.Pending}</Badge>
              <Badge tone="blue">Processing {status.sync.Processing}</Badge>
              <Badge tone="green">Synced {status.sync.Synced}</Badge>
              <Badge tone={status.sync.Failed ? "red" : "gray"}>Failed {status.sync.Failed}</Badge>
            </div>
            {status.recentJobs.length ? (
              <div className="rv-stack">
                {status.recentJobs.map((job) => (
                  <div className="rv-inline" key={job.productId} style={{ justifyContent: "space-between", alignItems: "flex-start", borderTop: "1px solid var(--rv-border, #ddd)", paddingTop: 12 }}>
                    <div>
                      <strong>{job.productName}</strong> <span className="rv-hint">· {job.sku}</span>
                      {job.lastError ? <p className="rv-error-text">{job.lastError}</p> : null}
                      {job.listingUrl ? <a href={job.listingUrl} target="_blank" rel="noreferrer">Open Etsy listing</a> : null}
                    </div>
                    <div className="rv-stack" style={{ alignItems: "flex-end" }}>
                      <StatusBadge status={job.status} />
                      <span className="rv-hint">{new Date(job.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rv-hint">No product sync jobs yet.</p>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
