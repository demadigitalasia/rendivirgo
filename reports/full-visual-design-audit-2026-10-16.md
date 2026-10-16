# Audit Konsistensi Desain dan Tata Letak — RENDI VIRGO

**Tanggal:** 16 Oktober 2026  
**Cakupan:** halaman storefront dan route admin yang terdaftar di source  
**Mode:** audit read-only; tidak ada kode aplikasi yang diubah

## Ringkasan

Storefront sudah memiliki identitas visual yang cukup konsisten: palet hijau hutan dan ivory, judul serif editorial, navigasi serta footer yang berulang, dan kartu produk yang seragam. Pada halaman yang berhasil dirender, tata letak tetap berada di dalam viewport pada lebar desktop 1280 px, tablet 768 px, dan mobile 390 px. Saya tidak menemukan overflow horizontal tingkat halaman pada ukuran tersebut.

Prioritas perbaikan adalah memastikan halaman informasi penting tidak berubah menjadi 404 saat API tidak tersedia, membedakan kegagalan pencarian dari hasil kosong, serta memvalidasi aset produk dan data sebelum dipublikasikan. Halaman login admin juga responsif. Tampilan dashboard admin belum dapat dinilai secara visual karena semua route dashboard mengalihkan pengunjung tanpa sesi ke login.

## Prioritas

- **P1 — sebelum launch:** halaman penting saat ini tidak bisa diverifikasi dan menampilkan 404 dalam lingkungan audit. Pastikan konten serta perilaku saat API bermasalah sebelum menyatakan route siap.
- **P2 — penting:** keadaan API/data atau aset membuat pengguna melihat hasil yang berpotensi menyesatkan atau halaman kehilangan sebagian kualitas visual.
- **P3 — penyempurnaan:** konsistensi dan polesan; tidak teramati sebagai hambatan penggunaan pada ukuran yang diuji.

## Metode dan batas audit

- Membuka storefront pada lebar desktop **1280 px**, tablet **768 px**, dan mobile **390 px**; membandingkan header, hero, grid, formulir, footer, serta scroll width halaman.
- Menginspeksi tampilan browser dan accessibility tree, serta mencocokkan temuan dengan route dan source yang relevan.
- API lokal `localhost:4000` tidak menerima koneksi selama audit. Karena itu, temuan yang bergantung pada konten API, pencarian, pengiriman, pembayaran, dan URL upload dicatat sebagai kondisi lingkungan yang terlihat—bukan bukti bahwa semua lingkungan produksi akan selalu mengalami kondisi yang sama.
- Semua route dashboard admin mengalihkan ke `/admin/login` karena sesi admin tidak tersedia. Source route dan guard dapat diinventarisasi, tetapi isi dashboard tidak diklaim telah diperiksa lewat layar.
- Route blog artikel menggunakan satu template dinamis. Saya memeriksa satu artikel secara visual; variasi isi keenam slug dicantumkan agar cakupan tidak disalahartikan sebagai inspeksi visual satu per satu.

## Temuan dan rekomendasi

### P1 — Halaman kebijakan penting tampil sebagai 404 saat API tidak tersedia

**Halaman:** `/shipping-returns`, `/privacy-policy`, `/terms-conditions`  
**Bukti:** Ketiganya menampilkan halaman 404 bermerek pada browser. `ApiContentPage` memanggil `notFound()` ketika `getPage(slug)` tidak mengembalikan konten (`components/api-content-page.tsx:18–28`). `apiGet` mengubah kegagalan koneksi menjadi `null` (`lib/storefront.ts:242–257`), sehingga kegagalan backend dan record yang memang tidak ada berujung pada hasil UI yang sama.

**Rekomendasi:** Pastikan ketiga record tersedia dan route lolos pemeriksaan pada konfigurasi API yang dipakai saat launch. Pisahkan keadaan “konten belum tersedia/API gagal” dari 404 permanen; sediakan fallback informatif untuk halaman kebijakan agar tautan legal dan pengiriman tidak berakhir pada 404 ketika CMS sementara tidak dapat dihubungi. Jangan menganggap data legal lengkap hanya dari metadata fallback.

### P2 — Pencarian dapat menyajikan kegagalan API sebagai “tidak ada hasil”

**Halaman:** `/search?q=jasper`  
**Bukti:** Browser menampilkan jumlah hasil nol dan empty state. `getProducts` memetakan respons null menjadi `products: []` dan `total: 0` (`lib/storefront.ts:297–308`); komponen hasil lalu memakai empty state yang sama saat daftar kosong (`components/search-results.tsx:43–58`). Dengan API lokal yang tidak tersedia, layar tidak membedakan error layanan dari pencarian yang valid tanpa kecocokan.

**Rekomendasi:** Pertahankan empty state untuk pencarian valid yang memang nihil, tetapi sediakan state error/retry ketika API gagal. Pastikan teks jumlah hasil dan pesan kosong tidak menyatakan kepastian yang tidak diketahui.

### P2 — Aset watermark pada foto produk gagal dimuat di dua detail yang diuji

**Halaman:** `/shop/cabochons/emerald-garden-cabochon`, `/shop/pair/jade-twin-pair`  
**Bukti:** Kedua halaman menunjukkan foto utama produk, tetapi terdapat area logo/watermark kecil yang gagal dimuat pada sudut foto. URL aset yang diamati berasal dari upload di `localhost:4000`; API/upload lokal tidak tersedia selama audit, jadi penyebab dapat berupa host aset lingkungan uji atau referensi file yang tidak valid.

**Rekomendasi:** Verifikasi URL gambar dan watermark pada deployment yang dituju. Jika file opsional gagal, sembunyikan lapisan watermark yang gagal agar ikon rusak tidak tampak; tetapkan fallback gambar yang konsisten untuk aset produk yang wajib.

### P2 — Kelengkapan data produk belum konsisten

**Halaman:** kartu katalog dan detail produk  
**Bukti:** Pada produk yang diamati, beberapa item menampilkan label asal `NOT PROVIDED`. Ini merusak kesan editorial premium dan menurunkan keyakinan pembeli pada metadata asal batu.

**Rekomendasi:** Jangan tampilkan placeholder internal kepada pelanggan. Isi asal yang sudah diverifikasi, atau hilangkan atribut tersebut sampai tersedia; gunakan satu gaya fallback yang jelas bila data bersifat opsional.

### P2 — Checkout menampilkan gangguan layanan dengan baik, tetapi belum tervalidasi pada alur normal

**Halaman:** `/checkout`  
**Bukti:** Form checkout berhasil tampil dan tidak overflow, namun pada lingkungan audit menunjukkan pesan bahwa ongkir tidak dapat dihitung dan ketersediaan pembayaran tidak dapat diperiksa. Pesan menyediakan tindakan coba lagi (`lib/i18n.ts:354–359`, versi Indonesia `lib/i18n.ts:824–829`). Penyebab yang diketahui: API lokal tidak dapat dihubungi.

**Rekomendasi:** Ulangi inspeksi dengan API normal untuk memastikan kondisi loading, sukses, dan retry tidak menumpuk atau menggeser ringkasan checkout. Pesan saat ini jelas; pastikan CTA retry dan nilai total tetap mudah ditemukan di mobile.

### P3 — Konsistensi responsif storefront sudah baik; rapikan sumber aturan breakpoint sebagai tindak lanjut

**Halaman:** seluruh template storefront yang berhasil dirender  
**Bukti:** Pada 1280/768/390 px, halaman yang dirender tidak melebar melewati viewport. Header, hero, grid produk, form, dan footer beradaptasi dengan baik; katalog menjadi grid dua kolom di mobile dan panel filter beralih ke kontrol mobile. Aturan tersebar pada `app/(storefront)/storefront.css`, `app/globals.css`, `components/product-detail.css`, dan stylesheet komponen; breakpoint yang dipakai meliputi 1100, 980, 720, 700, dan 370 px.

**Rekomendasi:** Saat mengerjakan perubahan desain berikutnya, dokumentasikan breakpoint bersama dan cek komponen khusus di dekat batas (misalnya 980/720 px), supaya revisi satu template tidak menghasilkan perpindahan layout yang berbeda tanpa sengaja. Tidak ada kebutuhan perubahan segera berdasarkan overflow pada tiga ukuran yang diuji.

## Catatan per halaman

| Halaman / route | Desktop | Tablet | Mobile | Bukti dan catatan |
|---|---|---|---|---|
| Beranda `/` | Baik | Baik | Baik | Hero editorial, CTA, trust bar, kategori, dan produk tetap terbaca; tidak ada overflow pada 1280/768/390 px. Animasi masuk perlu selesai sebelum penilaian visual. |
| Katalog `/shop` | Baik | Baik | Baik | Hero katalog, toolbar/filter, dan grid kartu produk tersusun rapi; mobile memakai dua kolom dan kontrol filter ringkas. |
| Kategori `/shop/cabochons`, `/shop/rough` | Baik | Baik | Baik | Halaman kategori memakai pola katalog yang konsisten dan tanpa overflow. Dua route ini yang diamati langsung. |
| Detail produk `/shop/cabochons/emerald-garden-cabochon`, `/shop/pair/jade-twin-pair` | Baik dengan catatan P2 | Baik | Baik dengan catatan P2 | Foto utama dan kolom detail tersusun baik di desktop; mobile menumpuk gambar lalu informasi. Area watermark gagal dimuat pada kedua produk dalam lingkungan audit. |
| Pencarian `/search?q=jasper` | P2 | P2 | P2 | Empty state muncul ketika API tidak dapat dihubungi; pengguna tidak dapat membedakan error dari hasil valid nol. |
| Keranjang `/cart` | Baik | Baik | Baik | Badge header dan isi halaman sama-sama menunjukkan satu item setelah halaman stabil; ringkasan order mudah ditemukan. |
| Checkout `/checkout` | P2 | P2 | P2 | Form responsif tanpa overflow. Ongkir dan ketersediaan pembayaran menunjukkan error karena API audit offline; jalur sukses belum dapat diverifikasi. |
| Wishlist `/wishlist` | Baik | Baik | Baik | Empty state tampil sebagai halaman tersendiri dengan gaya storefront; tidak ada overflow. |
| Jurnal `/blog` | Baik | Baik | Baik | Hero editorial dan kartu artikel mengikuti visual storefront; listing menampilkan enam panduan. |
| Artikel `/blog/[slug]` | Baik* | Baik* | Baik* | Satu artikel (`how-to-read-a-cabochon`) diperiksa langsung. Slug listing: `from-indonesia-to-your-workbench`, `caring-for-polished-stones`, `why-origin-matters`, `cabochon-or-faceted`, dan `packing-fragile-stones`; kontennya tidak diperiksa satu per satu. |
| Tentang `/about-us` | Baik | Baik | Baik | Halaman cerita/about berhasil dirender dan tetap mengikuti palet, judul, dan lebar konten storefront. |
| Kontak `/contact` | Baik | Baik | Baik | Hero/form tampil tanpa overflow pada ukuran uji. |
| FAQ `/faq` | Baik | Baik | Baik | Konten dan struktur halaman tetap terbaca pada lebar mobile. |
| Pengiriman & retur `/shipping-returns` | P1 | P1 | P1 | Menampilkan 404 karena halaman konten tidak tersedia melalui API dalam lingkungan audit. |
| Permintaan retur `/returns` | Baik | Baik | Baik | Form permintaan retur tampil dan responsif; route ini berbeda dari halaman kebijakan shipping/returns yang 404. |
| Lacak pesanan `/track` | Baik | Baik | Baik | Form pelacakan tampil dan tanpa overflow. |
| Riwayat pesanan `/orders` | Baik | Baik | Baik | Form pencarian order tampil dan tanpa overflow. |
| Privasi `/privacy-policy` | P1 | P1 | P1 | Menampilkan 404 pada lingkungan audit; konten penting belum terlihat. |
| Ketentuan `/terms-conditions` | P1 | P1 | P1 | Menampilkan 404 pada lingkungan audit; konten penting belum terlihat. |
| Route tidak ditemukan | Baik | Baik | Baik | Fallback 404 storefront bermerek terlihat. |
| Admin login `/admin/login` | Baik | — | Baik | Login diperiksa pada desktop; halaman reset/forgot juga diperiksa pada mobile. Kartu form terpusat dengan latar hijau gelap dan tanpa overflow. |
| Admin lupa password `/admin/forgot-password` | — | — | Baik | Form berada dalam pola kartu auth yang sama; responsif pada mobile. |
| Admin reset password `/admin/reset-password` | — | — | Baik | Judul dan form “Choose a new password” tampil dalam pola auth yang konsisten. |
| Admin dashboard dan modul terlindungi | Tidak dapat dinilai | Tidak dapat dinilai | Tidak dapat dinilai | Semua route di bawah mengalihkan ke login karena sesi tidak tersedia; guard ada di `app/admin/(dashboard)/layout.tsx:7–26`. |

`Baik` berarti layout yang terlihat pada ukuran uji konsisten dan tidak menunjukkan overflow; ini bukan klaim bahwa semua perilaku fungsional backend telah diuji. `—` berarti ukuran tersebut tidak menjadi fokus screenshot halaman auth pada run ini.

### Inventaris route dashboard yang belum bisa dinilai secara visual

`/admin`, `/admin/catalog`, `/admin/categories`, `/admin/conditions`, `/admin/content/banners`, `/admin/content/blog`, `/admin/content/blog/[id]`, `/admin/content/home`, `/admin/content/pages`, `/admin/content/pages/[id]`, `/admin/content/testimonials`, `/admin/customers`, `/admin/customers/[id]`, `/admin/discounts`, `/admin/messages`, `/admin/newsletter`, `/admin/orders`, `/admin/orders/[id]`, `/admin/orders/[id]/invoice`, `/admin/products`, `/admin/products/new`, `/admin/products/[id]`, `/admin/reports`, `/admin/reviews`, `/admin/settings`, `/admin/settings/shipping`, dan `/admin/system`.

## Urutan tindak lanjut yang disarankan

1. Pastikan konten shipping/returns, privacy, dan terms tersedia di lingkungan target; validasi route dengan API aktif dan tetapkan fallback yang tidak menyamarkan gangguan sebagai 404.
2. Bedakan error API dari empty state di pencarian; lakukan inspeksi ulang setelah API tersedia.
3. Validasi URL upload/watermark dan kelengkapan origin untuk katalog yang tampil ke publik.
4. Ulangi checkout pada kondisi API normal, lalu audit dashboard admin dengan sesi yang sah.
5. Pertahankan pemeriksaan responsive di 1280/768/390 px dan tambahkan ukuran dekat breakpoint saat ada perubahan CSS.

## Artefak dan perubahan

Audit ini hanya menambahkan laporan Markdown ini. Tidak ada source code aplikasi yang diubah dalam pekerjaan audit ini. Working tree sudah berisi perubahan lain saat pemeriksaan status dilakukan; perubahan tersebut tidak disentuh.

## Status tindak lanjut setelah persetujuan

Setelah laporan diserahkan dan rekomendasi disetujui, beberapa perbaikan UI diterapkan:

- Kegagalan API untuk halaman konten kini menampilkan pesan sementara dengan aksi coba lagi dan tautan kontak; HTTP 404 tetap menjadi 404.
- Pencarian membedakan gangguan layanan dari hasil valid tanpa kecocokan, dan percobaan ulang meminta data terbaru.
- Watermark produk disembunyikan jika file logonya gagal dimuat.
- Nilai asal seperti `NOT PROVIDED`, `Unknown`, dan `N/A` disembunyikan dari katalog, detail, metadata SEO, dan structured data.

Konten legal tidak dibuat atau diubah. Karena API lokal masih tidak tersedia, jalur sukses konten/pencarian dan checkout tetap perlu diperiksa pada lingkungan dengan API aktif. Dashboard admin juga masih memerlukan sesi sah untuk audit visual.
