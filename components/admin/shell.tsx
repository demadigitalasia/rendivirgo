"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BookOpenText,
  ChartColumn,
  ClipboardList,
  Files,
  FolderTree,
  House,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquareQuote,
  NotebookTabs,
  Package,
  PanelsTopLeft,
  Percent,
  Pickaxe,
  ReceiptText,
  Scissors,
  SearchCheck,
  Settings2,
  ShieldCheck,
  Star,
  Store,
  Truck,
  TriangleAlert,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "./api";
import { Toaster, toast } from "./toast";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number; warning?: string };

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
  const adminInitials = admin.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "A";

  const groups: NavGroup[] = [
    {
      label: "Overview",
      items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Catalog",
      items: [
        { href: "/admin/products", label: "Products", icon: Package },
        { href: "/admin/categories", label: "Categories", icon: FolderTree },
        { href: "/admin/conditions", label: "Conditions", icon: ShieldCheck },
        { href: "/admin/catalog", label: "PDF catalog", icon: BookOpenText },
      ],
    },
    {
      label: "Sales",
      items: [
        { href: "/admin/pos", label: "Workshop POS", icon: ReceiptText },
        { href: "/admin/orders", label: "Orders", icon: ClipboardList },
        { href: "/admin/customers", label: "Customers", icon: UsersRound },
        { href: "/admin/wholesale", label: "Wholesale", icon: Store },
        { href: "/admin/rough-materials", label: "Rough Materials", icon: Pickaxe },
        { href: "/admin/lapidary/requests", label: "Lapidary requests", icon: Scissors },
        { href: "/admin/discounts", label: "Discounts", icon: Percent },
      ],
    },
    {
      label: "Content",
      items: [
        { href: "/admin/seo", label: "SEO Audit", icon: SearchCheck },
        { href: "/admin/content/home", label: "Home page", icon: House },
        { href: "/admin/content/navigation", label: "Navigation", icon: Menu },
        { href: "/admin/content/blog", label: "Blog", icon: NotebookTabs },
        { href: "/admin/content/pages", label: "Pages", icon: Files },
        { href: "/admin/content/testimonials", label: "Testimonials", icon: MessageSquareQuote },
        { href: "/admin/content/banners", label: "Banners", icon: ImageIcon },
        { href: "/admin/lapidary/content", label: "Lapidary content", icon: PanelsTopLeft },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/admin/messages", label: "Inbox", icon: Inbox, badge: unread, warning: unreadSyncError ? "Inbox count unavailable" : undefined },
        { href: "/admin/reviews", label: "Reviews", icon: Star },
        { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
        { href: "/admin/reports", label: "Reports", icon: ChartColumn },
        { href: "/admin/settings", label: "Settings", icon: Settings2, exact: true },
        { href: "/admin/settings/shipping", label: "Shipping", icon: Truck },
        { href: "/admin/system", label: "System & audit", icon: Activity },
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
          <Link href="/admin" aria-label="RENDI VIRGO admin dashboard">
            <Image
              src="/brand/rendi-virgo-primary.png"
              alt="RENDI VIRGO"
              width={780}
              height={260}
              sizes="184px"
              priority
            />
          </Link>
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
                  <item.icon className="rv-nav-item__icon" size={18} strokeWidth={1.7} aria-hidden="true" />
                  <span className="rv-nav-item__label">{item.label}</span>
                  {item.badge ? <span className="rv-nav-item__badge">{item.badge}</span> : null}
                  {item.warning ? <span className="rv-nav-item__warning" title={item.warning} aria-label={item.warning}><TriangleAlert size={14} strokeWidth={1.7} aria-hidden="true" /></span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="rv-sidebar__footer">
          <div className="rv-sidebar__account">
            <span className="rv-sidebar__account-avatar" aria-hidden="true">{adminInitials}</span>
            <div className="rv-sidebar__account-copy">
              <strong>{admin.name}</strong>
              <span>{admin.email}</span>
            </div>
          </div>
          <div className="rv-sidebar__actions">
            <Link
              className="rv-btn rv-btn--sm"
              href="/"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="View store in a new tab"
            >
              <Store size={15} strokeWidth={1.7} aria-hidden="true" />
              <span>Store</span>
              <span className="rv-sr-only">in a new tab</span>
              <ArrowUpRight className="rv-sidebar__action-external" size={12} strokeWidth={1.7} aria-hidden="true" />
            </Link>
            <button
              className="rv-btn rv-btn--sm"
              type="button"
              onClick={signOut}
              disabled={signingOut}
            >
              <LogOut size={15} strokeWidth={1.7} aria-hidden="true" />
              <span>{signingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="rv-main">
        <div className="rv-mobile-admin-bar">
          <button
            ref={navToggleRef}
            className="rv-btn rv-btn--sm rv-mobile-nav-toggle"
            type="button"
            aria-expanded={navOpen}
            aria-controls="admin-navigation"
            onClick={() => setNavOpen((value) => !value)}
          >
            {navOpen ? <X size={17} strokeWidth={1.7} aria-hidden="true" /> : <Menu size={17} strokeWidth={1.7} aria-hidden="true" />}
            {navOpen ? "Close menu" : "Menu"}
          </button>
          <span className="rv-mobile-admin-bar__label">RENDI VIRGO · Admin workspace</span>
        </div>
        {children}
      </main>
      <Toaster />
    </div>
  );
}
