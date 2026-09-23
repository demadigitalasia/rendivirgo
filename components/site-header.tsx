"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart, useCopy, useLanguage } from "@/components/providers";
import { ArrowIcon, BagIcon, CloseIcon, GlobeIcon, MenuIcon, SearchIcon } from "@/components/icons";

export function SiteHeader() {
  const { language, setLanguage } = useLanguage();
  const t = useCopy();
  const { itemCount } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const navClass = (href: string) =>
    `nav-link ${href === "/" ? pathname === "/" : pathname.startsWith(href) ? "is-active" : ""}`;

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (searchOpen) {
        setSearchOpen(false);
        searchButtonRef.current?.focus();
      }
      if (menuOpen) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, searchOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    setSearchOpen(false);
    setMenuOpen(false);
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };

  return (
    <header>
      <div className="announcement-bar">
        <span>{t.announcement.authentic}</span>
        <i />
        <span>{t.announcement.worldwide}</span>
        <div className="announcement-language">
          <GlobeIcon />
          <button
            type="button"
            lang="en"
            className={language === "en" ? "is-active" : ""}
            aria-pressed={language === "en"}
            onClick={() => setLanguage("en")}
          >
            English
          </button>
          <span aria-hidden="true">/</span>
          <button
            type="button"
            lang="id"
            className={language === "id" ? "is-active" : ""}
            aria-pressed={language === "id"}
            onClick={() => setLanguage("id")}
          >
            Bahasa Indonesia
          </button>
        </div>
      </div>
      <div className="site-header">
        <Link href="/" className="brand-lockup" aria-label="RENDI VIRGO">
          <Image
            src="/brand/rendi-virgo-logo.webp"
            alt="RENDI VIRGO"
            width={780}
            height={260}
            sizes="(max-width: 720px) 155px, 260px"
            loading="eager"
          />
        </Link>
        <nav id="primary-navigation" className={`main-nav ${menuOpen ? "is-open" : ""}`} aria-label={t.nav.primary}>
          <Link href="/" className={navClass("/")} onClick={() => setMenuOpen(false)}>
            {t.nav.home}
          </Link>
          <Link href="/shop" className={navClass("/shop")} onClick={() => setMenuOpen(false)}>
            {t.nav.shop}
          </Link>
          <Link href="/about-us" className={navClass("/about-us")} onClick={() => setMenuOpen(false)}>
            {t.nav.about}
          </Link>
          <Link href="/blog" className={navClass("/blog")} onClick={() => setMenuOpen(false)}>
            {t.nav.blog}
          </Link>
          <Link href="/contact" className={navClass("/contact")} onClick={() => setMenuOpen(false)}>
            {t.nav.contact}
          </Link>
        </nav>
        <div className="header-actions">
          <button
            ref={searchButtonRef}
            type="button"
            className="icon-button"
            onClick={() => setSearchOpen((value) => !value)}
            aria-label={t.nav.search}
            aria-expanded={searchOpen}
            aria-controls="site-search"
          >
            <SearchIcon />
          </button>
          <Link
            className="icon-button icon-button--bag"
            href="/cart"
            aria-label={itemCount > 0 ? `${t.nav.cart} (${itemCount})` : t.nav.cart}
          >
            <BagIcon />
            {itemCount > 0 && <span aria-hidden="true">{itemCount}</span>}
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            className="mobile-menu-button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      {searchOpen && (
        <div className="search-panel" id="site-search">
          <form className="page-container search-panel__inner" role="search" onSubmit={submitSearch}>
            <SearchIcon />
            <input
              autoFocus
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.nav.searchPlaceholder}
              aria-label={t.nav.search}
            />
            <button type="submit" aria-label={t.nav.search}>
              <ArrowIcon />
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                searchButtonRef.current?.focus();
              }}
              aria-label={t.nav.closeSearch}
            >
              <CloseIcon />
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
