"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaymentAvailability, PaymentMethods } from "./types";

export function usePaymentAvailability() {
  const [paymentAvailability, setPaymentAvailability] = useState<PaymentAvailability>("loading");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"PayPal" | "BankTransfer">("PayPal");

  const reloadPaymentAvailability = useCallback(async () => {
    setPaymentAvailability("loading");
    try {
      const response = await fetch("/api/payments/methods", { cache: "no-store" });
      const payload = (await response.json()) as Partial<PaymentMethods>;
      if (
        !response.ok ||
        typeof payload?.paypal?.enabled !== "boolean" ||
        typeof payload?.bankTransfer?.enabled !== "boolean"
      ) {
        throw new Error("Payment availability unavailable");
      }

      const methods = payload as PaymentMethods;
      setPaymentMethods(methods);
      setPaymentAvailability(methods.paypal.enabled || methods.bankTransfer.enabled ? "available" : "unavailable");
      setSelectedPaymentMethod((current) => {
        if (current === "PayPal" && !methods.paypal.enabled && methods.bankTransfer.enabled) return "BankTransfer";
        if (current === "BankTransfer" && !methods.bankTransfer.enabled && methods.paypal.enabled) return "PayPal";
        return current;
      });
    } catch {
      setPaymentAvailability("error");
    }
  }, []);

  useEffect(() => {
    void reloadPaymentAvailability();
  }, [reloadPaymentAvailability]);

  const selectedMethodAvailable =
    selectedPaymentMethod === "PayPal"
      ? Boolean(paymentMethods?.paypal.enabled)
      : Boolean(paymentMethods?.bankTransfer.enabled);

  return {
    paymentAvailability,
    paymentMethods,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    selectedMethodAvailable,
    reloadPaymentAvailability,
  };
}
