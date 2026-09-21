# Rencana Implementasi Frontend & UI/UX

## RENDI VIRGO — Online Store

Dokumen ini mengatur fase pertama pembangunan website RENDI VIRGO. Fokus fase ini adalah menyelesaikan seluruh tampilan frontend dan alur pengalaman pengguna agar dapat direview secara visual sebelum database, backend, pembayaran nyata, dan integrasi pengiriman dibangun.

---

## 1. Tujuan Fase

Fase frontend harus menghasilkan prototype website yang:

- dapat dibuka dan dinavigasi seperti website toko sungguhan;
- menampilkan seluruh halaman utama dan halaman pendukung;
- memiliki alur Home → Shop → Product Detail → Cart → Checkout;
- memiliki alur bahasa English dan Bahasa Indonesia;
- menampilkan simulasi PayPal tanpa transaksi nyata;
- menampilkan simulasi kalkulasi shipping berdasarkan total berat satu paket;
- memiliki mock dashboard admin untuk melihat dan mengubah konten utama;
- responsif pada desktop, tablet, dan mobile;
- siap direview oleh pemilik sebelum backend dan database dimulai.

## 2. Batasan Pekerjaan

### 2.1 Termasuk dalam fase ini

- Next.js dengan App Router.
- TypeScript.
- Design system dan reusable UI components.
- Local mock data dalam file TypeScript/JSON.
- Client-side state untuk cart, filter, bahasa, shipping simulation, dan status demo.
- Halaman storefront publik.
- Halaman checkout visual.
- Halaman admin visual dengan perubahan data lokal.
- Responsive behavior dan accessibility dasar.
- Placeholder untuk PayPal, shipping API, email, dan upload gambar.

### 2.2 Tidak termasuk dalam fase ini

- Database PostgreSQL.
- NestJS API atau backend service.
- Prisma schema dan migration.
- Login dan autentikasi nyata.
- Pembayaran PayPal nyata atau webhook PayPal.
- API DHL/FedEx/UPS nyata.
- Pengiriman email nyata.
- Penyimpanan gambar ke cloud storage.
- Sinkronisasi stok antar perangkat.
- Deployment production final.

Semua fitur yang membutuhkan server harus menggunakan mock adapter agar UI tetap dapat didemonstrasikan tanpa backend.

## 3. Keputusan Brand yang Digunakan

- Nama brand: **RENDI VIRGO**.
- Owner banner: **RENDI VIRGO**.
- Bahasa default: **English**.
- Bahasa kedua: **Bahasa Indonesia**.
- Mata uang demo: **USD**.
- Metode pembayaran demo: **PayPal**.
- Pengiriman: seluruh dunia.
- Model pengiriman: satu paket berdasarkan total berat seluruh produk.
- Tarif shipping: simulasi API sebagai default, dengan kemampuan override admin.
- Logo utama: `assets/branding/rendi-virgo-logo.png`.
- Logo alternatif: `assets/branding/rendi-virgo-logo-black-silver.png`.
- Warna utama: forest green, jade green, stone black, warm ivory, sand, dan muted bronze.
- Mockup homepage yang disetujui: `assets/mockups/rendi-virgo-homepage-mockup.png`.

### 3.1 Arah Mockup Homepage yang Disetujui

Implementasi frontend harus mengikuti mockup homepage utama dengan karakter berikut:

- header horizontal dengan logo di kiri dan navigasi di tengah;
- announcement bar hijau di bagian paling atas;
- hero photo banner lebar dengan headline di sisi kiri;
- owner banner horizontal “Meet RENDI VIRGO”;
- featured categories dalam satu baris;
- featured stones dalam product grid;
- trust bar untuk Authentic Indonesian Stones dan Worldwide Shipping;
- footer hijau gelap dengan navigasi dan social links.

Mockup editorial dengan sidebar vertikal tetap disimpan sebagai alternatif visual, tetapi bukan acuan implementasi utama.

## 4. Struktur Teknis Frontend

### 4.1 Teknologi

- Next.js versi yang ditetapkan dalam dokumen proyek.
- TypeScript.
- React Server Components untuk konten statis dan layout.
- Client Components hanya untuk interaksi seperti filter, cart, language switcher, modal, dan checkout.
- CSS variables untuk design tokens.
- Tailwind CSS atau sistem utility CSS yang setara, apabila disetujui saat setup proyek.
- `next/image` untuk optimasi foto produk dan banner.
- Local mock repository sebagai pengganti API.

### 4.2 Struktur folder yang disarankan

```text
src/
├── app/
│   ├── page.tsx
│   ├── about-us/page.tsx
│   ├── shop/page.tsx
│   ├── shop/[category]/page.tsx
│   ├── shop/[category]/[slug]/page.tsx
│   ├── blog/page.tsx
│   ├── blog/[slug]/page.tsx
│   ├── cart/page.tsx
│   ├── checkout/page.tsx
│   ├── contact/page.tsx
│   ├── faq/page.tsx
│   ├── shipping-returns/page.tsx
│   ├── privacy-policy/page.tsx
│   ├── terms-conditions/page.tsx
│   └── admin/
├── components/
│   ├── layout/
│   ├── navigation/
│   ├── home/
│   ├── catalog/
│   ├── product/
│   ├── cart/
│   ├── checkout/
│   ├── content/
│   └── ui/
├── data/
│   ├── products.ts
│   ├── categories.ts
│   ├── blog-posts.ts
│   ├── testimonials.ts
│   ├── shipping-rates.ts
│   └── owner.ts
├── features/
│   ├── cart/
│   ├── catalog/
│   ├── checkout/
│   ├── localization/
│   └── admin-demo/
├── lib/
│   ├── mock-api/
│   ├── formatters/
│   └── validators/
├── styles/
│   ├── tokens.css
│   └── globals.css
└── types/
    ├── product.ts
    ├── order.ts
    ├── shipping.ts
    └── content.ts
```

### 4.3 Aturan mock data

- Mock data harus mengikuti skema produk pada `PROJECT-PLAN.md`.
- Setiap produk memiliki SKU, kategori, harga USD, berat, dimensi, foto, kondisi, asal, dan status stok.
- Produk unik menggunakan `stock_quantity: 1`.
- Produk dengan varian memiliki harga, stok, berat, dimensi, dan shipping profile masing-masing.
- Mock data harus mencakup produk yang tersedia, sold, reserved, fragile, oversized, dan produk dengan beberapa varian.
- Data demo tidak boleh ditulis langsung di komponen UI.

## 5. Fase Implementasi

### Fase 0 — Persiapan dan Inventaris Aset

Output:

- struktur project Next.js;
- logo utama dan alternatif terhubung;
- folder aset untuk logo, banner, owner photo, product photo, dan blog image;
- daftar kategori dan URL final;
- daftar kebutuhan konten yang masih kosong.

Aktivitas:

- siapkan logo RENDI VIRGO;
- siapkan placeholder hero photo;
- siapkan placeholder owner photo RENDI VIRGO;
- siapkan minimal 20 mock products untuk menguji katalog;
- siapkan minimal 6 mock blog posts;
- siapkan translation dictionary English dan Bahasa Indonesia.

### Fase 1 — Design Tokens dan Base UI

Output:

- color tokens;
- typography scale;
- spacing scale;
- container dan grid;
- button, input, select, badge, alert, modal, accordion, tabs, breadcrumb, pagination, dan loading state.

Kriteria selesai:

- semua komponen memiliki state default, hover, focus, disabled, loading, error, dan success bila relevan;
- komponen dapat digunakan ulang tanpa membuat style baru di setiap halaman;
- warna dan typography sesuai Bagian 11 pada `PROJECT-PLAN.md`.

### Fase 2 — App Shell dan Navigasi

Bangun:

- announcement bar;
- header desktop;
- mobile navigation drawer;
- logo link ke Home;
- Shop dropdown/mega menu;
- search trigger;
- language switcher;
- cart indicator;
- footer;
- breadcrumb;
- notification/toast system.

Alur demo:

- pengguna dapat berpindah antar halaman tanpa dead end;
- language switcher mengubah teks UI dari English ke Bahasa Indonesia;
- cart indicator berubah saat produk ditambahkan;
- mobile drawer dapat dibuka, dinavigasi, dan ditutup dengan keyboard.

### Fase 3 — Home Page

Urutan section:

1. Announcement bar untuk pengiriman internasional.
2. Hero photo banner dengan headline English dan CTA `Explore the Collection`.
3. Owner banner RENDI VIRGO dengan foto, bio singkat, dan CTA `About Us`.
4. Lima kategori inti.
5. Featured products.
6. Section kepercayaan dan keaslian.
7. Cerita sourcing batu Indonesia.
8. Latest blog.
9. Testimonials.
10. Newsletter signup.
11. Final CTA menuju Shop atau Contact.

Kriteria visual:

- hero image memiliki desktop crop dan mobile crop;
- teks memiliki kontras yang cukup terhadap foto;
- owner banner terasa personal, bukan stock-photo advertisement;
- section tidak terlalu padat dan memiliki whitespace yang cukup;
- semua gambar memiliki alt text demo.

### Fase 4 — Shop dan Katalog

Bangun:

- halaman `/shop`;
- halaman kategori;
- filter kategori, jenis batu, harga, berat, asal, dan status;
- sorting terbaru, harga rendah, harga tinggi, dan featured;
- product grid;
- empty state;
- loading state;
- sold-out state;
- quick view atau preview detail;
- mobile filter drawer.

Data demo harus membuktikan:

- produk unik dapat menampilkan `One of a Kind`;
- produk sold tidak dapat dimasukkan ke cart;
- produk reserved memiliki status yang jelas;
- produk dengan varian menampilkan pilihan varian;
- harga seluruhnya ditampilkan dalam USD.

### Fase 5 — Product Detail

Bangun halaman detail dengan:

- gallery foto multi-angle;
- zoom dan lightbox;
- nama, kategori, jenis batu, harga, dan status stok;
- tabel spesifikasi;
- informasi asal Indonesia;
- kondisi dan treatment;
- catatan kekurangan produk;
- shipping summary berbasis mock total berat;
- CTA `Add to Cart` dan `Buy Now`;
- related products;
- share action;
- accordion untuk description, shipping, returns, dan care guide.

Alur demo:

- memilih varian mengubah harga, berat, stok, dan ringkasan shipping;
- produk unik hanya dapat ditambahkan satu kali;
- produk sold menonaktifkan tombol pembelian;
- pengguna dapat kembali ke kategori tanpa kehilangan posisi navigasi.

### Fase 6 — Cart dan Shipping Simulation

Bangun cart state lokal untuk:

- tambah produk;
- ubah jumlah untuk produk quantity-based;
- hapus produk;
- menyimpan cart selama sesi demo;
- menampilkan subtotal;
- menghitung total berat satu paket;
- memilih negara tujuan;
- menampilkan tarif dari mock shipping API;
- menerapkan admin override dari mock configuration;
- menampilkan total USD.

Aturan simulasi:

- API rate menjadi nilai default;
- admin override menggantikan API rate;
- semua produk dalam cart dihitung sebagai satu paket;
- produk fragile atau oversized dapat menambahkan handling fee demo;
- nilai demo harus menampilkan asal tarif agar alurnya mudah dipahami.

### Fase 7 — Checkout dan PayPal Placeholder

Bangun checkout tanpa transaksi nyata:

- form customer dan alamat internasional;
- country selector seluruh dunia;
- ringkasan produk;
- ringkasan berat dan shipping;
- subtotal, shipping, handling, dan total USD;
- tombol PayPal placeholder;
- state `Payment Pending`, `Payment Success`, `Payment Cancelled`, dan `Payment Failed`;
- halaman order confirmation demo.

Batasan penting:

- jangan meminta atau menyimpan kredensial PayPal;
- jangan mengirim transaksi ke PayPal;
- jangan mengubah stok permanen;
- simulasi pembayaran hanya mengubah state lokal untuk keperluan review UI.

### Fase 8 — Content Pages dan Blog

Bangun:

- About Us dengan cerita RENDI VIRGO;
- sourcing story;
- Contact;
- FAQ;
- Shipping & Returns;
- Privacy Policy;
- Terms & Conditions;
- Blog listing;
- Blog detail;
- related posts;
- newsletter success state.

Setiap halaman harus memiliki versi English. Versi Bahasa Indonesia menggunakan translation mock atau konten terjemahan sementara yang ditandai untuk review.

### Fase 9 — Admin Dashboard Mockup

Dashboard admin hanya berupa UI demo dengan local state.

Bangun halaman:

- overview;
- product list;
- product editor;
- variant editor;
- shipping profile editor;
- order list;
- order detail;
- content/banner manager;
- owner banner editor;
- payment settings read-only/mock;
- reports preview;
- system settings.

Alur demo admin:

- mengubah judul hero banner;
- mengganti foto hero dengan placeholder;
- mengubah bio owner;
- mengubah status produk;
- mengubah harga demo;
- membuat shipping override;
- melihat perubahan tampil pada storefront melalui local state.

Yang belum dilakukan:

- tidak ada login nyata;
- tidak ada upload nyata;
- tidak ada penyimpanan permanen;
- tidak ada perubahan PostgreSQL;
- tidak ada pengiriman email atau webhook.

### Fase 10 — Responsive, Accessibility, dan Visual QA

Uji tampilan pada:

- desktop lebar;
- laptop;
- tablet portrait dan landscape;
- iPhone-sized mobile;
- Android-sized mobile.

Checklist:

- tidak ada horizontal overflow;
- semua tombol dapat digunakan dengan keyboard;
- focus state terlihat;
- form memiliki label dan error message;
- gambar memiliki alt text;
- harga dan status stok tidak hanya dibedakan dengan warna;
- modal dan drawer dapat ditutup dengan Escape;
- ukuran touch target nyaman untuk mobile;
- layout tidak bergeser ketika gambar dimuat;
- halaman tidak memiliki dead link.

### Fase 11 — Review dengan Pemilik

Sesi review harus mengikuti urutan:

1. Home dan brand impression.
2. Navigasi dan language switcher.
3. Shop, filter, dan kategori.
4. Product detail dan foto.
5. Cart dan shipping simulation.
6. Checkout dan PayPal placeholder.
7. About Us dan owner banner.
8. Admin dashboard mockup.
9. Mobile experience.

Setiap feedback dicatat sebagai:

- Must fix sebelum frontend disetujui.
- Should fix sebelum backend dimulai.
- Nice to have untuk fase lanjutan.

Backend dan database baru boleh dimulai setelah kategori `Must fix` selesai atau secara eksplisit disetujui untuk ditunda.

## 6. Alur Demo yang Wajib Berhasil

### Alur A — Browsing

Home → Shop → Category → Product Detail → kembali ke Shop.

### Alur B — Pembelian produk unik

Home → Product Detail → Add to Cart → Cart → Checkout → PayPal Success Mock → Confirmation.

### Alur C — Produk dengan varian

Shop → Product Detail → pilih varian → harga/berat/stok berubah → Add to Cart → shipping dihitung ulang.

### Alur D — Shipping override

Admin Mockup → Shipping Profile → ubah override → Cart/Checkout → tarif baru tampil.

### Alur E — Bahasa

English → pilih Bahasa Indonesia → halaman dan komponen UI berubah → kembali ke English.

### Alur F — Owner banner

Home → Owner Banner → About Us → kembali ke Home.

## 7. Kriteria Frontend Disetujui

Frontend dianggap siap masuk fase backend apabila:

- semua route prioritas dapat dibuka;
- Home, Shop, Product Detail, Cart, Checkout, dan Admin Mockup sudah dapat diklik;
- English dan Bahasa Indonesia bekerja pada UI utama;
- PayPal hanya berupa placeholder/demo;
- shipping API hanya berupa mock dengan override admin;
- seluruh harga demo menggunakan USD;
- tidak ada database dan backend yang dibutuhkan untuk menjalankan demo;
- tidak ada error console yang kritikal;
- layout lolos review desktop, tablet, dan mobile;
- logo, warna, tipografi, dan banner owner konsisten;
- pemilik menyetujui screenshot dan alur utama secara tertulis.

## 8. Artefak yang Harus Dihasilkan

- source code frontend;
- mock data produk, kategori, blog, owner, shipping, dan testimonials;
- design tokens;
- reusable component library;
- halaman storefront;
- halaman admin mockup;
- translation dictionary English dan Bahasa Indonesia;
- screenshot desktop/tablet/mobile;
- daftar feedback dan keputusan review;
- catatan item yang akan diteruskan ke backend.

## 9. Keputusan yang Masih Dibutuhkan Sebelum Coding

- Konfirmasi foto dan bio untuk owner banner RENDI VIRGO.
- Konfirmasi API kurir pertama yang akan digunakan setelah backend dimulai: DHL, FedEx, atau UPS.
- Konfirmasi apakah URL detail produk final menggunakan `/shop/[category]/[slug]` atau `/shop/product/[slug]`, karena dokumen utama masih memuat dua pola tersebut.
- Konfirmasi ukuran dan resource Hostinger VPS untuk menjalankan frontend, API, dan PostgreSQL pada fase berikutnya.

---

## 10. Urutan Setelah Frontend Disetujui

1. Finalisasi data model PostgreSQL.
2. Implementasi NestJS API.
3. Implementasi Prisma schema dan migration.
4. Migrasi mock data ke database.
5. Implementasi autentikasi admin.
6. Implementasi PayPal sandbox dan webhook.
7. Implementasi shipping API dan admin override permanen.
8. Hubungkan frontend ke API.
9. Testing end-to-end.
10. Deployment production di Hostinger VPS.
