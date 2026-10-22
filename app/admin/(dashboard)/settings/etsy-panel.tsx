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

export function EtsySettingsPanel() {
  const state: ApiState<EtsyStatus> = useApi<EtsyStatus>("/api/admin/integrations/etsy");
  const [busy, setBusy] = useState(false);
  const status = state.data;

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
              <p>Connect your Etsy shop to queue existing products and sync future product changes.</p>
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
                <p>Set these values from your Etsy shop before connecting or syncing products:</p>
                <code>{status.missingListingConfig.join(", ")}</code>
              </div>
            ) : null}

            <p className="rv-hint">
              Product saves create or update a single-item Etsy listing. A local Published product is activated after its photo and Etsy listing fields are accepted.
              Products with variants need an Etsy variation mapping before they can sync. Order-driven stock changes and Etsy order imports are not included in this phase.
            </p>

            <div className="rv-notice rv-notice--warning">
              <strong>Check Etsy production availability</strong>
              <p>
                Etsy currently documents readiness profiles as a migration feature and advises using test shops during that phase. Confirm Etsy has enabled it for your shop before connecting a live account.
                {" "}<a href="https://developers.etsy.com/documentation/tutorials/migration/" target="_blank" rel="noreferrer">Read Etsy&apos;s migration guide</a>.
              </p>
            </div>

            <div className="rv-inline">
              <Button variant="primary" onClick={connect} loading={busy} disabled={!status.configured || status.missingListingConfig.length > 0}>
                {status.connected ? "Reconnect Etsy shop" : "Connect Etsy shop"}
              </Button>
              <Button onClick={state.refresh} disabled={state.loading || busy}>Refresh status</Button>
              {status.connected ? (
                <Button variant="danger" onClick={disconnect} loading={busy}>Disconnect</Button>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Listing sync"
        description="Jobs run in the API background worker and retry transient Etsy errors automatically."
        actions={status?.connected ? <Button size="sm" onClick={retryFailed} loading={busy} disabled={!status.sync.Failed}>Retry failed</Button> : null}
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
