"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, TextInput } from "./ui";
import { apiFetch, errorMessage, useApi } from "./api";
import { defaultLapidaryServicePricing, type LapidaryServicePricing } from "@/lib/lapidary-service-pricing";

export function LapidaryServicePricingSettings() {
  const state = useApi<LapidaryServicePricing>("/api/admin/lapidary/content/service-pricing");
  const [pricing, setPricing] = useState(defaultLapidaryServicePricing);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (state.data) setPricing(state.data);
  }, [state.data]);

  return <Card title="Service fee estimates" description="Indicative pricing shown before customers submit their request.">
    <p className="rv-lapidary-content__callout">USD estimates are a starting point. Confirm the project scope and agreed fee limit in the request; set the final service fee and return shipping after completion.</p>
    {state.error ? <p role="alert">{state.error}</p> : null}
    <form onSubmit={async (event) => {
      event.preventDefault();
      setSaving(true);
      setMessage("");
      try {
        await apiFetch("/api/admin/lapidary/content/service-pricing", { method: "PATCH", json: pricing });
        setMessage("Service fee estimates saved");
        state.refresh();
      } catch (error) {
        setMessage(errorMessage(error));
      } finally {
        setSaving(false);
      }
    }}>
      <fieldset disabled={state.loading || !!state.error || saving} className="rv-lapidary-admin__studio-fields rv-stack">
        <div className="rv-lapidary-admin__edit-grid">
          <div className="rv-lapidary-content__price"><span>PENDANT</span><h3>A single finished piece</h3><Field label="USD per pendant"><TextInput required type="number" min={0} max={100000} step="0.01" value={pricing.pendantUsd} onChange={(value) => setPricing((current) => ({ ...current, pendantUsd: Number(value) }))} /></Field></div>
          <div className="rv-lapidary-content__price"><span>MATCHED PAIR</span><h3>Two stones, one pair</h3><Field label="USD per matched pair"><TextInput required type="number" min={0} max={100000} step="0.01" value={pricing.matchedPairUsd} onChange={(value) => setPricing((current) => ({ ...current, matchedPairUsd: Number(value) }))} /></Field></div>
        </div>
        <div className="rv-inline rv-lapidary-admin__actions"><Button type="submit" variant="primary" loading={saving}>Save fee estimates</Button></div>
      </fieldset>
      <p role="status">{message}</p>
    </form>
  </Card>;
}
