# Audit Navigasi Katalog Wholesale

**Tanggal:** 18 Oktober 2026  
**Halaman:** `http://localhost:3001/wholesale`  
**Tujuan:** Menilai apakah customer yang sudah mendapat akses Wholesale dapat menemukan katalog, menyaring produk, melanjutkan order, dan kembali ke akun atau riwayat order dengan mudah.

## Ringkasan

Halaman sudah menyediakan alat dasar untuk mencari, menyaring, mengurutkan, dan menjelajahi katalog yang besar. Kategori memiliki pencarian, jumlah hasil terlihat, ukuran halaman bisa diubah, status filter dapat dihapus, panel filter mobile dapat dilipat, dan ringkasan order mengarah ke checkout.

Kekurangan utamanya adalah navigasi tugas Wholesale belum membentuk satu pola yang jelas. Navigasi global tidak memiliki item Wholesale; akses katalog ditemukan dari akun atau URL. Saat berada di katalog, satu-satunya tautan khusus menuju akun, sedangkan order history tidak terlihat. Keranjang Wholesale juga terpisah dari keranjang Retail, tetapi pemisahan itu belum cukup jelas pada navigasi global. Filter aktif hanya ditampilkan sebagai hitungan, sehingga customer perlu membuka panel untuk mengingat filter mana yang sedang diterapkan.

**Rekomendasi utama:** tambahkan navigasi lokal Wholesale yang konsisten di halaman katalog dan checkout, lalu tampilkan filter aktif sebagai chip yang dapat dihapus di dekat hasil katalog. Ini akan memperjelas tiga pekerjaan utama customer: mencari barang, meninjau order Wholesale, dan memeriksa order sebelumnya.

## Metode dan batas audit

- Memeriksa halaman Wholesale yang sedang berjalan melalui accessibility tree browser lokal. Halaman menampilkan katalog, 13 kategori, pencarian, filter stok/material/origin/harga, sort, jumlah hasil, kontrol halaman, kartu produk, ringkasan minimum order, dan ringkasan keranjang.
- Meninjau komponen katalog, navigasi Customer dashboard, dan tujuan tautan pada checkout.
- Ini audit heuristik atas implementasi dan halaman lokal. Audit ini tidak mencakup sesi usability dengan customer, analytics penggunaan, atau pengujian pada semua ukuran layar.

## Temuan

| Prioritas | Temuan | Dampak pada customer |
|---|---|---|
| **P1** | Tidak ada navigasi lokal Wholesale untuk berpindah antara katalog, order berjalan, riwayat order, dan akun. Header global menampilkan Account dan shopping cart umum; katalog hanya menambahkan tautan Customer account dan ringkasan checkout saat keranjang Wholesale berisi barang. | Customer dapat bingung membedakan order Wholesale dari keranjang Retail dan harus kembali ke akun untuk mencari riwayat order. |
| **P1** | Filter aktif diringkas sebagai jumlah, misalnya “3 active”, tanpa nama filter yang diterapkan. Di mobile, isi panel filter ditutup sampai dibuka kembali. | Customer tidak dapat memeriksa konteks hasil katalog dengan cepat dan sulit menghapus satu filter tertentu. |
| **P2** | Perubahan katalog memperbarui URL dengan `router.replace`. URL dapat disalin atau dimuat ulang dengan state filter, tetapi tombol Back/Forward browser tidak menelusuri langkah perubahan filter atau halaman katalog sebelumnya. | Sulit membatalkan langkah eksplorasi terakhir; customer berisiko meninggalkan katalog saat memakai tombol Back. |
| **P2** | Filter pilihan (kategori, stok, material, dan asal) langsung diterapkan; rentang harga menunggu tombol “Apply price”; pencarian diterapkan setelah jeda singkat. | Tiga pola penerapan filter yang berbeda membuat customer perlu menebak kapan hasil akan berubah. |
| **P2** | Kontrol sort, jumlah produk per halaman, dan status hasil tersebar dalam dua baris yang berbeda. Pagination hanya berada di bawah daftar produk. | Untuk katalog panjang atau 48 produk per halaman, customer perlu menggulir untuk mengubah halaman lalu kembali ke kontrol sort/filter. |
| **P3** | “Customer account” di hero mengulang tujuan Account di header global, sedangkan tautan menuju Order history tidak ada pada katalog. | Ruang navigasi digunakan untuk tujuan yang sudah tersedia, sementara jalur ke tugas lanjutan yang lebih relevan tidak terlihat. |

## Hal yang sudah bekerja dengan baik

- Search catalog menjelaskan cakupan pencarian: nama, batu, SKU, atau kategori.
- Search kategori membantu menemukan kategori saat daftar bertambah.
- Kategori panjang dibatasi ke delapan item dan dapat diperluas; ini menjaga panel filter tetap mudah dipindai.
- Filter menunjukkan jumlah aktif dan menyediakan aksi untuk menghapus semua filter.
- URL memuat state katalog sehingga hasil yang sudah difilter dapat dibagikan atau dimuat ulang.
- Jumlah hasil, rentang item yang tampil, pilihan 24/48 per halaman, serta sort tersedia.
- Persyaratan minimum order dan progresnya terlihat sebelum customer meneruskan order.
- Setelah ada item Wholesale di keranjang, ringkasan order tetap terlihat dan menyediakan jalur ke checkout.
- Customer dashboard sudah menyediakan tautan Wholesale catalog dan Order history. Checkout juga memiliki jalur untuk kembali mengubah order.
- Kontrol kategori dan pagination memiliki state aksesibel seperti `aria-pressed`, `aria-current`, serta label untuk tombol halaman sebelumnya/berikutnya.

## Rekomendasi

### P1 — Buat navigasi lokal khusus Wholesale

Tambahkan bar navigasi tipis yang tampil konsisten di katalog dan checkout, terpisah secara visual dari header situs:

1. **Catalog** — menandai katalog sebagai halaman aktif.
2. **Current order** — menampilkan jumlah item dan status minimum; membuka checkout/ringkasan order ketika order berisi item.
3. **Order history** — menuju riwayat order Customer yang sudah ada, dengan label bahwa daftar itu berisi riwayat pembelian akun.
4. **Account** — menuju profil/dashboard Customer.

Tampilkan jumlah item pada **Current order** dan beri label Wholesale agar tidak tertukar dengan shopping cart Retail di header. Di mobile, gunakan navigasi horizontal yang ringkas atau menu tab yang tetap mudah dijangkau; hindari menambahkan hero besar kedua. Pertahankan tautan ke katalog dari checkout agar customer dapat kembali menambah barang.

### P1 — Tampilkan filter aktif di dekat hasil katalog

Di bawah search/sort dan sebelum hitungan produk, tampilkan chip untuk setiap filter terapan, misalnya `Cabochons ×`, `In stock ×`, `Indonesia ×`, dan rentang harga. Setiap chip menghapus hanya filter tersebut. Sediakan **Clear all** saat ada filter aktif. Pada mobile, tampilkan chip walaupun panel filter tertutup; hitungan aktif di tombol panel tetap dapat dipertahankan.

Jika pencarian dihitung sebagai filter aktif, tampilkan istilah pencarian sebagai chip juga. Pastikan menghapus chip mempertahankan filter lain dan mengembalikan halaman katalog ke halaman pertama.

### P2 — Samakan pola penerapan filter dan navigasi browser

- Pertahankan pencarian langsung dengan debounce.
- Pertahankan select kategori, stok, material, dan origin sebagai filter langsung, tetapi beri umpan balik yang seragam pada jumlah hasil/loading.
- Pertahankan tombol **Apply price** jika memang diperlukan untuk menghindari request setiap ketikan; tampilkan rentang harga sebagai filter aktif setelah diterapkan.
- Untuk perubahan yang sudah dikomit customer—pemilihan kategori/filter, klik sort, dan pagination—gunakan state URL yang dapat ditelusuri dengan Back/Forward. Gunakan `replace` untuk teks search selama customer masih mengetik agar history tidak berisi setiap karakter.
- Pertahankan query URL agar filter tetap dapat dibagikan dan dipulihkan saat reload.

### P2 — Dekatkan orientasi hasil dan pagination

- Satukan “20 products · Showing 1–20”, sort, dan page size sebagai satu toolbar hasil dengan urutan visual yang konsisten.
- Untuk halaman katalog panjang, tambahkan pagination ringkas di dekat toolbar hasil selain pagination di bawah kartu, atau tampilkan aksi **Back to results** setelah customer pindah halaman.
- Setelah pindah halaman, pastikan customer kembali ke awal daftar produk/heading hasil, bukan tetap pada posisi scroll lama yang bisa tampak seperti hasil tidak berubah.

### P3 — Tambahkan breadcrumb dan rapikan tujuan Account

Tambahkan breadcrumb ringkas seperti `Account / Wholesale` di atas judul katalog agar customer tahu konteks akses privat. Setelah navigasi lokal tersedia, pertimbangkan mengganti CTA hero “Customer account” dengan tautan yang lebih spesifik untuk pekerjaan katalog—misalnya “Order history”—atau pertahankan sebagai tautan sekunder agar tidak menduplikasi header Account.

## Susunan navigasi yang disarankan

```text
Global site header
  └─ Wholesale workspace
       ├─ Catalog
       ├─ Current order · item count · minimum status → Checkout
       ├─ Order history
       └─ Account

Catalog controls
  ├─ Search · Sort · Products per page
  ├─ Active filter chips · Clear all
  ├─ Result count and range
  ├─ Product list
  └─ Pagination
```

## Kriteria keberhasilan saat implementasi

- Customer bisa menuju katalog, order aktif, riwayat, dan akun tanpa harus menebak ikon keranjang global.
- Label order aktif secara jelas menyebut Wholesale dan menunjukkan jumlah item serta status minimum.
- Customer dapat melihat semua filter aktif saat panel mobile tertutup dan menghapus satu filter tanpa mereset filter lainnya.
- Tombol Back/Forward memulihkan tahap eksplorasi katalog yang sudah diterapkan; reload mempertahankan state dari URL.
- Status hasil memberi umpan balik konsisten ketika search, filter, sort, atau halaman berubah.
- Navigasi tetap terlihat jelas pada desktop dan mudah dijangkau pada ponsel tanpa menutupi katalog.

## Referensi implementasi yang diperiksa

- `components/wholesale-store.tsx` — state filter, kontrol katalog, ringkasan order, dan tautan checkout.
- `components/customer-account.tsx` — navigasi dashboard dan riwayat order Customer.
- `components/checkout-view.tsx` — alur kembali dari checkout Wholesale ke katalog.
- `app/(storefront)/storefront.css` — tata letak katalog dan filter desktop/mobile.

