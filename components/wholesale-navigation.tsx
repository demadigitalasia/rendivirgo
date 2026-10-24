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
  const inFinishedWorkspace = pathname.endsWith(storefrontRoutes.wholesaleCatalog) || pathname.endsWith(storefrontRoutes.wholesaleCheckout);
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
    setHasWholesaleAccess(false);
    setMinimums(null);
    if (!inFinishedWorkspace) return;
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const response = await fetch("/api/customer-account/me", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const profile = response.ok ? await response.json() as { wholesaleAccess?: boolean } : null;
        if (controller.signal.aborted) return;
        setHasWholesaleAccess(profile?.wholesaleAccess === true);
        if (!profile?.wholesaleAccess) { setMinimums(null); return; }
        const minimumResponse = await fetch("/api/wholesale/minimums", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (!controller.signal.aborted) {
          if (minimumResponse.ok) setMinimums(await minimumResponse.json() as WholesaleMinimums);
          else { setMinimums(null); if ([401, 403].includes(minimumResponse.status)) setHasWholesaleAccess(false); }
        }
      } catch { if (!controller.signal.aborted) { setHasWholesaleAccess(false); setMinimums(null); } }
      finally { checking = false; }
    };
    void check();
    const timer = window.setInterval(() => void check(), 30_000);
    window.addEventListener("focus", check);
    window.addEventListener("customer-access-changed", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      controller.abort(); window.clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("customer-access-changed", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [inFinishedWorkspace, pathname]);

  if (!inFinishedWorkspace || !hasWholesaleAccess) return null;

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
