"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage, useApi } from "@/components/admin/api";
import { toast } from "@/components/admin/toast";
import { Button, Card, Field, Loading, PageHeader, TextInput } from "@/components/admin/ui";

type Minimums = { minimumSubtotalUsd: number; minimumPieces: number };

export default function AdminWholesalePage() {
  const state = useApi<Minimums>("/api/admin/wholesale/minimums");
  const [minimumSubtotalUsd, setMinimumSubtotalUsd] = useState("300");
  const [minimumPieces, setMinimumPieces] = useState("100");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.data) return;
    setMinimumSubtotalUsd(String(state.data.minimumSubtotalUsd));
    setMinimumPieces(String(state.data.minimumPieces));
  }, [state.data]);

  const save = async () => {
    const subtotal = Number(minimumSubtotalUsd);
    const pieces = Number(minimumPieces);
    if (!Number.isFinite(subtotal) || subtotal < 0 || !Number.isInteger(pieces) || pieces < 0) {
      toast.error("Enter a non-negative order value and whole-piece minimum.");
      return;
    }
    setSaving(true);
    try {
      const updated = await apiFetch<Minimums>("/api/admin/wholesale/minimums", {
        method: "PATCH",
        json: { minimumSubtotalUsd: subtotal, minimumPieces: pieces },
      });
      state.setData(updated);
      toast.success("Wholesale minimums saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Wholesale" subtitle="Set minimum order requirements for approved customer accounts." />
      <div className="rv-content">
        <Card title="Minimum order" description="Either threshold can qualify an order; subtotal is measured before shipping, tax, or discounts. Piece count uses the product or variant conversion configured in its editor.">
          {state.loading && !state.data ? <Loading label="Loading Wholesale settings…" /> : (
            <div className="rv-stack" style={{ maxWidth: 560 }}>
              {state.error ? <p className="rv-error-text">{state.error}</p> : null}
              <Field label="Minimum merchandise subtotal (USD)">
                <TextInput type="number" min={0} step="0.01" value={minimumSubtotalUsd} onChange={setMinimumSubtotalUsd} />
              </Field>
              <Field label="Minimum piece-equivalent quantity" hint="Only products configured with a pieces-per-unit conversion count toward this threshold. Piece products default to one piece per unit.">
                <TextInput type="number" min={0} step="1" value={minimumPieces} onChange={setMinimumPieces} />
              </Field>
              <div><Button variant="primary" loading={saving} onClick={() => void save()}>Save minimums</Button></div>
            </div>
          )}
        </Card>
        <Card title="Wholesale catalog" description="Enable the Wholesale sales channel and set prices in the admin product editor. Access is granted from each customer profile after email verification." />
      </div>
    </>
  );
}
