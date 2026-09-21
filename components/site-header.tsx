"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart, useLanguage } from "@/components/providers";
import { BagIcon, CloseIcon, MenuIcon, SearchIcon } from "@/components/icons";

const copy = {
  en: { home: "Home", shop: "Shop", about: "About Us", blog: "Blog", contact: "Contact", search: "Search" },
  id: { home: "Beranda", shop: "Belanja", about: "Tentang Kami", blog: "Jurnal", contact: "Kontak", search: "Cari" },
};

export function SiteHeader() {
  const { language, setLanguage } = useLanguage();
  const { itemCount } = useCart();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const t = copy[language];
  const navClass = (href: string) => `nav-link ${href === "/" ? pathname === "/" : pathname.startsWith(href) ? "is-active" : ""}`;

  return (
    <>
      <div className="announcement-bar">
        <span>Authentic Indonesian Stones</span><i /> <span>Worldwide Shipping</span>
        <div className="announcement-language">
          <button className={language === "en" ? "is-active" : ""} onClick={() => setLanguage("en")}>English</button>
          <span>/</span>
          <button className={language === "id" ? "is-active" : ""} onClick={() => setLanguage("id")}>Bahasa Indonesia</button>
        </div>
      </div>
      <header className="site-header">
        <Link href="/" className="brand-lockup" onClick={() => setMenuOpen(false)}>
          <img src="/brand/rendi-virgo-logo.png" alt="RENDI VIRGO" />
        </Link>
        <nav className={`main-nav ${menuOpen ? "is-open" : ""}`} aria-label="Primary navigation">
          <Link href="/" className={navClass("/")} onClick={() => setMenuOpen(false)}>{t.home}</Link>
          <Link href="/shop" className={navClass("/shop")} onClick={() => setMenuOpen(false)}>{t.shop}</Link>
          <Link href="/about-us" className={navClass("/about-us")} onClick={() => setMenuOpen(false)}>{t.about}</Link>
          <Link href="/blog" className={navClass("/blog")} onClick={() => setMenuOpen(false)}>{t.blog}</Link>
          <Link href="/contact" className={navClass("/contact")} onClick={() => setMenuOpen(false)}>{t.contact}</Link>
        </nav>
        <div className="header-actions">
          <button className="icon-button" onClick={() => setSearchOpen((value) => !value)} aria-label={t.search} aria-expanded={searchOpen}><SearchIcon /></button>
          <Link className="icon-button icon-button--bag" href="/cart" aria-label="Shopping cart"><BagIcon />{itemCount > 0 && <span>{itemCount}</span>}</Link>
          <button className="mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}>{menuOpen ? <CloseIcon /> : <MenuIcon />}</button>
        </div>
      </header>
      {searchOpen && <div className="search-panel"><div className="page-container search-panel__inner"><SearchIcon /><input autoFocus placeholder={`${t.search} the collection`} /><button onClick={() => setSearchOpen(false)} aria-label="Close search"><CloseIcon /></button></div></div>}
    </>
  );
}
