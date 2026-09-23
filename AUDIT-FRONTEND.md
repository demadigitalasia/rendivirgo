# Laporan Audit Frontend — RENDI VIRGO

| | |
|---|---|
| **Tanggal Audit** | 23 September 2026 |
| **Commit** | `f5f5986` — "Polish icon system and wishlist interactions" |
| **Branch** | `main` (working tree clean) |
| **Lingkup** | Seluruh storefront: `app/`, `components/`, `lib/`, `app/globals.css`, `public/`, `assets/` |
| **Acuan** | `PROJECT-PLAN.md`, `IMPLEMENTATION-PLAN-FRONTEND.md` |
| **Metode** | Review statis seluruh source, `tsc`/`next build`, smoke test HTTP, axe-core CLI 4.13 (10 halaman), Lighthouse 12 mobile (Home + Product Detail) |

> **Update 23 September 2026:** seluruh 10 rekomendasi **P0 telah dikerjakan** (detail & metrik baru di [§9](#9-tindak-lanjut-p0--status-pengerjaan-23-september-2026)), dilanjutkan **Sprint P1 (a)+(b)**: perluasan mock data + skema §7 + filter katalog lanjutan (detail di [§10](#10-tindak-lanjut-p1-ab--mock-data--filter-lanjutan-23-september-2026)). Laporan §1–§8 dipertahankan sebagai snapshot kondisi sebelum perbaikan.

---

## 1. Ringkasan Eksekutif

Prototype frontend **berhasil dibangun dan berjalan**: build bersih, typecheck bersih, 38 halaman ter-prerender, seluruh 15 route utama merespons HTTP 200, dan arah visual sudah sesuai mockup homepage yang disetujui (hero, owner banner, trust bar, footer hijau).

Namun dari sisi **kesiapan review pemilik (Fase 11)** dan kelanjutan ke fase backend, masih terdapat gap besar. Beberapa alur demo wajib (B, D, E, F) belum berjalan sesuai definisi plan.

**Skor Kesiapan Frontend: 58/100 — belum siap masuk fase backend** (asesmen berbobot: kelengkapan fungsional, performa, aksesibilitas, SEO, dan kesiapan review).

| Area | Hasil Audit | Target Plan |
|---|---|---|
| Build & Typecheck | Lulus (`tsc --noEmit`, `next build` bersih) | Lulus |
| Kelengkapan fitur vs plan | ~40% (rincian §3) | 100% kriteria Fase 0–10 |
| Alur demo A–F | 2/6 penuh (A ✓; C sebagian; B, D, E, F gagal) | 6/6 berhasil |
| Aksesibilitas | Lighthouse 96, tetapi 3–13 violation axe per halaman | WCAG 2.2 AA |
| Performa | Home: 75 · LCP **28,0 dtk** · 5,9 MB. Produk: 98 · LCP 2,3 dtk | LCP < 2,5 dtk |
| SEO | ~30% (metadata hanya root; tanpa sitemap/robots/JSON-LD; soft 404) | Skor on-page ≥ 85 |
| i18n English/Indonesia | ~5% (hanya 6 label navigasi) | UI utama dwibahasa |

**Temuan kritis (P0) yang harus diperbaiki:**
1. Taksonomi "Featured Categories" di Home salah (jenis batu, bukan kategori) dan deep-link `/shop?stone=...` diabaikan halaman Shop.
2. Aturan stok item unik (qty = 1) tidak diterapkan — produk bisa ditambahkan berulang dan quantity bebas.
3. i18n belum berjalan — hanya label navigasi yang berubah; `lang` dokumen tetap `en`.
4. Admin override shipping dan edit konten admin tidak terhubung ke storefront (Alur D gagal).
5. Owner banner tidak memiliki CTA "About Us" (Alur F gagal).
6. Pencarian hanya dekoratif — tidak ada submit, tidak ada halaman `/search`.
7. Soft 404: URL produk/kategori/blog tak dikenal merespons HTTP 200.
8. Aset gambar tidak dioptimasi (5,9 MB di Home; LCP 28 dtk pada simulasi mobile).

---

## 2. Metodologi dan Bukti

| Pemeriksaan | Hasil |
|---|---|
| Review statis | 26 file source (~1.240 baris) + `globals.css` 325 baris |
| `npm run lint` (`tsc --noEmit`) | Lulus, tanpa error |
| `npm run build` | Sukses; 38 halaman statis/SSG |
| Smoke test 15 route utama | Semua `200` |
| Route negatif | `/shop/unknown-category` → `200` (harus 404), `/shop/cabochons/does-not-exist` → `200` (harus 404), `/blog/does-not-exist` → `200` (harus 404), `/search` → `404`, `/account/wishlist` → `404` |
| axe-core CLI 4.13 (10 halaman) | Home 7, Shop 13, Produk 4, Cart 3, Checkout 3, Admin 3, Blog 4, Artikel 4, About 4, Contact 4 violation |
| Lighthouse 12 (mobile) Home | Performance **75**, LCP **28,0 dtk**, FCP 0,8 dtk, TBT 10 ms, CLS 0, Total **5.857 KiB** |
| Lighthouse 12 (mobile) Product Detail | Performance **98**, LCP 2,3 dtk, Total 3.857 KiB |
| Ukuran aset | hero 1,9 MB · owner 2,0 MB · logo 860 KB · logo alt 784 KB (semua PNG) |

---

## 3. Kepatuhan per Fase (IMPLEMENTATION-PLAN-FRONTEND.md)

| Fase | Status | Yang sudah ada | Yang belum ada |
|---|---|---|---|
| 0 — Persiapan & Aset | 🟡 Sebagian | Struktur Next.js, logo, hero & owner placeholder, 13 kategori | Min. 20 produk (baru 8), min. 6 blog (baru 3), translation dictionary, foto produk |
| 1 — Design Tokens & Base UI | 🟡 Sebagian | Token CSS variables, button (light/outline/full), input/select, badge, breadcrumb-less layout, focus-visible | Alert, modal, accordion, tabs, breadcrumb, pagination, state loading/error/success komponen |
| 2 — App Shell & Navigasi | 🟡 Sebagian | Announcement bar, header, drawer mobile, logo link, search trigger, language switcher, cart indicator, footer | Shop dropdown/mega menu, breadcrumb, toast/notifikasi, pencarian fungsional, account/wishlist page |
| 3 — Home | 🟡 Sebagian | Hero, owner banner, featured stones, trust bar | 5 kategori inti (diganti jenis batu), sourcing story, latest blog, testimonials, newsletter, final CTA, CTA About Us di owner banner |
| 4 — Shop & Katalog | 🟡 Sebagian | Halaman shop & kategori, filter kategori/jenis batu, sort featured/harga, grid, empty state, sold-out state | Filter harga/berat/origin/status, sort "terbaru", loading state, quick view, mobile filter drawer, pagination, sinkronisasi URL |
| 5 — Product Detail | 🟡 Sebagian | Info utama, harga, varian (ubah harga & berat), CTA, spec dasar, status stok | Galeri multi-angle, zoom/lightbox, catatan cacat, ringkasan shipping, related products, share, accordion, aturan beli sekali untuk item unik |
| 6 — Cart & Shipping Sim | 🟡 Sebagian | Daftar item, ubah qty, hapus, persist localStorage, subtotal, mock rate, sumber tarif | Total berat di cart, admin override aktif, handling fee fragile/oversized, validasi stok |
| 7 — Checkout & PayPal | 🟡 Sebagian | Form, ringkasan, berat, shipping, total, simulasi PayPal, state sukses | State Pending/Cancelled/Failed, negara lengkap (baru 8), opsi pengiriman, customs/duties, halaman confirmation terpisah, catatan retur |
| 8 — Content & Blog | 🟡 Sebagian | 9 halaman konten + blog + artikel (EN) | Versi Bahasa Indonesia, newsletter success state |
| 9 — Admin Mockup | 🔴 Belum | 3 tab: overview, homepage content, shipping rate | Product list/editor, variant editor, shipping profile, order list/detail, banner manager, payment settings, reports, system settings; perubahan tidak tampil di storefront |
| 10 — Responsive & A11y | 🟡 Sebagian | Grid responsif, target 44px sebagian, fokus terlihat | Escape menutup drawer/search, focus trap, label input pencarian, kontras AA, heading order, landmark |
| 11 — Review Pemilik | ⬜ Belum | — | Sesi review & daftar feedback resmi |

### Status Alur Demo Wajib

| Alur | Status | Catatan |
|---|---|---|
| A — Browsing | ✅ Lulus | Home → Shop → Kategori → Detail → kembali |
| B — Pembelian produk unik | ❌ Gagal | Item unik bisa ditambahkan berkali-kali (`Add another to cart`, qty +); hanya state sukses PayPal |
| C — Produk varian | 🟡 Sebagian | Harga & berat berubah; stok varian tidak ditampilkan/dihormati |
| D — Shipping override | ❌ Gagal | Override di admin tidak terhubung ke checkout; `setOverrideEnabled` di checkout tidak pernah dipanggil |
| E — Bahasa | ❌ Gagal | Hanya 6 label navigasi berubah; konten halaman tetap English; `html lang` statis |
| F — Owner banner | ❌ Gagal | Owner banner tidak memiliki link/CTA ke About Us |

---

## 4. Temuan Detail

Severitas: **P0 = Must fix** (sebelum lanjut/review) · **P1 = Should fix** (sebelum backend) · **P2 = Nice to have**.

### 4.1 Fungsional & Bug

| ID | Sev | Temuan | Bukti |
|---|---|---|---|
| F-01 | P0 | **Taksonomi Home salah + deep-link filter rusak.** "Featured Categories" menampilkan 5 *jenis batu* (Agate, Moss Agate, Jade, Chalcedony, "Rough Stones") alih-alih 5 kategori inti; tautan mengarah ke `/shop?stone=X` tetapi ShopPage tidak membaca `searchParams`, sehingga filter tidak pernah aktif. "Rough Stones" juga bukan jenis batu. | `app/page.tsx:39`, `app/shop/page.tsx:8-14` |
| F-02 | P0 | **Aturan item unik dilanggar.** `addToCart`/`updateQuantity` tidak membatasi qty; tombol "Add another to cart" ada di detail produk; kontrol qty di cart bebas; `stockQuantity` varian diabaikan. | `components/providers.tsx:46-64`, `components/product-detail-client.tsx:35`, `app/cart/page.tsx:13` |
| F-03 | P0 | **i18n belum berjalan.** Hanya dictionary kecil di header; seluruh halaman, cart, checkout, error text, dan konten English; `document.documentElement.lang` tidak diperbarui; tidak ada mekanisme konten bilingual. | `components/site-header.tsx:9-12`, `app/layout.tsx:15` |
| F-04 | P0 | **Admin mockup terisolasi.** Hero title/owner copy/edit shipping di admin hanya state lokal; checkout memiliki state override yang tidak pernah diaktifkan dari UI manapun; Alur D gagal. | `app/admin/page.tsx:10-15`, `app/checkout/page.tsx:13,18` |
| F-05 | P0 | **Owner banner tanpa CTA** menuju About Us (kebutuhan eksplisit Fase 3 & Alur F). | `app/page.tsx:25-33` |
| F-06 | P0 | **Pencarian non-fungsional.** Panel search tanpa form/submit, tanpa label, tidak ada halaman `/search` (404). | `components/site-header.tsx:51` |
| F-07 | P0 | **Soft 404.** Produk/kategori/artikel tak dikenal merender pesan "not found" dengan HTTP 200, bukan `notFound()`. | `app/shop/[category]/page.tsx:11`, `app/shop/[category]/[slug]/page.tsx:10`, `app/blog/[slug]/page.tsx:16` |
| F-08 | P1 | **Filter katalog belum lengkap:** tidak ada filter harga, berat, asal, status; tidak ada sort "terbaru"; state filter tidak tersimpan di URL (tidak bisa dibagikan/reload). | `app/shop/page.tsx:8-14` |
| F-09 | P1 | **Checkout belum lengkap:** hanya 8 negara; belum ada state Pending/Cancelled/Failed; belum ada opsi pengiriman; belum ada biaya handling produk fragile/oversized; belum ada info customs/duties/retur; konfirmasi masih inline. | `app/checkout/page.tsx:8,15,21-24` |
| F-10 | P1 | **Wishlist tanpa halaman tujuan.** Tombol heart menyimpan ke localStorage tetapi tidak ada `/account/wishlist`; tidak ada indikator daftar. | `components/product-card.tsx:11-39` |
| F-11 | P1 | **Home belum lengkap** dibanding urutan section Fase 3: tidak ada sourcing story, latest blog, testimonials, newsletter, dan final CTA yang utuh. | `app/page.tsx` |
| F-12 | P1 | **Product detail belum lengkap:** tanpa galeri/lightbox/zoom, related products, share action, accordion (description/shipping/returns/care), catatan cacat (crack/pinhole/undercut), dan ringkasan shipping berbasis berat. | `components/product-detail-client.tsx` |
| F-13 | P1 | **Belum ada breadcrumb, pagination, quick view, mobile filter drawer, dan toast/notifikasi** yang diminta Fase 2 & 4. | `components/site-header.tsx`, `app/shop/page.tsx` |
| F-14 | P1 | **Admin mockup jauh dari Fase 9:** baru 3 tab; belum ada product editor, variant editor, shipping profile editor, order list/detail, banner manager, payment settings, reports, system settings. | `app/admin/page.tsx` |

### 4.2 Performa

| ID | Sev | Temuan | Bukti |
|---|---|---|---|
| P-01 | P0 | **Aset gambar tidak dioptimasi.** Home memuat 5,9 MB; hero (1,9 MB) sebagai CSS background tanpa `srcset`/priority/alt; owner 2,0 MB via `<img>` tanpa dimensi; logo 860 KB & 784 KB ditampilkan hanya 155–260 px. LCP simulasi mobile Home **28,0 dtk** (target < 2,5 dtk). | `app/globals.css:78,293`, `app/page.tsx:26`, `components/site-header.tsx:36`, `components/site-footer.tsx:8` |
| P-02 | P1 | Tidak ada penggunaan `next/image` di seluruh project; tidak ada `loading="lazy"`, dimensi eksplisit, atau format WebP/AVIF (padahal SOP §11.10 plan mewajibkannya). | Grep `next/image` → 0 hasil |
| P-03 | P2 | Font memakai system stack (`Iowan Old Style`/`Avenir Next` → fallback Georgia/Arial). Render di Windows/Android akan berbeda dari macOS. | `app/globals.css:17-18` |

### 4.3 Aksesibilitas (WCAG 2.2 AA)

| ID | Sev | Temuan | Bukti |
|---|---|---|---|
| A-01 | P0 | **Kontras gagal** (axe, 1–9 elemen/halaman): nav aktif `#b08a53` di atas `#fcfaf6` (~2,9:1); eyebrow jade di owner banner; label putih `.product-art__label` di atas gradien. | `app/globals.css:45,63,136` |
| A-02 | P1 | **Announcement bar di luar landmark** → violation `region` di 10/10 halaman. | `components/site-header.tsx:25-33` |
| A-03 | P1 | **Heading order salah** di `/shop`: `h1` → `h3` ("Browse by category"), tidak ada `h2`. | `app/shop/page.tsx:21` |
| A-04 | P1 | **Drawer & search tidak menutup dengan Escape**, tanpa focus management/trap; input search tidak punya label (hanya placeholder); panel dapat kehilangan fokus. | `components/site-header.tsx:47-51` |
| A-05 | P1 | **Target sentuh < 44 px:** tombol qty 30×30, tombol bahasa announcement (padding 0, teks kecil), `.text-button`. | `app/globals.css:54-57,225` |
| A-06 | P1 | **`html lang="en"` statis** meski pengguna memilih Bahasa Indonesia; tidak ada `hreflang`. | `app/layout.tsx:15` |
| A-07 | P1 | Tidak ada **skip link**, tidak ada `aria-live` untuk perubahan cart/toast; badge jumlah cart hanya visual (aria-label "Shopping cart" tanpa jumlah). | `app/layout.tsx`, `components/site-header.tsx:47` |
| A-08 | P2 | `role="img"` + `aria-label` pada ilustrasi produk CSS hanya memberikan label jenis batu, bukan deskripsi produk. | `components/product-art.tsx:5` |

> Catatan: axe tidak menguji keyboard/trap fokus — checklist Fase 10 (Escape, fokus, touch) masih perlu uji manual.

### 4.4 SEO

| ID | Sev | Temuan | Bukti |
|---|---|---|---|
| S-01 | P0 | **Metadata hanya di root layout.** Tidak ada `generateMetadata` per halaman (title/description unik, canonical, Open Graph/Twitter, `metadataBase`). | `app/layout.tsx:7-11`; grep `generateMetadata` → 0 |
| S-02 | P1 | Tidak ada `app/sitemap.ts` dan `app/robots.ts`. | Tidak ada file |
| S-03 | P0 | Soft 404 (lihat F-07) — google dapat mengindeks halaman "not found" sebagai konten valid. | — |
| S-04 | P1 | Tidak ada structured data (Product, Article, BreadcrumbList) sesuai rencana SEO pada PROJECT-PLAN §12. | Grep JSON-LD → 0 |
| S-05 | P1 | Tidak ada hreflang/alternate language; bahasa hanya state klien yang tidak terindeks. | — |
| S-06 | P2 | Hero CSS background tidak punya alt text (rencana banner §11.8 mewajibkan alt & focal point yang dapat diatur). | `app/globals.css:78` |

> Lighthouse SEO 100 hanya mengukur dasar (title, meta description, crawlable); tidak mencakup sitemap, structured data, hreflang.

### 4.5 Desain & Branding

| ID | Sev | Temuan | Bukti |
|---|---|---|---|
| D-01 | P1 | **Token warna menyimpang dari spec §11.3:** forest `#103b2c` vs `#123C2F`; jade `#477d68` vs `#3F7A62`; ink `#1c201d` vs `#202321`; sand `#e6dfd2` vs `#DED2BF`; bronze `#b08a53` vs `#B38A55`; muted `#6b7069` vs `#737874`; danger `#9f5148` vs `#B33A3A`. Perlu keputusan: adopsi hex spec atau perbarui dokumen (spec menyebut "kode awal"). | `app/globals.css:1-19` vs PROJECT-PLAN §11.3 |
| D-02 | P1 | **Tipografi brand tidak konsisten antar platform** (lihat P-03); heading/body hanya bergantung font sistem. | `app/globals.css:17-18` |
| D-03 | P2 | **Dead code/CSS:** `.button--primary` dipakai tapi tidak terdefinisi; `.product-art__glow`, `.product-art__stone`, `.product-art__label` tidak terdefinisi (3 span kosong per kartu); `.footer-grid`, `.footer-column`, `.footer-links`, `.footer-bottom` tidak terpakai (duplikat `site-footer__*`); `ChevronIcon` tidak dipakai; class `status-badge--available` tanpa style. | `components/add-to-cart-button.tsx:12`, `components/product-art.tsx:6-10`, `app/globals.css:151-156,309`, `components/icons.tsx:17` |
| D-04 | P2 | Layout kartu & section mengikuti mockup dengan baik; container 1380 px & radius 5 px sesuai arahan. | — |

### 4.6 Kualitas Kode & Arsitektur

| ID | Sev | Temuan | Bukti |
|---|---|---|---|
| C-01 | P1 | **Mock data tidak mengikuti skema PROJECT-PLAN §7:** tidak ada `unit`, `stock_model`/`stock_quantity`, `currency`, `images[]`, `variants[].sku/shipping_profile_id`, `shipping.*`, `seo.*`, `created_at/updated_at`; jumlah data di bawah target Fase 0 (8 produk vs 20; 3 artikel vs 6); tidak ada foto produk (semua ilustrasi CSS). | `lib/catalog.ts:12-31,57-233` |
| C-02 | P1 | **Struktur folder menyimpang dari saran plan** (`data/`, `features/`, `styles/tokens.css`, `types/`) tanpa pemisahan; data demo tercampur tipe + data + formatter di satu file. | `lib/catalog.ts` |
| C-03 | P1 | **Struktur JSX satu baris** pada halaman admin, checkout, cart, shop, blog detail — sulit di-review, di-diff, dan di-maintain. | `app/admin/page.tsx:17`, `app/checkout/page.tsx:26`, `app/cart/page.tsx:13` |
| C-04 | P1 | **Tidak ada ESLint** (`lint` hanya `tsc`), tidak ada Prettier, sehingga issue a11y/React tidak tertangkap otomatis. | `package.json:9` |
| C-05 | P2 | **localStorage tanpa guard:** `JSON.parse(savedCart)` di Providers dapat melempar error bila data korup; tidak ada `error.tsx`/`global-error`/`not-found.tsx` kustom. | `components/providers.tsx:33`, `app/` |
| C-06 | P2 | `formatUSD` memaksa `maximumFractionDigits: 0` → tidak dapat menampilkan sen (USD idealnya 2 desimal untuk harga ritel). | `lib/catalog.ts:235-240` |
| C-07 | P2 | Tidak ada test sama sekali (unit/E2E/smoke). | Tidak ada file test |
| C-08 | P2 | Footer memuat anchor placeholder `#instagram` dan `#pinterest`; email `hello@rendivirgo.com` belum diverifikasi. | `components/site-footer.tsx:13` |

### 4.7 Keamanan & Privasi

| ID | Sev | Temuan | Bukti |
|---|---|---|---|
| X-01 | ✅ | Tidak ada secret/API key di repo; tidak ada data pribadi yang disimpan (form checkout hanya state lokal); tidak ada script pihak ketiga. | Review source |
| X-02 | P2 | Form checkout tanpa validasi selain `required` HTML5; perlu validasi & rate limiting pada fase backend (catatan untuk fase berikutnya). | `app/checkout/page.tsx` |

### 4.8 Yang Sudah Baik (Pertahankan)

- Build & typecheck bersih; seluruh route statis/SSG termasuk dynamic routes (`generateStaticParams`).
- Semua halaman ter-render stabil saat dipindai axe-core; halaman produk meraih Lighthouse 98 (verifikasi console browser secara manual belum dilakukan — masuk checklist QA Fase 10).
- Design token sebagai CSS variables, konsisten dan mudah diubah.
- `focus-visible` global, `aria-hidden` pada ikon, `aria-pressed` pada wishlist/language, `aria-expanded` pada menu/search.
- Persistensi cart, bahasa, dan wishlist via localStorage.
- Copywriting konsisten, tone brand premium/artisanal sesuai §11.2, tanpa klaim berlebihan.
- Arah visual Home sesuai mockup: hero foto, owner banner, grid kategori, trust bar, footer hijau.
- Kategori & URL mengikuti struktur final yang ditetapkan (kecuali halaman `/search` yang belum ada).

---

## 5. Rekomendasi Berprioritas

### P0 — Must fix sebelum review pemilik / lanjut backend (estimasi 5–7 hari kerja)

| # | Rekomendasi | Menyelesaikan |
|---|---|---|
| 1 | Ganti "Featured Categories" Home menjadi 5 kategori inti dengan tautan `/shop/<slug>`; sinkronkan state filter Shop dengan `useSearchParams()` agar `/shop?stone=` / `?category=` berfungsi dan dapat dibagikan. | F-01, F-08 |
| 2 | Terapkan aturan stok: item unik maksimal qty 1 (nonaktifkan/hapus tombol "Add another", sembunyikan tombol + di cart, tampilkan "In your cart"); hormati `stockQuantity` varian; tampilkan stok tersisa untuk produk quantity. | F-02 |
| 3 | Bangun translation dictionary EN/ID dan terapkan pada UI utama (header, footer, home, shop, produk, cart, checkout, tombol & pesan); perbarui `document.documentElement.lang`; tandai konten ID yang masih draft. | F-03, A-06 |
| 4 | Hubungkan state admin ke storefront (React Context + persist localStorage): hero title, owner bio, shipping override — sehingga Alur D berjalan; aktifkan kontrol override di checkout atau hapus dead state. | F-04 |
| 5 | Tambahkan CTA "About Us" pada owner banner sesuai Alur F. | F-05 |
| 6 | Implementasikan pencarian minimal (submit → `/search?q=` dengan hasil dari mock catalog) atau nyatakan jelas "coming soon"; tambahkan label pada input. | F-06, A-04 |
| 7 | Gunakan `notFound()` pada produk/kategori/artikel tak dikenal + buat `app/not-found.tsx` kustom. | F-07, S-03 |
| 8 | Optimasi aset: konversi hero/owner/logo ke WebP/AVIF, siapkan ukuran responsif (logo ≤ 520 px), pindah ke `next/image` atau `image-set()`, tambahkan `priority`/lazy. Target: Home < 1 MB, LCP < 2,5 dtk. | P-01, P-02 |
| 9 | Perbaiki kontras (nav aktif, eyebrow, label art), bungkus announcement bar dalam landmark `<header>`, perbaiki heading order `/shop`, Escape + focus management untuk drawer/search, target sentuh ≥ 44 px, tambah skip link. | A-01..A-07 |
| 10 | SEO dasar: `generateMetadata` per halaman (title/description/canonical/OG/Twitter + `metadataBase`), `app/sitemap.ts`, `app/robots.ts`. | S-01, S-02 |

### P1 — Should fix sebelum backend dimulai (estimasi 6–9 hari kerja)

| # | Rekomendasi | Menyelesaikan |
|---|---|---|
| 11 | Lengkapi Home: sourcing story, latest blog (3), testimonials, newsletter + success state, final CTA. | F-11 |
| 12 | Lengkapi Product Detail: galeri/lightbox/zoom, related products, share, accordion (description/shipping/returns/care), catatan cacat, ringkasan berat & shipping. | F-12 |
| 13 | Lengkapi Checkout: daftar negara lengkap (worldwide), state Pending/Cancelled/Failed, opsi pengiriman, handling fee fragile/oversized, catatan customs/duties/retur, halaman order confirmation. | F-09 |
| 14 | Lengkapi Admin mockup sesuai Fase 9 + live preview ke storefront. | F-14 |
| 15 | Tambah breadcrumb, pagination/infinite scroll, quick view, mobile filter drawer, toast system. | F-13 |
| 16 | Perluas mock data ke ≥ 20 produk & ≥ 6 artikel; tambahkan foto placeholder produk (wajib); sesuaikan skema data dengan PROJECT-PLAN §7 (unit, stock model, images, variants, shipping profile, SEO). | C-01 |
| 17 | Restrukturisasi folder mengikuti plan (`data/`, `features/`, `types/`, `styles/tokens.css`); format ulang JSX; hapus dead code/CSS. | C-02, C-03, D-03 |
| 18 | Bungkus error-prone code (localStorage) dengan guard; tambah `error.tsx`; tambah ESLint + `eslint-plugin-jsx-a11y` + Prettier pada scripts. | C-04, C-05 |
| 19 | Tambahkan structured data Product/Article/Breadcrumb + hreflang saat URL bilingual disepakati. | S-04, S-05 |

### P2 — Nice to have (fase lanjutan)

- Font brand self-hosted (woff2, `font-display: swap`) atau finalisasi keputusan sistem font (P-03, D-02).
- Test otomatis: Vitest (unit format/stock) + Playwright smoke untuk Alur A–F (C-07).
- Halaman wishlist `/account/wishlist` (F-10).
- `aria-live` untuk feedback cart/toast; label deskriptif ilustrasi produk (A-07, A-08).
- `formatUSD` 2 desimal (C-06); verifikasi akun email & link sosial asli (C-08).

---

## 6. Keputusan yang Dibutuhkan dari Pemilik

1. **Token warna final** — adopsi persis `#123C2F/#3F7A62/#202321/#F7F4EE/#DED2BF/#B38A55/#737874/#B33A3A` atau perbarui dokumen dengan nilai implementasi saat ini?
2. **URL detail produk final** — project plan masih memuat dua pola (`/shop/[category]/[slug]` dan `/shop/product/[slug]`). Implementasi saat ini memakai pola pertama; dokumen perlu diselaraskan.
3. **Foto & bio owner resmi** untuk owner banner (masih placeholder AI).
4. **Strategi bahasa**: apakah konten ID perlu terindeks (routing `/id/...` + hreflang) atau cukup toggle klien seperti prototipe?
5. **API kurir pertama** (DHL/FedEx/UPS) — dibutuhkan sebelum backend; mock saat ini hanya threshold berat.

---

## 7. Usulan Rencana Perbaikan

| Sprint | Fokus | Item | Estimasi |
|---|---|---|---|
| Sprint 1 | Fungsional kritis | R1–R7, R10 (filter URL, stok, i18n, admin bridge, CTA, search, 404, SEO dasar) | 3–4 hari |
| Sprint 2 | Performa & a11y | R8–R9 (optimasi aset, kontras, landmark, keyboard, target sentuh) | 2–3 hari |
| Sprint 3 | Kelengkapan konten & modul | R11–R15 (Home, product detail, checkout, admin, UI pendukung) | 5–7 hari |
| Sprint 4 | Kualitas & persiapan backend | R16–R19 (data, struktur, lint, test, structured data) + QA Fase 10 + sesi review pemilik | 3–4 hari |

*Estimasi untuk 1 developer frontend; tidak termasuk waktu review pemilik.*

---

## 8. Lampiran — Hasil Perangkat Otomatis

### 8.1 axe-core per halaman

| Halaman | color-contrast | heading-order | region | Total |
|---|---|---|---|---|
| `/` | 4 | – | 3 | 7 |
| `/shop` | 9 | 1 | 3 | 13 |
| `/shop/cabochons/forest-river-cabochon` | 1 | – | 3 | 4 |
| `/cart` | – | – | 3 | 3 |
| `/checkout` | – | – | 3 | 3 |
| `/admin` | – | – | 3 | 3 |
| `/blog` | 1 | – | 3 | 4 |
| `/blog/how-to-read-a-cabochon` | 1 | – | 3 | 4 |
| `/about-us` | 1 | – | 3 | 4 |
| `/contact` | 1 | – | 3 | 4 |

Elemen kontras yang paling sering muncul: `.is-active.nav-link` (bronze di atas ivory), `.product-art__label` (teks putih di atas ilustrasi), `.owner-banner__copy > .eyebrow`.

### 8.2 Lighthouse (mobile preset)

| Metrik | Home | Product Detail |
|---|---|---|
| Performance | 75 | 98 |
| Accessibility | 96 | 96 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |
| LCP | **28,0 dtk** | 2,3 dtk |
| FCP | 0,8 dtk | — |
| TBT | 10 ms | — |
| CLS | 0 | 0 |
| Total byte | 5.857 KiB | 3.857 KiB |

### 8.3 Smoke test HTTP

| Route | Status | Catatan |
|---|---|---|
| 15 route utama (Home, Shop, kategori, produk, blog, cart, checkout, admin, 6 halaman konten) | `200` | OK |
| `/shop/unknown-category` | `200` | ⚠️ harus 404 |
| `/shop/cabochons/does-not-exist` | `200` | ⚠️ harus 404 |
| `/blog/does-not-exist` | `200` | ⚠️ harus 404 |
| `/search` | `404` | Halaman belum ada |
| `/account/wishlist` | `404` | Fase 2 (belum masuk lingkup frontend plan, tetapi sudah ada data wishlist lokal) |

---

*Laporan ini dibuat berdasarkan kondisi kode pada commit `f5f5986`. Audit tidak mencakup pengujian manual di perangkat nyata, pengujian keyboard end-to-end, dan pembacaan screen reader — checklist tersebut disarankan dilakukan pada Sprint 4 (QA Fase 10) sebelum sesi review pemilik.*

---

## 9. Tindak Lanjut P0 — Status Pengerjaan (23 September 2026)

Seluruh **10 rekomendasi P0** telah diimplementasikan pada working tree (belum di-commit). Build & typecheck bersih, tidak ada regresi route.

### 9.1 Ringkasan Status

| # | Rekomendasi P0 | Status | Implementasi |
|---|---|---|---|
| 1 | Taksonomi Home + sinkronisasi filter URL | ✅ Selesai | Home memakai 5 kategori inti (`coreCategories`) dengan tautan `/shop/<slug>`; `ShopCatalog` membaca `useSearchParams` dan menulis kembali `category`/`stone`/`sort` ke URL (`router.replace`), sehingga `/shop?stone=Moss%20Agate` bekerja dan dapat dibagikan |
| 2 | Aturan stok item unik & varian | ✅ Selesai | `stockModel` (`Unique`/`Quantity`) + `maxQuantityFor()` di `lib/catalog.ts`; cart menyimpan `maxQuantity`, add/qty di-clamp; tombol berubah "In your cart"/"Maximum quantity reached"; tombol "Add another to cart" dihapus; kontrol qty unik diganti label "One of a kind — quantity 1" |
| 3 | Dictionary EN/ID + `document.lang` | ✅ Selesai | `lib/i18n.ts` (dua bahasa, parity terjamin tipe `Copy`); UI utama (header, footer, home, shop, kategori, produk, cart, checkout, search, 404) diterjemahkan; `html lang` diperbarui di effect; halaman konten panjang memakai `DraftNote` penanda terjemahan |
| 4 | Bridge admin ↔ storefront | ✅ Selesai | `SiteContentContext` (hero title, owner copy, shipping override) dipersist ke `localStorage`; admin mengubahnya dan langsung tampil di Home/Checkout (Alur D & live preview berjalan) |
| 5 | CTA About Us di owner banner | ✅ Selesai | Tombol `About Us` di owner banner (Alur F) |
| 6 | Pencarian fungsional | ✅ Selesai | Form search di header → `/search?q=`; halaman `/search` mencari nama, jenis batu, kategori, asal, SKU; input memiliki label; panel dapat ditutup dengan Escape |
| 7 | 404 sebenarnya | ✅ Selesai | `dynamicParams = false` pada kategori/produk/artikel; `notFound()`; `app/not-found.tsx` kustom bilingual. URL tak dikenal kini → **HTTP 404** |
| 8 | Optimasi aset gambar | ✅ Selesai | Semua aset dikonversi ke WebP (hero 1,9 MB → **131 KB**; owner 2,0 MB → **109 KB**; logo 860/784 KB → **42/34 KB**); `next/image` dengan `fill`/`preload`/`sizes`; hero direstrukturisasi dari CSS background ke `<Image>` + overlay |
| 9 | Aksesibilitas | ✅ Selesai | Kontras diperbaiki (nav aktif, eyebrow owner, label ilustrasi dengan scrim); announcement bar dibungkus landmark `<header>`; heading `/shop` diperbaiki; Escape + pengembalian fokus untuk menu/search; target sentuh qty 44 px & tombol bahasa ≥24 px; skip link; badge cart punya aria-label berisi jumlah |
| 10 | SEO dasar | ✅ Selesai | `generateMetadata` per halaman + canonical + OG/Twitter + `metadataBase`; `app/sitemap.ts` (33 URL); `app/robots.ts`; JSON-LD `Product` & `Article`; halaman admin/cart/checkout/search `noindex` |

### 9.2 Metrik Verifikasi Sebelum → Sesudah

| Pemeriksaan | Sebelum | Sesudah |
|---|---|---|
| `tsc --noEmit` | Lulus | Lulus |
| `next build` | 38 halaman | **41 halaman** (+ `/search`, `/sitemap.xml`, `/robots.txt`), tanpa error |
| Smoke test route negatif | 3× soft-404 (HTTP 200) | **3× HTTP 404** |
| axe-core violations | 3–13 per halaman (10 halaman) | **0 violations (9 halaman)** |
| Lighthouse Home (mobile) — Performance | 75 | **98** |
| Lighthouse Home — Accessibility | 96 | **100** |
| Lighthouse Home — LCP | 28,0 dtk | **2,4 dtk** |
| Lighthouse Home — Total byte | 5.857 KiB | **256 KiB** |
| Alur demo | A ✓; B, D, E, F gagal | **A–F berjalan** (diverifikasi otomatis, lihat §9.3) |

### 9.3 Verifikasi Interaktif Otomatis (headless Chrome / CDP)

Skrip uji `/tmp/rv-cdp.js` (di luar repo) menjalankan 8 skenario pada build produksi: **8/8 lulus**.

| Skenario | Hasil |
|---|---|
| Ganti bahasa EN→ID: `html lang`, nav, dan hero berubah | ✅ |
| Produk unik tidak dapat ditambahkan dua kali (label & badge cart = 1) | ✅ |
| Override shipping admin tampil di checkout ("Admin override", total $247) | ✅ |
| Simulasi pembayaran sukses mengosongkan cart (badge 0) | ✅ |
| Submit pencarian header → `/search?q=jade` menampilkan hasil | ✅ |
| Escape menutup menu mobile & mengembalikan fokus ke tombol | ✅ |
| Deep-link `/shop?stone=Moss%20Agate&sort=price-low` memfilter 2 produk | ✅ |
| Pilih varian mengubah harga ($42 → $72) | ✅ |

### 9.4 Catatan Teknis

- **PNG lama masih tersimpan** di `public/images` dan `public/brand` sebagai arsip (tidak lagi direferensikan kode). Disarankan memindahkannya ke `assets/` pada sprint berikutnya agar bundle deploy bersih.
- **Log `NoFallbackError`** muncul di server saat request ke parameter yang diblokir `dynamicParams = false`. Respons tetap **404** yang benar; ini log internal Next 16.3.3 (Turbopack) dan tidak memengaruhi pengguna. Pantau pada upgrade berikutnya.
- **Konten panjang belum dwibahasa**: halaman About/FAQ/kebijakan/blog masih English dengan `DraftNote` saat mode ID — sesuai rekomendasi P0 (ditandai draft untuk review), penerjemahan penuh masuk P1.
- **Belum ada commit**: seluruh perubahan berada di working tree.

### 9.5 Sisa Pekerjaan (P1/P2) — Status per 23 September 2026

1. ~~Filter katalog lanjutan (harga, berat, asal, status) + sort "terbaru" (F-08)~~ → **selesai di §10**.
2. Kelengkapan Product Detail: galeri/lightbox, related products, share, accordion, catatan cacat (F-12).
3. Checkout: state Pending/Cancelled/Failed, opsi pengiriman, handling fee fragile/oversized, catatan customs (F-09).
4. Kelengkapan Admin mockup Fase 9 (product/variant editor, order list/detail, reports, payment, system settings) (F-14).
5. UI pendukung: breadcrumb, pagination, quick view, mobile filter drawer, toast (F-13).
6. ~~Mock data ≥20 produk & ≥6 artikel + foto placeholder + skema §7 lengkap (C-01)~~ → **selesai di §10** (28 produk, 6 artikel, gambar placeholder, field skema lengkap).
7. Konten Bahasa Indonesia penuh untuk halaman konten & blog.
8. Kualitas: ESLint + jsx-a11y, Prettier, test otomatis, `error.tsx`, format USD 2 desimal (C-04..C-07).

---

## 10. Tindak Lanjut P1 (a)+(b) — Mock Data & Filter Lanjutan (23 September 2026)

### 10.1 Yang Dikerjakan

| Area | Perubahan |
|---|---|
| **Mock data produk** | 8 → **28 produk** mencakup seluruh 13 kategori (termasuk faceted, spheres, crystal points, carvings, drilled, chips yang sebelumnya kosong); ada produk `Sold`, `Reserved`, fragile, oversized, dan produk bervarian |
| **Skema §7 PROJECT-PLAN** | `Product` kini memuat `currency`, `unit`, `stockModel`/`stockQuantity`, `weightCarat` (turunan), `dimensionsMm` terstruktur, `images[]`, `seo { metaTitle, metaDescription }`, `shipping { packageWeightGram, packageDimensionsMm, shippingProfileId, shippingClass, calculationMethod, packageModel }`, `createdAt`/`updatedAt`; `ProductVariant` memuat `sku`, `dimensionsMm`, `shippingProfileId`. Data dibangkitkan lewat factory `defineProduct()` agar konsisten |
| **Foto placeholder** | 5 ilustrasi SVG per tone di `public/images/products/` (moss, jade, amber, ocean, earth); halaman detail produk kini memakai `<Image>` dengan alt deskriptif (bukan lagi `role="img"`) |
| **Filter katalog lanjutan** | Filter **harga**, **berat**, **asal** (turunan data), dan **status** (Available/Reserved/Sold) + sort **"Newest first"** (berbasis `createdAt`); semua tersinkron URL dan dapat dikombinasikan; tombol **Clear filters** |
| **Blog** | 3 → **6 artikel** (Why Origin Matters, Cabochon or Faceted?, How We Pack Fragile Stones) lengkap dengan isi artikel |
| **Kebersihan kode** | `isSoldOut` & prop `large` pada `ProductArt` dihapus; `stoneTypes` dirapikan (7 jenis batu sesuai data); `formatDimensions()` untuk tampilan dimensi |

### 10.2 Verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `tsc --noEmit` / `next build` | Lulus; **64 halaman** statis/SSG (sebelumnya 41) |
| axe-core (Home, Shop, Produk, Blog, Produk varian) | **0 violations** |
| Sitemap | **56 URL** (sebelumnya 33) |
| Uji interaktif CDP | **13/13 lulus**, termasuk: filter `price=over250` (4 produk, semua > $250), `status=Sold` (1 produk, badge "Sold"), kombinasi `origin`+`category` lalu Clear filters kembali ke `/shop`, produk Sold tidak dapat dibeli (tombol disabled), gambar detail memiliki alt, varian mengubah harga |

### 10.3 Catatan

- Harga pada `seo.metaDescription` dan `shipping.packageWeightGram` dihitung otomatis oleh factory (berat + 45 g kemasan) — angka kemasan adalah estimasi demo, akan digantikan data nyata saat backend.
- Foto placeholder masih ilustrasi per-tone (bukan per-produk); foto asli tetap item wajib dari pemilik sebelum peluncuran (lihat keputusan §6).
- Sisa P1: Product Detail lengkap, Checkout states, Admin modules, UI pendukung (breadcrumb/pagination/quick view/drawer/toast), konten ID, dan kualitas kode.
