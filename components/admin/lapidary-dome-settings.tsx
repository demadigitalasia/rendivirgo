"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage, useApi } from "./api";
import { Button, Card, Field, Switch, TextInput } from "./ui";
import { defaultDomeSettings, type DomeSettings } from "@/lib/lapidary-dome-settings";

export function LapidaryDomeSettings() {
  const state = useApi<{ domeSettings: DomeSettings }>("/api/admin/lapidary/content");
  const [settings, setSettings] = useState(defaultDomeSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (state.data?.domeSettings) setSettings(state.data.domeSettings); }, [state.data]);
  return <Card title="Dome controls" description="Define the shape limits available in the custom order form.">
    <form className="rv-stack" onSubmit={async (event) => {
      event.preventDefault(); setSaving(true); setMessage(""); setFailed(false);
      try { await apiFetch("/api/admin/lapidary/content/dome", { method: "PATCH", json: settings }); setMessage("Dome settings saved"); state.refresh(); }
      catch (error) { setFailed(true); setMessage(errorMessage(error)); }
      finally { setSaving(false); }
    }}>
      {state.error ? <p className="rv-error-text" role="alert">{state.error} <Button onClick={state.refresh}>Try again</Button></p> : null}
      <fieldset className="rv-lapidary-admin__studio-fields rv-stack" disabled={state.loading || !!state.error || saving}>
        <div className="rv-lapidary-content__dome">
          <svg viewBox="0 0 300 110" role="img" aria-label="Cabochon profile: dome height is measured above the girdle"><path d="M30 85 Q150 -45 270 85 Z" fill="currentColor" fillOpacity=".09" stroke="currentColor" strokeWidth="1.5"/><path d="M15 85 H285 M150 21 V85 M144 27 L150 21 L156 27 M144 79 L150 85 L156 79" fill="none" stroke="currentColor" strokeWidth="1"/><text x="165" y="58" fill="currentColor" fontSize="11">Height</text><text x="30" y="103" fill="currentColor" fontSize="10">GIRDLE</text></svg>
          <div><Switch checked={settings.enabled} onChange={(enabled) => setSettings({ ...settings, enabled })} label="Enable dome controls" /><p className="rv-hint">Measure height above the girdle. Each cabochon uses these limits; matched pairs share the same settings.</p></div>
        </div>
        <div className="rv-lapidary-admin__edit-grid">
          {(["minHeight", "maxHeight", "defaultHeight", "maxWidthRatio"] as const).map((key) => <Field key={key} label={({ minHeight: "Minimum height · mm", maxHeight: "Maximum height · mm", defaultHeight: "Medium height · mm", maxWidthRatio: "Maximum height / width ratio" })[key]}><TextInput required type="number" min={key === "maxWidthRatio" ? .1 : key === "minHeight" ? .3 : .5} max={key === "maxWidthRatio" ? .8 : key === "maxHeight" ? 20 : 10} step={key === "maxWidthRatio" ? .01 : .1} value={settings[key]} onChange={(value) => setSettings({ ...settings, [key]: Number(value) })} /></Field>)}
        </div>
        <div className="rv-lapidary-admin__section-heading"><h3>Customer-facing heading</h3><p className="rv-hint">Shown above the dome options in the request form.</p></div>
        <div className="rv-lapidary-admin__edit-grid">{(["labelEn", "labelId"] as const).map((key) => <Field key={key} label={key === "labelEn" ? "English" : "Bahasa Indonesia"}><TextInput required maxLength={200} value={settings[key]} onChange={(value) => setSettings({ ...settings, [key]: value })} /></Field>)}</div>
        <div className="rv-inline rv-lapidary-admin__actions"><Button type="submit" variant="primary" loading={saving}>Save dome settings</Button></div>
      </fieldset>
      {message ? <p className={failed ? "rv-error-text" : "rv-hint"} role={failed ? "alert" : "status"}>{message}</p> : null}
    </form>
  </Card>;
}
