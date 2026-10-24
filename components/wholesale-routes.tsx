"use client";

import Link from "@/components/localized-link";
import { ArrowIcon } from "@/components/icons";
import { useLanguage } from "@/components/providers";
import "./rough-materials.css";

export function WholesaleRoutes() {
  const { language } = useLanguage();
  const id = language === "id";
  return <section className="wholesale-paths page-container">
    <header className="wholesale-paths__heading">
      <p className="eyebrow">RENDI VIRGO · WHOLESALE</p>
      <h1>{id ? "Dua jalur. Satu sumber." : "Two paths. One source."}</h1>
      <p>{id ? "Temukan koleksi siap pakai atau mulai dari bahan mentah. Pilih jalur yang sesuai dengan usaha Anda." : "Find finished pieces for your collection, or start with the raw material. Choose the path that fits your business."}</p>
    </header>
    <div className="wholesale-paths__grid">
      <Link href="/wholesale/finished" className="wholesale-path-card">
        <div className="wholesale-path-card__image"><img src="/images/rendi-virgo-hero-stones.webp" alt={id ? "Batu cabochon poles" : "Polished stone cabochons"} width={2172} height={724} /><span>01 / {id ? "KOLEKSI SIAP PAKAI" : "THE FINISHED COLLECTION"}</span></div>
        <div className="wholesale-path-card__body"><p className="eyebrow">{id ? "UNTUK PEMBELI TERSETUJUI" : "FOR APPROVED TRADE BUYERS"}</p><h2>Finished Products</h2><p>{id ? "Batu poles dan produk pilihan dengan harga khusus wholesale. Masuk dan ajukan akses untuk mulai memesan." : "Polished stones and selected pieces with private wholesale pricing. Sign in and apply for access to start ordering."}</p><div className="wholesale-path-card__facts"><span>{id ? "Akun & persetujuan" : "Account & approval"}</span><span>{id ? "Checkout online" : "Online checkout"}</span></div><strong>{id ? "Jelajahi produk jadi" : "Explore Finished Products"}<ArrowIcon size={19} /></strong></div>
      </Link>
      <Link href="/wholesale/rough" className="wholesale-path-card wholesale-path-card--rough">
        <div className="wholesale-path-card__image"><img src="/images/editorial/stone-forms.webp" alt={id ? "Bongkahan batu alam" : "Natural rough stone material"} width={1536} height={1024} /><span>02 / {id ? "BAHAN DARI ALAM" : "THE RAW POSSIBILITIES"}</span></div>
        <div className="wholesale-path-card__body"><p className="eyebrow">{id ? "AKSES PUBLIK · TANPA LOGIN" : "OPEN ACCESS · NO LOGIN NEEDED"}</p><h2>Rough Materials</h2><p>{id ? "Bahan batu mentah untuk kebutuhan dalam jumlah besar. Hitung kebutuhan dan hubungi tim kami untuk penawaran." : "Natural rough stone for bulk supply. Build your material estimate and speak with our team for a tailored quotation."}</p><div className="wholesale-path-card__facts"><span>{id ? "Minimum 2 ton" : "Minimum 2 metric tons"}</span><span>{id ? "Maksimal 2 bahan" : "Maximum 2 materials"}</span></div><strong>{id ? "Jelajahi bahan mentah" : "Explore Rough Materials"}<ArrowIcon size={19} /></strong></div>
      </Link>
    </div>
    <p className="wholesale-paths__note">{id ? "Butuh bantuan memilih jalur?" : "Need help choosing your path?"} <Link href="/contact">{id ? "Hubungi tim kami" : "Talk to our team"} ↗</Link></p>
  </section>;
}
