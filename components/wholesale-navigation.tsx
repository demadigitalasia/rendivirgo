"use client";

import LocalizedLink from "@/components/localized-link";
import { useCart, useCopy } from "@/components/providers";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { storefrontRoutes } from "@/lib/navigation";

type WholesaleMinimums = { minimumSubtotalUsd: number; minimumPieces: number };

export function WholesaleNavigation() {
  const pathname = usePathname() ?? "/";
  const { lines, hydrated } = useCart();
  const t = useCopy();
  const [hasWholesaleAccess, setHasWholesaleAccess] = useState(false);
  const [minimums, setMinimums] = useState<WholesaleMinimums | null>(null);
  const isCheckout = pathname.endsWith(storefrontRoutes.wholesaleCheckout);
  const wholesaleLines = lines.filter((line) => line.wholesale);
  const wholesaleCount = wholesaleLines.reduce((count, line) => count + line.quantity, 0);
  const wholesaleSubtotal = wholesaleLines.reduce((subtotal, line) => subtotal + line.price * line.quantity, 0);
  const pieceCount = wholesaleLines.reduce((count, line) => {
    const factor = line.wholesalePiecesPerUnit ?? (line.unit === "piece" ? 1 : 0);
    return count + factor * line.quantity;
  }, 0);
  const meetsMinimum = minimums !== null && (wholesaleSubtotal >= minimums.minimumSubtotalUsd || pieceCount >= minimums.minimumPieces);
  const orderHref = wholesaleCount > 0 ? storefrontRoutes.wholesaleCheckout : `${storefrontRoutes.wholesaleCatalog}#wholesale-catalog`;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/customer-account/me", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? await response.json() as { wholesaleAccess?: boolean } : null)
      .then(async (profile) => {
        if (profile?.wholesaleAccess !== true || controller.signal.aborted) return;
        setHasWholesaleAccess(true);
        const response = await fetch("/api/wholesale/minimums", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (response.ok) setMinimums(await response.json() as WholesaleMinimums);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (!hasWholesaleAccess) return null;

  return (
    <div className="wholesale-workspace-nav-wrap">
      <div className="wholesale-workspace-nav page-container">
        <nav className="wholesale-workspace-nav__breadcrumb" aria-label={t.wholesaleNavigation.location}>
          <LocalizedLink href={storefrontRoutes.account}>{t.wholesaleNavigation.account}</LocalizedLink>
          <span aria-hidden="true">/</span>
          <strong>Wholesale</strong>
        </nav>
        <nav className="wholesale-workspace-nav__links" aria-label={t.wholesaleNavigation.navigation}>
          <LocalizedLink href={storefrontRoutes.wholesaleCatalog} aria-current={!isCheckout ? "page" : undefined}>
            {t.wholesaleNavigation.catalog}
          </LocalizedLink>
          <LocalizedLink className="wholesale-workspace-nav__order" href={orderHref} aria-current={isCheckout ? "page" : undefined}>
            <span className="wholesale-workspace-nav__label">
              <span>{wholesaleCount > 0 ? t.wholesaleNavigation.order : t.wholesaleNavigation.startOrder}</span>
              {hydrated && wholesaleCount > 0 && minimums ? (
                <small className={meetsMinimum ? "is-met" : "is-pending"}>
                  {meetsMinimum ? t.wholesaleNavigation.minimumMet : t.wholesaleNavigation.minimumPending}
                </small>
              ) : null}
            </span>
            <span className="wholesale-workspace-nav__count">{hydrated ? wholesaleCount : "—"}</span>
          </LocalizedLink>
          <LocalizedLink href={storefrontRoutes.accountOrders}>{t.wholesaleNavigation.orderHistory}</LocalizedLink>
        </nav>
      </div>
    </div>
  );
}
