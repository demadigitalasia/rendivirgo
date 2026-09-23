"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";
import { Toaster, toast } from "./toast";

type NavItem = { href: string; label: string; exact?: boolean; badge?: number };

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
  const [signingOut, setSigningOut] = useState(false);

  const loadUnread = useCallback(() => {
    apiFetch<{ count: number }>("/api/admin/notifications/unread-count")
      .then((result) => setUnread(result.count))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 60_000);
    return () => clearInterval(interval);
  }, [loadUnread]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

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
        { href: "/admin/messages", label: "Inbox", badge: unread },
        { href: "/admin/reports", label: "Reports" },
        { href: "/admin/settings", label: "Settings" },
        { href: "/admin/settings/shipping", label: "Shipping" },
        { href: "/admin/system", label: "System & audit" },
      ],
    },
  ];

  return (
    <div className="rv-admin">
      <aside className={navOpen ? "rv-sidebar is-open" : "rv-sidebar"}>
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
                >
                  {item.label}
                  {item.badge ? <span className="rv-nav-item__badge">{item.badge}</span> : null}
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

      <div className="rv-main">
        <button
          className="rv-btn rv-btn--sm rv-mobile-nav-toggle"
          type="button"
          style={{ position: "fixed", bottom: 18, left: 18, zIndex: 75 }}
          onClick={() => setNavOpen((value) => !value)}
        >
          {navOpen ? "Close menu" : "Menu"}
        </button>
        {children}
      </div>
      <Toaster />
    </div>
  );
}
