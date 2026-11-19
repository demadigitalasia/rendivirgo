# Audit SEO RENDI VIRGO — 20 November 2026

## Ringkasan

Sejak audit sebelumnya (26 Oktober 2026), fondasi teknis RENDI VIRGO membaik nyata. Perbaikan yang terverifikasi live: redirect permanen `www` → apex (308), redirect `/id` → `/` (308), halaman `/lapidary/artists` kini `noindex, follow` dan dikeluarkan dari sitemap lewat filter kondisional, title blog paginasi sudah memuat "Page N", halaman keranjang/checkout/akun/wishlist/track semuanya `noindex`, serta structured data produk yang lengkap (Product + Offer + harga + ketersediaan + BreadcrumbList) dan Article + BreadcrumbList di blog. Lighthouse SEO bernilai 100 tanpa satu pun temuan gagal.

Masalah terbesar saat ini bukan lagi infrastruktur, melainkan **kualitas data katalog dan pengukuran**:

1. **GTM/GA belum ter-deploy ke produksi** — perubahan `app/layout.tsx` dan CSP masih uncommitted; homepage produksi tidak memuat `googletagmanager` sama sekali. Artinya trafik yang datang (termasuk dari Search Console) tidak terukur.
2. **Slug typo `orbicural-` masih live pada 12 URL produk** dan terindeks (canonical self-referencing ke URL typo), termasuk nama produk "Orbicural" di JSON-LD dan breadcrumb — inkonsisten dengan title tag yang sudah menulis "Orbicular".
3. **Judul produk duplikat** — contoh: "Indo Agate Cabochons - Natural Polished Indonesian Agate" dipakai identik oleh minimal 3 produk berbeda; Google hanya akan memilih satu.

**Penilaian:** papan teknis sudah hijau (Lighthouse SEO 100, robots/sitemap/canonical/noindex sehat, structured data kaya). Fokus berikutnya adalah meluruskan URL & judul produk, men-deploy analytics, lalu kecepatan halaman (bobot homepage 3,7 MB, Speed Index 8,2 s lab mobile, TTFB ~700 ms).

## Cakupan dan batas pemeriksaan

- Pemeriksaan live produksi: redirect (`www`, `http`, `/id`, trailing slash), `robots.txt`, `sitemap.xml` (198 URL), homepage, 1 halaman kategori + paginasi, 10 sampel halaman produk, 1 artikel blog, halaman tag blog, artists/search/cart/checkout/track/account/faq, halaman statis sitemap, header respons gambar.
- Lighthouse 11 (mobile emulasi, Chrome lokal) pada homepage: kategori performance, SEO, best-practices. PageSpeed Insights API gagal karena kuota anonim habis, jadi data Core Web Vitals lapangan (CrUX) belum tersedia — cek manual di Search Console.
- Tinjauan source: `app/sitemap.ts`, `app/robots.ts`, `lib/seo.ts`, `app/(storefront)/blog/page.tsx`, metadata kategori, diff lokal `app/layout.tsx` + `next.config.ts`.
- Belum dicakup: status indeksasi Google (URL Inspection), CWV lapangan, backlink, dan validasi rich results penuh.

## Status perbaikan audit 2026-10-26

| Temuan lama | Status 2026-11-20 |
|---|---|
| `www` tidak diarahkan ke apex | ✅ Fixed — 308 ke apex |
| `/id` redirect permanen | ✅ Fixed — 308 ke `/` |
| `/lapidary/artists` placeholder terindeks | ✅ Fixed — `noindex, follow` + keluar dari sitemap (filter kondisional `app/sitemap.ts`) |
| Title blog paginasi tanpa nomor | ✅ Fixed — "Page 2 — Journal — RENDI VIRGO" |
| Halaman keranjang/akun bisa terindeks | ✅ Fixed — semua `noindex` (checkout/account bahkan `nofollow`) |
| Slug typo `orbicural-` | ❌ Masih ada — 12 URL live di sitemap, 200 + canonical self-ref |
| Metadata tag blog & paginasi kategori | ❌ Masih ada (lihat P2-1, P2-2) |
| Alt gambar informatif kosong | ⚠️ Sebagian — 3 kartu artikel di homepage + beberapa gambar produk masih `alt=""` |
| Sitemap rentan saat API down | ⚠️ Belum berubah (mitigasi opsional, risiko kecil) |

## Temuan dan rekomendasi

### P1-1 — Deploy GTM/GA ke produksi (pengukuran)

Homepage produksi tidak memuat `googletagmanager` maupun `gtag` (diperiksa 20 Nov 2026). Perubahan `<GoogleAnalytics />` di `app/layout.tsx` dan perluasan CSP di `next.config.ts` masih **uncommitted** di working tree. Semua pekerjaan SEO tidak bisa dievaluasi tanpa data trafik.

**Langkah:** commit + deploy kedua file, lalu verifikasi: (a) tag muncul di HTML/browser, (b) Realtime report GA menerima hit, (c) CSP `Content-Security-Policy-Report-Only` tidak memblokir — karena masih report-only aman; putuskan kapan naik kelas ke CSP enforced setelah beberapa hari tanpa pelanggaran. Verifikasi juga consent/basis legal bila trafik UE ada.

### P1-2 — Luruskan slug typo `orbicural` dengan redirect permanen

Sitemap memuat 12 URL typo: `orbicural-agate-cabochon` (–13), `orbicural-cabochon` (–2), dst. Semuanya 200 dengan canonical self-referencing → Google mengindeks URL salah eja. Typo juga ada di **nama produk** (JSON-LD `name: "Orbicural Agate Cabochon"`, breadcrumb), sedangkan title tag menulis "Orbicular" — satu halaman dengan dua ejaan di dua tempat menurunkan relevansi untuk query "orbicular agate".

**Langkah:** (1) koreksi nama produk di admin; (2) ubah slug → `orbicular-…`; (3) pasang redirect 301/308 lama→baru untuk semua 12 URL (tabel redirect slug di API, atau blok `redirects()` Next untuk batch ini), (4) sitemap & internal link otomatis mengikuti slug baru; (5) ajukan re-crawl via URL Inspection. Terapkan mekanisme redirect yang sama untuk slug-change di masa depan, bukan hanya batch ini.

### P1-3 — Hapus judul produk duplikat

Terverifikasi: `indo-agate-cabochon`, `indo-agate-cabochon-21`, `indo-agate-cabochon-24` semuanya memakai title identik "Indo Agate Cabochons - Natural Polished Indonesian Agate"; pola sama pada "Orbicular Agate Cabochon - Natural Stone from Sumatra" (-5, -11). Duplikat membuat Google menggabungkan/memilih satu dan menekan impresi produk lain.

**Langkah:** template title produk harus memuat pembeda unik — nomor seri/SKU, dimensi/berat, atau ciri visual (mis. "Indo Agate Cabochon No. 24 — 38×26 mm, West Java"). Idealnya melalui field SEO title per produk di admin (bila belum ada, tambahkan) dengan fallback template `{name} {No} — {dimensions} | RENDI VIRGO`. Targetkan unik di seluruh 160+ produk; audit cepat dengan `grep` title via script crawl sendiri.

### P2-1 — Metadata halaman tag blog

`/blog?tag=agate` tetap memakai title/description arsip generik ("Journal — RENDI VIRGO") dengan canonical self-ref → indeksable tapi tidak unik. Tag juga memakai spasi ter-encode (`?tag=Bacan%20gem%20silica`). Sumber: `app/(storefront)/blog/page.tsx` (`description: journal.intro` tanpa cabang tag).

**Langkah:** jika tag layak diindeks, beri title "Agate — Journal — RENDI VIRGO" + deskripsi unik; jika tidak, `noindex` halaman tag. Pertimbangkan slug tag kebab-case atau path `/blog/tag/agate` agar URL bersih. Batasi tag yang diijinkan diindeks ke yang punya ≥2 artikel.

### P2-2 — Paginasi kategori shop

`/shop/cabochons?page=2` canonical self-ref (benar) tapi title identik dengan halaman 1. Blog sudah benar ("Page 2 — Journal"); tinggalkan pola yang sama di `app/(storefront)/shop/[category]/page.tsx`: "Cabochons — Page 2 — …".

### P2-3 — Berat homepage & Speed Index

Lighthouse mobile (lab): Performance 87, FCP 1,1 s, TBT 10 ms, CLS 0 — bagus — tetapi **Speed Index 8,2 s** dan **total byte 3,7 MB**; TTFB root dokumen ~700 ms. Penyebab dominan: banyak gambar kartu produk/editorial dengan `sizes` generik hingga `w=3840`.

**Langkah:** (a) perketat `sizes` per slot grid agar tidak request resolusi 2–4×; (b) kurangi jumlah kartu di above/below fold homepage atau naikkan quality threshold; (c) cek `/_next/image` `quality` (mis. 60–70) untuk foto produk; (d) TTFB: root layout memakai `headers()` (locale) → semua halaman dinamis `no-store`. Karena situs sudah English-only, hapus jalur locale + `GoogleAnalytics` setelah deploy, evaluasi pindah metadata locale keluar dari request-time agar halaman publik bisa ISR/cache. Ukur ulang CWV lapangan di Search Console setelah perubahan.

### P2-4 — Alt text gambar konten masih kosong

3 kartu artikel blog di homepage (`/blog/kalimaya-…`, `working-with-silicified-wood-…`, `volcanic-hydrothermal-…`) dan beberapa gambar di halaman produk memakai `alt=""`. Alt kosong hanya sah untuk gambar dekoratif; thumbnail artikel adalah gambar konten. Juga satu gambar editorial homepage (`moss-agate-fern.webp`) — putuskan dekoratif (biarkan kosong) atau konten (beri deskripsi).

**Langkah:** isi deskripsi konkret per kartu (mis. "Specimen kalimaya black opal dari Banten"). Pola alt produk `"{name} — {stone type}"` sudah ada; pertahankan dan perbaiki ejaan (lihat P1-2).

### P2-5 — OG image non-standar & enrichment schema

`og:image` default = `hero-stones.webp` 2172×724 (rasio 3:1) — akan ter-crop aneh di Facebook/LinkedIn; Twitter kadang gagal render WebP. Produk juga memakai `og:type "website"`.

**Langkah:** buat OG image 1200×630 (JPG/PNG) sebagai default; produk tetap override dengan foto produknya. Schema: tambah `sameAs` (Instagram/Facebook) + `contactPoint` (WhatsApp +62858…) pada Organization; tambahkan `FAQPage` JSON-LD di `/faq` (kontennya sudah format tanya-jawab, mis. treatment disclosure); produk: pertimbangkan `og:type "product"` dan `aggregateRating` hanya jika benar-benar ada ulasan.

### P2-6 — Konsistensi NAP & email publik

Contact page menampilkan `rendivirgo001@gmail.com` + WhatsApp `+62 858-6017-4122`; Organization schema memakai email gmail yang sama (konsisten satu sama lain — baik), tapi gmail di schema melemahkan kepercayaan vs domain sendiri.

**Langkah:** gunakan `info@rendivirgo.com` (atau setara) di schema + contact page bila memungkinkan; pastikan sama persis di semua tempat (schema, footer, Google Business Profile bila ada).

### P3 — Perbaikan bernilai kecil

1. **`http://` → `https` masih 307** (temporary). Ubah ke 308/301 permanen di konfigurasi hosting (Coolify/proxy).
2. **Cache gambar 7 hari** (`max-age=604800`) pada `/uploads/*` dan `/_next/image`. Nama file upload sudah stabil per-upload — naikkan ke `max-age=31536000, immutable` untuk `/uploads` dan `_next/image`.
3. **hreflang noise**: sitemap memuat `xhtml:link hreflang="en"` per URL tanpa `x-default` untuk situs single-language — tidak berbahaya tapi tidak berguna; hapus alternates atau tambahkan `x-default`.
4. **Icon set**: hanya `favicon.svg`; tambahkan apple-touch-icon (PNG) dan `web manifest` untuk mobile/completeness signal.
5. **`html lang="en-GB"`** — sah, tapi pastikan memang target en-GB (bahasa isi campur US/GB); jika audiens utama internasional, `en` atau `en-US` lebih netral. Kode locale `id` masih hidup di layout — rapikan setelah keputusan English-only final (juga membantu P2-3).
6. **Slug kategori generik** (`/shop/pair`, `/shop/rough`, `/shop/slab`) — kurang deskriptif ("gemstone-pairs", "rough-material"). Mengubah butuh redirect per kategori; nilai sedikit, lakukan hanya saat ada pekerjaan URL lain.
7. **Product JSON-LD `wordCount`/`articleBody`** di Article tidak ada — opsional, rendah prioritas.
8. **Pantau sitemap saat API down** (sisa temuan lama): jumlah URL kini 198; tambahkan alert sederhana bila count turun >30% antar-build.

## Urutan pekerjaan yang disarankan

1. **Hari ini:** commit + deploy GTM (P1-1); verifikasi tag live.
2. **Pekan ini:** koreksi nama+slug `orbicural` + redirect 12 URL (P1-2); hapus duplikat title produk (P1-3) — mulai dari produk terbanyak impresi di Search Console.
3. **Berikutnya:** metadata tag blog & paginasi kategori (P2-1, P2-2); alt gambar (P2-4); OG image 1200×630 + schema enrichment (P2-5).
4. **Performa:** perketat `sizes`/quality gambar, evaluasi penghapusan `headers()` locale untuk memungkinkan caching HTML (P2-3).
5. **Kebersihan:** 308 http→https, cache immutable, hreflang/icon (P3).
6. **Pengukuran:** setelah GA live + 2–4 minggu data, review query/halaman di Search Console, cek Core Web Vitals lapangan, dan re-audit indeksasi (site:`rendivirgo.com` + URL Inspection untuk 12 URL lama).

## Sumber utama

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google Images SEO](https://developers.google.com/search/docs/appearance/google-images)
- [Share URLs in social (Open Graph / Twitter cards)](https://developers.facebook.com/docs/sharing/webmasters/) — untuk OG image 1200×630
- Hasil Lighthouse lokal 2026-11-20 dan pemeriksaan HTML live (curl) — data mentah dalam sesi audit
