"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "@/components/localized-link";
import { useCopy, useLanguage } from "@/components/providers";
import { formatUSD } from "@/lib/catalog";
import { readLastOrder, writeLastOrder } from "@/lib/checkout-recovery";
import type { PaymentMethods, PaymentResult } from "./types";

type CheckoutPaymentResultProps = {
  result: PaymentResult;
  paymentMethods: PaymentMethods | null;
  paymentError: string | null;
  onStartPayment: (orderId: string, orderNumber: string, total: number) => void;
  onProofUploaded: (uploadedAt: string) => void;
  scope?: string;
  continueHref?: string;
};

export function CheckoutPaymentResult({
  result,
  paymentMethods,
  paymentError,
  onStartPayment,
  onProofUploaded,
  scope,
  continueHref = "/shop",
}: CheckoutPaymentResultProps) {
  const t = useCopy();
  const { language } = useLanguage();
  const dateLocale = language === "id" ? "id-ID" : "en-GB";
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [proofUploadError, setProofUploadError] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);

  const uploadBankTransferProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (result.paymentMethod !== "BankTransfer" || !paymentProof) return;
    if (paymentProof.size > 8 * 1024 * 1024) {
      setProofUploadError(t.checkout.proofTooLarge);
      return;
    }

    const orderEmail = readLastOrder(scope)?.email;
    if (!orderEmail) {
      setProofUploadError(t.checkout.proofUploadFailed);
      return;
    }

    setUploadingProof(true);
    setProofUploadError(null);
    try {
      const formData = new FormData();
      formData.append("email", orderEmail);
      formData.append("file", paymentProof);
      const response = await fetch("/api/payments/bank-transfer/" + encodeURIComponent(result.orderId) + "/proof", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        uploadedAt?: string;
        message?: string | string[];
      };
      if (!response.ok || !payload.uploadedAt) {
        const message = Array.isArray(payload.message) ? payload.message.join(", ") : payload.message;
        throw new Error(message || t.checkout.proofUploadFailed);
      }

      const stored = readLastOrder(scope);
      if (stored?.orderId === result.orderId) {
        writeLastOrder({ ...stored, paymentProofUploadedAt: payload.uploadedAt }, scope);
      }
      onProofUploaded(payload.uploadedAt);
      setPaymentProof(null);
      if (proofInputRef.current) proofInputRef.current.value = "";
    } catch (caught) {
      setProofUploadError(language === "id" ? t.checkout.proofUploadFailed : caught instanceof Error ? caught.message : t.checkout.proofUploadFailed);
    } finally {
      setUploadingProof(false);
    }
  };

  const paid = result.paymentStatus === "Paid";
  const isBankTransfer = result.paymentMethod === "BankTransfer";
  const isTerminal = result.orderStatus === "Cancelled" || result.orderStatus === "Returned";
  const canRetry =
    !isBankTransfer &&
    !isTerminal &&
    (result.retryAllowed ??
      (result.notice === "cancelled" ||
        result.notice === "failed" ||
        result.notice === "unavailable" ||
        result.notice === "recovered"));
  const pendingMessage = isBankTransfer && result.notice === "expired"
    ? t.checkout.paymentExpired
    : isTerminal
      ? t.checkout.paymentTerminalReview
      : isBankTransfer
        ? result.paymentProofUploadedAt
          ? t.checkout.bankTransferProofPending
          : t.checkout.bankTransferPending
        : result.notice === "unavailable"
          ? t.checkout.paypalUnavailable
          : result.notice === "cancelled"
            ? t.checkout.paymentCancelled
            : result.notice === "review"
              ? t.checkout.paymentPendingReview
              : result.notice === "expired"
                ? t.checkout.paymentExpired
                : result.notice === "failed"
                  ? t.checkout.paymentFailed
                  : t.checkout.successPending;

  return (
    <div className="page-container content-page">
      <div className="success-state">
        <div className="eyebrow">{paid ? t.checkout.successEyebrow : t.checkout.pendingEyebrow}</div>
        <h2>{result.orderNumber ? t.checkout.successOrder(result.orderNumber) : t.checkout.successTitle}</h2>
        <p>{paid ? t.checkout.successPaid : pendingMessage}</p>
        {paid ? <p style={{ marginTop: 8 }}>{t.checkout.ordersEmailNote}</p> : null}
        {paymentError ? <p className="form-status form-status--error" role="alert">{paymentError}</p> : null}
        {result.total > 0 ? <p style={{ marginTop: 12 }}><strong>{formatUSD(result.total, language)}</strong></p> : null}
        {!paid && isBankTransfer && result.notice !== "expired" && !isTerminal ? (
          <section className="bank-transfer-panel" aria-labelledby="bank-transfer-title">
            <h3 id="bank-transfer-title">{t.checkout.bankTransferTitle}</h3>
            <p>{t.checkout.transferExactAmount}</p>
            <dl className="bank-transfer-details">
              <div><dt>{t.checkout.bankName}</dt><dd>{paymentMethods?.bankTransfer.bankName || "—"}</dd></div>
              {paymentMethods?.bankTransfer.accountName ? (
                <div><dt>{t.checkout.accountName}</dt><dd>{paymentMethods.bankTransfer.accountName}</dd></div>
              ) : null}
              <div><dt>{t.checkout.accountNumber}</dt><dd>{paymentMethods?.bankTransfer.accountNumber || "—"}</dd></div>
              <div><dt>{t.checkout.swiftCode}</dt><dd>{paymentMethods?.bankTransfer.swiftCode || "—"}</dd></div>
              <div><dt>{t.checkout.transferAmount}</dt><dd><strong>{formatUSD(result.total, language)}</strong></dd></div>
            </dl>
            {result.paymentProofUploadedAt ? (
              <p className="form-status form-status--success" role="status">
                {t.checkout.proofReceived(new Date(result.paymentProofUploadedAt).toLocaleString(dateLocale))}
              </p>
            ) : null}
            <form className="bank-transfer-upload" onSubmit={(event) => void uploadBankTransferProof(event)}>
              <label htmlFor="bank-transfer-proof">{t.checkout.uploadProof}</label>
              <input
                ref={proofInputRef}
                id="bank-transfer-proof"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                required
                onChange={(event) => {
                  setPaymentProof(event.target.files?.[0] ?? null);
                  setProofUploadError(null);
                }}
              />
              <span className="muted">{t.checkout.proofImageHint}</span>
              {proofUploadError ? <span className="form-status form-status--error" role="alert">{proofUploadError}</span> : null}
              <button className="button" type="submit" disabled={uploadingProof || !paymentProof}>
                {uploadingProof
                  ? t.checkout.uploadingProof
                  : result.paymentProofUploadedAt
                    ? t.checkout.replaceProof
                    : t.checkout.submitProof}
              </button>
            </form>
          </section>
        ) : null}
        {!paid && canRetry && result.orderId ? (
          <button
            type="button"
            className="button"
            style={{ marginTop: 18 }}
            onClick={() => onStartPayment(result.orderId, result.orderNumber, result.total)}
          >
            {result.notice === "failed" ? t.checkout.retryPayment : t.checkout.payNow(formatUSD(result.total, language))}
          </button>
        ) : null}
        {result.orderNumber ? (
          <p style={{ marginTop: 14 }}>
            <Link
              href={"/track?order=" + encodeURIComponent(result.orderNumber) + "&email=" + encodeURIComponent(readLastOrder(scope)?.email ?? "")}
              className="text-button"
            >
              {t.footer.track}
            </Link>
          </p>
        ) : null}
        <Link href={continueHref} className="button" style={{ marginTop: 18}}>
          {t.checkout.continue}
        </Link>
      </div>
    </div>
  );
}
