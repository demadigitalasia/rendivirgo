# Audit Front End dan Alur UI — RENDI VIRGO

**Tanggal:** 16 Oktober 2026  
**Cakupan:** storefront pelanggan, alur belanja sampai pengajuan retur, dan shell login/admin yang dapat diperiksa tanpa autentikasi.  
**Metode:** membaca source, mengikuti alur halaman, lalu melihat render lokal halaman beranda, katalog, keranjang, checkout, retur, dan login admin. Penilaian desain modul memakai istilah Module, Interface, Depth, Seam, dan Locality dari Ask Matt / Codebase Design.

## Ringkasan

Fondasi visual storefront sudah konsisten: warna hijau-krem, tipografi editorial, CTA yang jelas, dan navigasi bantuan yang mencakup tracking, riwayat order, serta retur. Katalog dan halaman retur tampil rapi pada viewport sempit yang diperiksa. Aksesibilitas dasar juga tampak disengaja lewat skip link, label formulir, status live cart, fokus keyboard, dan penghormatan pada reduced motion.

Temuan paling penting adalah keranjang meluber pada ukuran tablet/narrow desktop: kolom ringkasan terpotong dan halaman menampilkan scrollbar horizontal. Checkout sendiri memiliki state dan tanggung jawab UI yang terkonsentrasi pada satu komponen besar. API lokal tidak tersedia selama inspeksi, sehingga perhitungan ongkir, ketersediaan pembayaran, optimasi beberapa gambar upload, serta submit order/retur tidak dapat diverifikasi end-to-end.

## Peta alur yang diperiksa

1. **Temukan produk:** beranda → katalog/filter/sort → detail produk, varian, stok, galeri, dan ulasan.
2. **Pilih dan checkout:** tambah ke cart → ringkasan cart → data pengiriman → pilihan ongkir dan diskon → PayPal atau transfer bank → unggah bukti bila transfer.
3. **Layanan sesudah pembelian:** tracking, riwayat order lewat tautan email, dan formulir permintaan retur.
4. **Operasi admin:** login → navigasi dashboard untuk katalog, order, pelanggan, konten, dan operasi. Area dashboard dilindungi layout autentikasi; layar admin berlogin tidak termasuk inspeksi visual ini.

## Temuan

### P1 — Ringkasan keranjang terpotong pada lebar tablet

**Bukti visual:** pada render keranjang di browser lokal, bagian kanan kartu ringkasan keluar dari viewport. Nilai subtotal/ongkir dan sisi kanan tombol checkout tidak seluruhnya terlihat, dengan scrollbar horizontal di bawah halaman.

**Sebab di source:** `.cart-layout` memakai kolom `1fr 340px` dengan gap 36px; isi baris item memakai grid `110px 1fr auto`, sedangkan aksi cart adalah flex tanpa wrapping. Layout baru bertumpuk pada breakpoint 720px. Pada lebar antara breakpoint itu dan lebar desktop, minimum konten baris cart membuat kolom `1fr` tidak cukup mengecil. Lihat `app/globals.css:475-498`, `app/globals.css:564-623`, serta lebar container di `app/(storefront)/storefront.css:233-242`.

**Rekomendasi:** pindahkan layout cart ke satu kolom lebih awal (misalnya pada breakpoint tablet yang sesuai), atau buat grid yang benar-benar dapat menyusut (`minmax(0, 1fr)`) dan izinkan aksi baris membungkus. Validasi keranjang di 1024, 900, 768, 720, dan 390px; pastikan total dan CTA terlihat tanpa scroll horizontal.

### P2 — Checkout menggabungkan terlalu banyak state dan alur di satu Module

`components/checkout-view.tsx` berukuran 1.036 baris. `CheckoutView` sekaligus memegang input alamat, draft session, quote ongkir, pilihan diskon, ketersediaan pembayaran, PayPal return/capture, recovery, unggah bukti transfer, perubahan harga, dan tampilan hasil. Terlihat dari kumpulan state di `components/checkout-view.tsx:132-172`, pemuatan quote/pembayaran/draft di `:178-286`, penanganan pembayaran dan recovery di `:340-493`, pembuatan order dan bukti di `:528-678`, serta JSX formulir dan pembayaran di `:825-1034`.

Ini memperbesar biaya perubahan: satu penyesuaian visual dapat bersinggungan dengan logika pemulihan pembayaran atau pengiriman. Rekomendasi desain bukan memecah JSX menjadi banyak file tipis, tetapi memberi seam pada beberapa alur yang punya interface jelas: state/aksi shipping quote, payment result/proof, serta komposisi form checkout. Pertahankan `CheckoutView` sebagai orkestrator tipis dan satu tempat untuk urutan langkah.

### P3 — Kartu tinjauan perubahan harga memakai style khusus transfer bank

Panel yang meminta pelanggan meninjau dan menyetujui harga server dirender memakai class `bank-transfer-panel` dan `bank-transfer-details` (`components/checkout-view.tsx:998-1015`), yang juga dipakai untuk instruksi rekening/bukti transfer (`:734-770`; styling di `app/globals.css:514-523`). Penggunaan ulang ini mengikat makna visual “tinjau harga” pada visual “transfer bank”; jalur tersebut tidak dapat terlihat saat API quote lokal gagal.

**Rekomendasi:** setelah P1, beri price review komponen/class tersendiri dengan hirarki subtotal, ongkir, diskon, dan total serta dua aksi yang jelas: setujui harga baru atau kembali mengubah cart. Pertahankan gaya visual yang sama tanpa memakai nama/style yang mengisyaratkan metode pembayaran.

## Hal yang sudah bekerja baik

- **Arah visual dan navigasi konsisten.** Beranda, katalog, cart, halaman retur, dan login admin memakai bahasa warna dan tipografi yang terasa satu merek; hierarki heading/CTA mudah dipindai.
- **Katalog mendukung penemuan produk.** Filter kategori, harga, bobot, asal, tipe batu, sort, pagination, wishlist, serta tombol tambah ke cart tersedia; drawer filter punya mode mobile (`components/shop-catalog.tsx`, `app/(storefront)/storefront.css:168-176`, `:257-321`).
- **Alur pembayaran memberi umpan balik eksplisit.** Checkout menampilkan status loading/error dan menonaktifkan submit saat harga atau metode pembayaran belum siap; form mempunyai label yang terhubung dan pilihan pengiriman menggunakan radio group (`components/checkout-view.tsx:890-919`, `:963-1029`). Quote harga yang berubah juga meminta persetujuan pengguna sebelum order dibuat.
- **Aksesibilitas dasar diperhatikan.** Skip link tersedia; header mengelola Escape dan fokus saat menu/pencarian ditutup; perubahan jumlah cart diumumkan ke pembaca layar; motion menghormati preferensi reduce motion (`components/skip-link.tsx`, `components/site-header.tsx:43-89`, `components/providers.tsx:176-196`, `components/storefront-motion.tsx:10-58`).
- **Admin punya pola responsif yang sesuai untuk data padat.** Sidebar berubah menjadi drawer pada layar kecil dan tabel memakai pembungkus scroll horizontal yang lokal pada tabel, bukan seluruh halaman (`components/admin/shell.tsx:48-82`, `app/admin/admin.css:431-465`, `:1114-1194`).
- **Jalur bantuan pascapembelian mudah ditemukan.** Footer menautkan pengiriman/retur, formulir retur, tracking, dan riwayat order (`components/site-footer.tsx:92-99`). Form retur punya label field, batas ukuran berkas 8 MB, dan status sukses/error yang diumumkan (`components/return-request-form.tsx:18-53`, `:62-100`).

## Urutan tindak lanjut

1. **Perbaiki responsif cart** dan verifikasi ulang grid pada rentang tablet. Ini temuan visual yang paling langsung menghalangi pembacaan ringkasan pembelian.
2. **Pisahkan seam checkout** berdasarkan alur dan data yang dimiliki, lalu pastikan state UI tetap jelas untuk loading, error, payment pending/paid, recovery, dan persetujuan perubahan harga.
3. **Pisahkan style price review dari instruksi transfer**, lalu review ulang hierarki informasi pembayaran di desktop dan mobile.
4. Setelah API bisa dijalankan, tinjau ulang seluruh jalur dengan data lengkap: ongkir berhasil/gagal, harga berubah, PayPal kembali/cancel, transfer bank dan bukti, tracking, serta submit retur.

## Implementasi rekomendasi yang disetujui

- Keranjang mulai memakai satu kolom pada lebar 840px ke bawah. Grid item dapat menyusut, kontrol aksi dapat membungkus, dan ukuran gambar mengikuti layout mobile.
- Checkout kini memindahkan quote ongkir dan ketersediaan pembayaran ke hook tersendiri. Ringkasan order, hasil pembayaran/bukti transfer, dan tinjauan perubahan harga memiliki komponen masing-masing; styling price review juga tidak lagi memakai kelas transfer bank.
- `npm run lint` (`tsc --noEmit`) berhasil. Keranjang diperiksa pada viewport 1024, 900, 840, 768, 720, dan 390px; summary tetap berada di dalam lebar dokumen. Checkout pada 390px juga tidak meluber secara horizontal.
- API tetap tidak tersedia saat pemeriksaan: quote ongkir dan metode pembayaran menampilkan state error yang memang disediakan UI. Gambar upload produk lokal juga gagal dioptimalkan. Karena itu pengiriman order, perubahan harga dari server, dan alur pembayaran belum dapat diverifikasi end-to-end.

## Batas inspeksi

Server API di `localhost:4000` menolak koneksi. Akibatnya `/api/shipping/quote` dan `/api/payments/methods` mengembalikan 502, dan optimasi gambar upload lokal mengembalikan 500. Saya memeriksa render dan navigasi UI, termasuk penambahan satu produk ke cart pada tab audit, tetapi tidak mengirim checkout atau permintaan retur. Jadi alur pembayaran, variasi respons API, dan tampilan dashboard setelah autentikasi masih perlu inspeksi ulang ketika API tersedia.
