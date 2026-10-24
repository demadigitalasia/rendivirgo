"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart, useCopy, useLanguage } from "@/components/providers";
import { ArrowIcon, ArrowUpRightIcon, BagIcon, ChevronIcon, CloseIcon, GlobeIcon, HeartIcon, MenuIcon, SearchIcon, SparkleIcon } from "@/components/icons";
import { LocalizedLink as Link } from "@/components/localized-link";
import { localizedPath, stripLocalePrefix, type Language } from "@/lib/locale";
import { isStorefrontRouteActive, storefrontRoutes } from "@/lib/navigation";

type ShopNavCategory = { slug: string; name: string };

function LanguageSwitch({
  className = "",
  languages,
  onSelect,
}: {
  className?: string;
  languages: Language[];
  onSelect: (language: Language) => void;
}) {
  const { language } = useLanguage();
  const t = useCopy();
  return (
    <div className={`language-switch ${className}`} role="group" aria-label={t.nav.language}>
      <GlobeIcon />
      {languages.includes("en") ? <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => onSelect("en")}>English</button> : null}
      {languages.includes("en") && languages.includes("id") ? <span aria-hidden="true">/</span> : null}
      {languages.includes("id") ? <button type="button" lang="id" aria-pressed={language === "id"} onClick={() => onSelect("id")}>Bahasa Indonesia</button> : null}
    </div>
  );
}

export function SiteHeader({ languages, categories }: { languages: Language[]; categories: ShopNavCategory[] }) {
  const t = useCopy();
  const { itemCount } = useCart();
  const { language, setLanguage } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const shopMenuButtonRef = useRef<HTMLButtonElement>(null);
  const selectLanguage = async (nextLanguage: Language) => {
    if (nextLanguage === language) return;
    const response = await fetch("/api/language", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ language: nextLanguage }),
    });
    if (!response.ok) return;
    setLanguage(nextLanguage);
    router.replace(`${localizedPath(window.location.pathname, nextLanguage)}${window.location.search}`, { scroll: false });
  };
  const navItems = [
    { href: storefrontRoutes.home, label: t.nav.home },
    { href: storefrontRoutes.about, label: t.nav.about },
    { href: storefrontRoutes.journal, label: t.nav.blog },
    { href: storefrontRoutes.contact, label: t.nav.contact },
    { href: storefrontRoutes.account, label: t.nav.account },
  ];
  const routePath = stripLocalePrefix(pathname);
  const shopActive = isStorefrontRouteActive(routePath, storefrontRoutes.shop);
  const shopCategories = categories.slice(0, 6);

  useEffect(() => {
    if (menuOpen) navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen && !shopMenuOpen && !searchOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (searchOpen) { setSearchOpen(false); searchButtonRef.current?.focus({ preventScroll: true }); }
      if (shopMenuOpen) { setShopMenuOpen(false); shopMenuButtonRef.current?.focus({ preventScroll: true }); }
      if (menuOpen) { setMenuOpen(false); menuButtonRef.current?.focus({ preventScroll: true }); }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setMenuOpen(false);
        setShopMenuOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen, searchOpen, shopMenuOpen]);

  useEffect(() => { setMenuOpen(false); setShopMenuOpen(false); setSearchOpen(false); }, [pathname]);

  useEffect(() => {
    const compact = window.matchMedia("(max-width: 980px)");
    const onResize = () => {
      setMenuOpen(false);
      setShopMenuOpen(false);
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
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) { setMenuOpen(false); setShopMenuOpen(false); setSearchOpen(false); }
    }}>
      <div className="announcement-bar">
        <div className="announcement-message"><span>{t.announcement.authentic}</span><i aria-hidden="true" /><span>{t.announcement.worldwide}</span></div>
        <LanguageSwitch className="announcement-language" languages={languages} onSelect={(next) => void selectLanguage(next)} />
      </div>
      <div className="site-header">
        <Link href="/" className="brand-lockup" aria-label="RENDI VIRGO">
          <Image src="/brand/rendi-virgo-primary.webp" alt="RENDI VIRGO" width={780} height={260}
            sizes="(max-width: 370px) 136px, (max-width: 980px) 144px, 184px" loading="eager" />
        </Link>
        <nav ref={navRef} id="primary-navigation" className={`main-nav ${menuOpen ? "is-open" : ""}`} aria-label={t.nav.primary}>
          <Link href={navItems[0].href} className={`nav-link ${isStorefrontRouteActive(routePath, navItems[0].href) ? "is-active" : ""}`}
            aria-current={isStorefrontRouteActive(routePath, navItems[0].href) ? "page" : undefined}
            onClick={() => { setMenuOpen(false); setShopMenuOpen(false); }}>{navItems[0].label}</Link>
          <div className={`main-nav__shop${shopMenuOpen ? " is-open" : ""}`}>
            <Link href={storefrontRoutes.shop} className={`nav-link${shopActive ? " is-active" : ""}`}
              aria-current={shopActive ? "page" : undefined}
              onClick={() => { setMenuOpen(false); setShopMenuOpen(false); }}>{t.nav.shop}</Link>
            <button
              ref={shopMenuButtonRef}
              type="button"
              className="main-nav__shop-toggle"
              aria-label={shopMenuOpen ? t.nav.closeShopCategories : t.nav.openShopCategories}
              aria-expanded={shopMenuOpen}
              aria-controls="shop-category-navigation"
              onClick={() => setShopMenuOpen((open) => !open)}
            >
              <ChevronIcon size={14} />
            </button>
            <div id="shop-category-navigation" className="main-nav__shop-panel" hidden={!shopMenuOpen}>
              <div className="main-nav__shop-panel-head">
                <p className="main-nav__shop-heading">{t.nav.shopCategories}</p>
                <span className="main-nav__shop-panel-mark"><SparkleIcon size={15} /></span>
              </div>
              <div className="main-nav__shop-links">
                {shopCategories.map((category) => {
                  const categoryPath = `${storefrontRoutes.shop}/${category.slug}`;
                  const active = isStorefrontRouteActive(routePath, categoryPath);
                  return <Link key={category.slug} href={categoryPath} aria-current={active ? "page" : undefined}
                    onClick={() => { setMenuOpen(false); setShopMenuOpen(false); }}><span>{category.name}</span><ArrowUpRightIcon size={13} /></Link>;
                })}
              </div>
              <Link className="main-nav__shop-all" href={storefrontRoutes.shop} aria-current={routePath === storefrontRoutes.shop ? "page" : undefined}
                onClick={() => { setMenuOpen(false); setShopMenuOpen(false); }}>{t.nav.shopAll}<ArrowIcon size={15} /></Link>
            </div>
          </div>
          <Link href={storefrontRoutes.wholesaleHome} className={`nav-link ${isStorefrontRouteActive(routePath, storefrontRoutes.wholesaleHome) ? "is-active" : ""}`}
            aria-current={isStorefrontRouteActive(routePath, storefrontRoutes.wholesaleHome) ? "page" : undefined}
            onClick={() => { setMenuOpen(false); setShopMenuOpen(false); }}>{t.nav.wholesale}</Link>
          {navItems.slice(1).map(({ href, label }) => {
            const active = isStorefrontRouteActive(routePath, href);
            return <Link key={href} href={href} className={`nav-link ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined} onClick={() => { setMenuOpen(false); setShopMenuOpen(false); }}>{label}</Link>;
          })}
          <Link className="mobile-wishlist nav-link" href="/wishlist" onClick={() => setMenuOpen(false)}>{t.nav.wishlist}<HeartIcon /></Link>
          <div className="mobile-nav-language"><span>{t.nav.language}</span><LanguageSwitch languages={languages} onSelect={(next) => void selectLanguage(next)} /></div>
        </nav>
        <div className="header-actions">
          <button ref={searchButtonRef} type="button" className="icon-button"
            onClick={() => { setSearchOpen((value) => !value); setMenuOpen(false); setShopMenuOpen(false); }}
            aria-label={t.nav.search} aria-expanded={searchOpen} aria-controls="site-search"><SearchIcon /></button>
          <Link className="icon-button header-wishlist" href="/wishlist" aria-label={t.nav.wishlist}><HeartIcon /></Link>
          <Link className="icon-button icon-button--bag" href="/cart" aria-label={itemCount > 0 ? `${t.nav.cart} (${itemCount})` : t.nav.cart}>
            <BagIcon />{itemCount > 0 && <span aria-hidden="true">{itemCount}</span>}
          </Link>
          <button ref={menuButtonRef} type="button" className="mobile-menu-button"
            onClick={() => { setMenuOpen((value) => !value); setSearchOpen(false); setShopMenuOpen(false); }}
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
