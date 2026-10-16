"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ShippingQuote, ShippingQuoteStatus } from "./types";

type UseShippingQuoteInput = {
  itemCount: number;
  totalWeight: number;
  subtotal: number;
  countryCode: string;
  fragile: boolean;
  oversized: boolean;
};

export function useShippingQuote({
  itemCount,
  totalWeight,
  subtotal,
  countryCode,
  fragile,
  oversized,
}: UseShippingQuoteInput) {
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<ShippingQuoteStatus>("loading");
  const [selectedRateId, setSelectedRateId] = useState("");
  const requestId = useRef(0);

  const reloadShippingQuote = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!itemCount) {
      setQuote(null);
      setQuoteStatus("unavailable");
      return;
    }

    setQuote(null);
    setQuoteStatus("loading");
    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weightGram: totalWeight, subtotal, countryCode, fragile, oversized }),
      });
      if (!response.ok) {
        if (currentRequestId === requestId.current) setQuoteStatus("error");
        return;
      }

      const payload = (await response.json()) as ShippingQuote;
      if (!Array.isArray(payload?.options)) {
        if (currentRequestId === requestId.current) setQuoteStatus("error");
        return;
      }
      if (currentRequestId !== requestId.current) return;

      setQuote(payload);
      setQuoteStatus(payload.options.length ? "ready" : "unavailable");
      setSelectedRateId((current) =>
        payload.options.some((option) => option.id === current) ? current : payload.options[0]?.id ?? "",
      );
    } catch {
      if (currentRequestId === requestId.current) setQuoteStatus("error");
    }
  }, [itemCount, totalWeight, subtotal, countryCode, fragile, oversized]);

  useEffect(() => {
    void reloadShippingQuote();
  }, [reloadShippingQuote]);

  const selectedOption =
    quote?.options.find((option) => option.id === selectedRateId) ?? quote?.options[0] ?? null;

  return { quote, quoteStatus, selectedRateId, setSelectedRateId, selectedOption, reloadShippingQuote };
}
