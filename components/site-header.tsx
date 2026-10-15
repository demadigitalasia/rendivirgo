"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart, useCopy, useLanguage } from "@/components/providers";
import { ArrowIcon, BagIcon, CloseIcon, GlobeIcon, HeartIcon, MenuIcon, SearchIcon } from "@/components/icons";

function LanguageSwitch({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();
  const t = useCopy();
  return (
    <div className={`language-switch ${className}`} role="group" aria-label={t.nav.language}>
      <GlobeIcon />
      <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</button>
      <span aria-hidden="true">/</span>
      <button type="button" lang="id" aria-pressed={language === "id"} onClick={() => setLanguage("id")}>Bahasa Indonesia</button>
    </div>
  );
}

export function SiteHeader() {
  const t = useCopy();
  const { itemCount } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const navItems = [
    { href: "/", label: t.nav.home },
    { href: "/shop", label: t.nav.shop },
    { href: "/about-us", label: t.nav.about },
    { href: "/blog", label: t.nav.blog },
    { href: "/contact", label: t.nav.contact },
  ];

  useEffect(() => {
    if (menuOpen) navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (searchOpen) { setSearchOpen(false); searchButtonRef.current?.focus({ preventScroll: true }); }
      if (menuOpen) { setMenuOpen(false); menuButtonRef.current?.focus({ preventScroll: true }); }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen, searchOpen]);

  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [pathname]);

  useEffect(() => {
    const compact = window.matchMedia("(max-width: 980px)");
    const onResize = () => {
      setMenuOpen(false);
      if (!compact.matches && document.activeElement?.closest(".mobile-nav-language")) {
        navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
      }
    };
    compact.addEventListener("change", onResize);
    return () => compact.removeEventListener("change", onResize);
  }, []);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    setSearchOpen(false);
    setMenuOpen(false);
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };

  return (
    <header className="storefront-header" ref={headerRef} onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) { setMenuOpen(false); setSearchOpen(false); }
    }}>
      <div className="announcement-bar">
        <div className="announcement-message"><span>{t.announcement.authentic}</span><i aria-hidden="true" /><span>{t.announcement.worldwide}</span></div>
        <LanguageSwitch className="announcement-language" />
      </div>
      <div className="site-header">
        <Link href="/" className="brand-lockup" aria-label="RENDI VIRGO">
          <Image src="/brand/rendi-virgo-logo.webp" alt="RENDI VIRGO" width={780} height={260}
            sizes="(max-width: 370px) 136px, (max-width: 980px) 144px, 184px" loading="eager" />
        </Link>
        <nav ref={navRef} id="primary-navigation" className={`main-nav ${menuOpen ? "is-open" : ""}`} aria-label={t.nav.primary}>
          {navItems.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} className={`nav-link ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}>{label}</Link>;
          })}
          <Link className="mobile-wishlist nav-link" href="/wishlist" onClick={() => setMenuOpen(false)}>{t.nav.wishlist}<HeartIcon /></Link>
          <div className="mobile-nav-language"><span>{t.nav.language}</span><LanguageSwitch /></div>
        </nav>
        <div className="header-actions">
          <button ref={searchButtonRef} type="button" className="icon-button"
            onClick={() => { setSearchOpen((value) => !value); setMenuOpen(false); }}
            aria-label={t.nav.search} aria-expanded={searchOpen} aria-controls="site-search"><SearchIcon /></button>
          <Link className="icon-button header-wishlist" href="/wishlist" aria-label={t.nav.wishlist}><HeartIcon /></Link>
          <Link className="icon-button icon-button--bag" href="/cart" aria-label={itemCount > 0 ? `${t.nav.cart} (${itemCount})` : t.nav.cart}>
            <BagIcon />{itemCount > 0 && <span aria-hidden="true">{itemCount}</span>}
          </Link>
          <button ref={menuButtonRef} type="button" className="mobile-menu-button"
            onClick={() => { setMenuOpen((value) => !value); setSearchOpen(false); }}
            aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu} aria-expanded={menuOpen} aria-controls="primary-navigation">
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      {searchOpen && (
        <div className="search-panel" id="site-search">
          <form className="page-container search-panel__inner" role="search" onSubmit={submitSearch}>
            <SearchIcon />
            <input autoFocus type="search" name="q" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.nav.searchPlaceholder} aria-label={t.nav.search} />
            <button type="submit" aria-label={t.nav.search}><ArrowIcon /></button>
            <button type="button" onClick={() => { setSearchOpen(false); searchButtonRef.current?.focus(); }} aria-label={t.nav.closeSearch}><CloseIcon /></button>
          </form>
        </div>
      )}
    </header>
  );
}
