"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./api";
import { Toaster, toast } from "./toast";

type NavItem = { href: string; label: string; exact?: boolean; badge?: number; warning?: string };

type NavGroup = { label: string; items: NavItem[] };

export function AdminShell({
  admin,
  children,
}: {
  admin: { name: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadSyncError, setUnreadSyncError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const navToggleRef = useRef<HTMLButtonElement>(null);

  const loadUnread = useCallback(() => {
    apiFetch<{ unreadCount: number }>("/api/admin/notifications/unread-count")
      .then((result) => {
        setUnread(result.unreadCount ?? 0);
        setUnreadSyncError(false);
      })
      .catch(() => setUnreadSyncError(true));
  }, []);

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 60_000);
    return () => clearInterval(interval);
  }, [loadUnread]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const firstLink = navRef.current?.querySelector<HTMLAnchorElement>("a");
    firstLink?.focus();

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setNavOpen(false);
        return;
      }
      if (event.key !== "Tab" || !navRef.current) return;
      const focusable = [...navRef.current.querySelectorAll<HTMLElement>("a, button")].filter(
        (element) => !element.hasAttribute("disabled"),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
      navToggleRef.current?.focus();
    };
  }, [navOpen]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out");
    } finally {
      setSigningOut(false);
    }
  };

  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

  const groups: NavGroup[] = [
    {
      label: "Overview",
      items: [{ href: "/admin", label: "Dashboard", exact: true }],
    },
    {
      label: "Catalog",
      items: [
        { href: "/admin/products", label: "Products" },
        { href: "/admin/categories", label: "Categories" },
        { href: "/admin/catalog", label: "PDF catalog" },
      ],
    },
    {
      label: "Sales",
      items: [
        { href: "/admin/orders", label: "Orders" },
        { href: "/admin/customers", label: "Customers" },
        { href: "/admin/discounts", label: "Discounts" },
      ],
    },
    {
      label: "Content",
      items: [
        { href: "/admin/content/home", label: "Home page" },
        { href: "/admin/content/blog", label: "Blog" },
        { href: "/admin/content/pages", label: "Pages" },
        { href: "/admin/content/testimonials", label: "Testimonials" },
        { href: "/admin/content/banners", label: "Banners" },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/admin/messages", label: "Inbox", badge: unread, warning: unreadSyncError ? "Inbox count unavailable" : undefined },
        { href: "/admin/reviews", label: "Reviews" },
        { href: "/admin/newsletter", label: "Newsletter" },
        { href: "/admin/reports", label: "Reports" },
        { href: "/admin/settings", label: "Settings" },
        { href: "/admin/settings/shipping", label: "Shipping" },
        { href: "/admin/system", label: "System & audit" },
      ],
    },
  ];

  return (
    <div className="rv-admin">
      {navOpen ? (
        <button
          className="rv-sidebar-backdrop"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <aside
        id="admin-navigation"
        ref={navRef}
        className={navOpen ? "rv-sidebar is-open" : "rv-sidebar"}
        aria-label="Admin navigation"
      >
        <div className="rv-sidebar__brand">
          <strong>RENDI VIRGO</strong>
          <span>Admin workspace</span>
        </div>
        <nav className="rv-sidebar__nav" aria-label="Admin sections">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="rv-nav-group">{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive(item) ? "rv-nav-item is-active" : "rv-nav-item"}
                  aria-current={isActive(item) ? "page" : undefined}
                >
                  {item.label}
                  {item.badge ? <span className="rv-nav-item__badge">{item.badge}</span> : null}
                  {item.warning ? <span className="rv-nav-item__warning" title={item.warning} aria-label={item.warning}>!</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="rv-sidebar__footer">
          <strong>{admin.name}</strong>
          <span>{admin.email}</span>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <Link className="rv-btn rv-btn--sm" href="/" target="_blank">
              View store
            </Link>
            <button className="rv-btn rv-btn--sm" type="button" onClick={signOut} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </aside>

      <main className="rv-main">
        <button
          ref={navToggleRef}
          className="rv-btn rv-btn--sm rv-mobile-nav-toggle"
          type="button"
          aria-expanded={navOpen}
          aria-controls="admin-navigation"
          style={{ position: "fixed", bottom: 18, left: 18, zIndex: 75 }}
          onClick={() => setNavOpen((value) => !value)}
        >
          {navOpen ? "Close menu" : "Menu"}
        </button>
        {children}
      </main>
      <Toaster />
    </div>
  );
}
