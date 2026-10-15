# Laporan audit alur pembelian RENDI VIRGO

Tanggal: 15 Oktober 2026, WIB
Lingkungan: website `http://localhost:3001`, API `http://localhost:4000`, database PostgreSQL lokal, mode development.
Metode: interaksi browser desktop dan ponsel, pemeriksaan respons API, pembacaan status database, serta penelusuran kode.

## Kesimpulan

**Alur pembelian belum bisa dinyatakan lolos end to end.** Pembeli bisa memilih barang, memasukkannya ke keranjang, mengubah jumlah, dan membuka formulir checkout. Alur berhenti sebelum pesanan dibuat karena permintaan ongkir dari website ditolak API. Ada dua penghambat lain yang juga perlu dibereskan: ketidaksesuaian skema database dan PayPal yang belum tersedia.

Tidak ada pesanan baru, pengiriman email, atau pembayaran yang dilakukan dalam audit ini. Data formulir yang digunakan bersifat sintetis. Barang uji sudah dihapus dari keranjang; bahasa dan ukuran tampilan browser dikembalikan. Kode aplikasi, konfigurasi, dan isi database tidak diubah.

Hasil ini menggambarkan lingkungan lokal yang diuji, bukan status website produksi. Keberhasilan transaksi, email konfirmasi, dan tracking pesanan baru **belum terverifikasi**.

## Yang terbukti bekerja

- Halaman awal dan katalog yang tampil dapat dinavigasi. Detail Forest River Cabochon sempat tampil dengan harga USD 148, berat 18 g, ukuran, asal, dan stok satuan. Tampilan katalog ini tidak membuktikan API katalog sehat; permintaan baru ke API gagal, dan detail produk lain kemudian menampilkan 404.
- Menambahkan produk unik mengubah tombol menjadi “In your cart” dan mencegah penambahan produk yang sama lagi dari tombol tersebut.
- Keranjang menampilkan harga dan berat yang benar pada barang yang diuji.
- Produk Volcanic Garden Rough, USD 84 dan 112 g, dapat dinaikkan sampai empat unit; tombol tambah kemudian nonaktif.
- Gabungan satu Forest River dan empat Volcanic menghasilkan USD 484 dan 466 g. Mengurangi Volcanic menjadi tiga menghasilkan USD 400 dan 354 g. Perhitungan ini benar.
- Penghapusan barang memperbarui keranjang sampai keadaan kosong.
- Formulir checkout dan pergantian bahasa Inggris/Indonesia tampil. Input email menandai `bukan-email` sebagai tidak valid melalui validitas native input; pengiriman formulir belum dapat diuji karena tombol pesanan terkunci.
- Pada lebar ponsel 390 px, menu, keranjang, dan formulir dapat digunakan. Pengukuran DOM menunjukkan lebar konten 390 px, sama dengan lebar halaman, tanpa overflow horizontal pada halaman checkout yang diuji. Ini pemeriksaan satu ukuran layar, bukan sertifikasi seluruh perangkat.

## Temuan utama dan rekomendasi

### F01 · P0 · Website di port 3001 ditolak API

**Bukti terverifikasi:** permintaan `POST /api/shipping/quote` untuk US dan ID dari origin `http://localhost:3001` mendapat HTTP 403 dengan pesan `Invalid request origin`. Validasi diskon dari browser juga menampilkan pesan tersebut. Konfigurasi `APP_ORIGIN` lokal menunjuk port 3002; daftar tambahan origin development hanya mencakup 3000 dan 3002.

**Dampak:** opsi ongkir tidak muncul dan tombol “Place order” nonaktif. Pesanan tidak dapat diteruskan. Pergeseran otomatis server dari port 3000 ke 3001 saat startup membuat konfigurasi ini langsung berdampak pada sesi lokal sekarang.

**Rekomendasi:** pilih satu port frontend yang stabil, lalu samakan origin yang diizinkan dan origin untuk callback pembayaran dengan URL tersebut. Pertahankan pembatasan origin. Tambahkan pemeriksaan konfigurasi saat startup agar perubahan port tidak menghasilkan website yang tampak siap tetapi checkout gagal.

**Kriteria selesai:** browser pada URL yang benar memperoleh opsi ongkir dan respons validasi diskon; callback sukses/cancel kembali ke origin yang sama.

Sumber: [main.ts](</Users/drefan/Projects/RENDI VIRGO/api/src/main.ts:20>), [proxy API](</Users/drefan/Projects/RENDI VIRGO/lib/api-proxy.ts:8>), [callback pembayaran](</Users/drefan/Projects/RENDI VIRGO/api/src/payments/payments.service.ts:63>).

### F02 · P0 · Migrasi kolom video belum diterapkan

**Bukti terverifikasi:** daftar dan detail produk mendapat HTTP 500. Log server menyebut `The column Product.videoUrl does not exist in the current database`. Pemeriksaan `information_schema` tidak menemukan kolom tersebut. Tabel riwayat migrasi belum memuat `20261008153000_product_video`, sementara berkas migrasinya sudah tersedia di proyek.

**Dampak:** katalog tidak dapat diambil dengan andal. Membuka Moss Tumbled Selection dari katalog menghasilkan halaman 404. Pada kode saat ini, kegagalan API diterjemahkan menjadi `null`, lalu halaman detail memanggil `notFound()`, sehingga gangguan layanan terlihat seperti barang tidak ada. Pembacaan produk dalam pembuatan pesanan juga bergantung pada skema yang sama; jalur tersebut belum dijalankan dalam audit ini.

**Rekomendasi:** terapkan migrasi yang tertinggal melalui prosedur migrasi proyek, lalu pastikan Prisma dan skema database sesuai. Tambahkan pemeriksaan migrasi pada proses rilis. Bedakan produk tidak ditemukan (404) dari API bermasalah (500/502) dan sediakan coba lagi.

**Kriteria selesai:** daftar/detail produk mengembalikan 200 dari permintaan baru, tautan produk terbuka, dan aplikasi menampilkan pesan gangguan yang tepat saat API sengaja dibuat tidak tersedia.

Sumber: [migrasi video](</Users/drefan/Projects/RENDI VIRGO/api/prisma/migrations/20261008153000_product_video/migration.sql:1>), [pembungkus API](</Users/drefan/Projects/RENDI VIRGO/lib/storefront.ts:242>), [halaman detail](</Users/drefan/Projects/RENDI VIRGO/app/(storefront)/shop/[category]/[slug]/page.tsx:30>).

### F03 · P0 · PayPal tidak tersedia, tetapi checkout menjanjikan pembayaran PayPal

**Bukti terverifikasi:** `GET /api/payments/methods` mendapat 200 dengan `paypal.enabled: false`. Halaman checkout tetap menampilkan instruksi pengalihan ke PayPal. Frontend checkout tidak memeriksa endpoint ketersediaan tersebut sebelum membuat pesanan.

**Dampak:** setelah penghambat ongkir dan database diperbaiki, ketersediaan pembayaran masih harus dibereskan. Berdasarkan kode, pesanan dapat dibuat dan keranjang dikosongkan sebelum percobaan memulai PayPal gagal. Transaksi sukses belum bisa dibuktikan pada konfigurasi sekarang.

**Rekomendasi:** periksa pengaturan `paypalEnabled` dan kredensial server; gunakan PayPal sandbox untuk pengujian. Tampilkan ketersediaan metode pembayaran sebelum konfirmasi pesanan. Bila pembayaran sedang tidak tersedia, berikan penjelasan dan jalur pemulihan yang jelas.

**Kriteria selesai:** metode pembayaran aktif di sandbox; alur approve, cancel, gagal, dan callback/webhook berhasil diuji dengan status serta jumlah yang konsisten. Jangan menyimpulkan pembayaran siap hanya karena endpoint metode memberi HTTP 200.

Sumber: [metode pembayaran](</Users/drefan/Projects/RENDI VIRGO/api/src/payments/payments.service.ts:58>), [pembuatan order PayPal](</Users/drefan/Projects/RENDI VIRGO/api/src/payments/payments.service.ts:70>), [urutan checkout](</Users/drefan/Projects/RENDI VIRGO/components/checkout-view.tsx:367>).

### F04 · P1 · Keranjang hilang saat halaman dimuat ulang

**Bukti terverifikasi:** dua pengulangan terpisah menunjukkan satu Forest River Cabochon berubah menjadi keranjang kosong setelah reload: pertama di checkout, kedua di halaman keranjang.

**Dampak:** pilihan pembeli hilang jika refresh atau kembali ke sesi. Ini risiko langsung terhadap penyelesaian pembelian.

**Analisis kode:** pembacaan penyimpanan dan penulisan keranjang menggunakan effect terpisah, sedangkan nilai awal keranjang adalah array kosong. Urutan ini rentan menulis nilai kosong saat pemulihan data belum selesai. React Strict Mode aktif pada lingkungan development dan merupakan kandidat penyebab pengulangan effect; perilaku build production belum diuji.

**Rekomendasi:** tandai pemulihan data selesai sebelum mengizinkan penulisan penyimpanan. Tambahkan uji reload, tab baru, data penyimpanan rusak, dan mode production. Tetap validasi ulang harga serta stok dengan server sebelum pembayaran.

Sumber: [pemulihan keranjang](</Users/drefan/Projects/RENDI VIRGO/components/providers.tsx:62>), [penyimpanan keranjang](</Users/drefan/Projects/RENDI VIRGO/components/providers.tsx:109>).

### F05 · P1 · Gangguan API ditampilkan sebagai pengiriman tidak tersedia

**Bukti terverifikasi:** website menyatakan pengiriman belum tersedia untuk tujuan yang dipilih, tetapi penyebab aktual adalah HTTP 403. Saat permintaan diagnostik memakai origin yang sudah terdaftar, quote berhasil dan menghasilkan opsi USD 25, USD 50, dan USD 77 untuk paket 18 g/subtotal USD 148. Pemeriksaan diagnostik tersebut tidak mengubah origin website dan bukan checkout yang berhasil.

**Dampak:** pelanggan bisa mengira negaranya tidak dilayani. Tombol terkunci tanpa jalur coba lagi, sementara ringkasan tetap menampilkan “Total USD 148” ketika ongkir belum diketahui.

**Rekomendasi:** pisahkan kondisi memuat, tidak ada rute pengiriman, koneksi gagal, dan permintaan ditolak. Tambahkan tombol coba lagi serta tautan kontak langsung. Selama ongkir belum diketahui, sebut angka sebagai subtotal atau estimasi, lalu tampilkan total akhir setelah quote berhasil.

Sumber: [penanganan quote](</Users/drefan/Projects/RENDI VIRGO/components/checkout-view.tsx:150>), [ringkasan harga](</Users/drefan/Projects/RENDI VIRGO/components/checkout-view.tsx:189>).

### F06 · P1 · Aturan wilayah ongkir perlu dikonfirmasi sebelum berjualan

**Bukti terverifikasi:** keempat tarif aktif di database memakai region `Worldwide`, termasuk tarif bernama “Asia Pacific”. Quote US dan ID mengembalikan opsi yang sama. Layanan quote saat ini mengambil tabel tarif internal; tidak terlihat panggilan langsung ke API kurir dalam jalur yang diperiksa.

**Dampak:** pembeli AS mendapat opsi bernama Asia Pacific. Perbedaan biaya antarnegara tidak diterapkan oleh konfigurasi saat ini. Akurasi nominal terhadap biaya kurir nyata belum dinilai.

**Rekomendasi:** cocokkan nama layanan, negara yang dilayani, dan tarif yang disetujui bisnis. Gunakan kode negara atau pemetaan zona yang eksplisit. Validasi biaya kemasan, asuransi, barang rapuh, berat aktual/volumetrik sesuai metode operasional yang dipilih. Tambahkan estimasi waktu kirim dan penjelasan komponen biaya untuk pembeli.

Sumber: [aturan pencocokan wilayah](</Users/drefan/Projects/RENDI VIRGO/api/src/settings/shipping.service.ts:60>), bukti konfigurasi database di lampiran.

### F07 · P1 · Pemulihan pesanan belum dibuktikan; jalur kode masih rapuh

**Status: risiko dari pembacaan kode, belum direproduksi setelah pesanan dibuat.** `clearCart()` dipanggil segera setelah order tersimpan, sebelum PayPal dimulai. Hasil checkout berada dalam state komponen. `rv.lastOrder` dibaca pada jalur return/cancel PayPal, tetapi membuka `/checkout` biasa tidak memulihkan order pending. Tombol bayar ulang tidak diberikan untuk status `unavailable`.

**Dampak potensial:** refresh setelah pembayaran gagal atau tidak tersedia dapat membawa pelanggan ke keranjang kosong, padahal barang sudah dicadangkan pada pesanan pending.

**Rekomendasi:** sediakan halaman konfirmasi order yang dapat dibuka ulang secara aman, status pembayaran dari server, dan opsi melanjutkan pembayaran. Batasi order ganda akibat retry menggunakan mekanisme idempotensi pada pembuatan pesanan. Tampilkan kapan reservasi habis. Pastikan perubahan status paid tetap benar jika callback dan webhook datang bersamaan atau terlambat.

Sumber: [clearCart sebelum pembayaran](</Users/drefan/Projects/RENDI VIRGO/components/checkout-view.tsx:374>), [pemulihan callback](</Users/drefan/Projects/RENDI VIRGO/components/checkout-view.tsx:227>), [reservasi kedaluwarsa](</Users/drefan/Projects/RENDI VIRGO/api/src/payments/payments.service.ts:322>).

### F08 · P2 · Janji reservasi stok tidak sesuai dengan waktu reservasi di kode

**Bukti browser dan kode:** halaman produk menyatakan stok ditahan untuk keranjang sampai pembayaran selesai. Menambah barang hanya mengubah state browser; perubahan status produk ke `Reserved` baru dilakukan saat pesanan dibuat. Pembayaran pending memiliki batas default 60 menit dan pemeriksaan kedaluwarsa berkala, bukan penahanan tanpa batas.

**Rekomendasi:** sesuaikan teks: “Ketersediaan dikonfirmasi saat pesanan dibuat.” Setelah order dibuat, tampilkan waktu reservasi aktual. Bila bisnis menghendaki reservasi sejak masuk keranjang, perlu mekanisme reservasi server dan kedaluwarsa yang terukur.

Sumber: [teks stok](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:237>), [add to cart](</Users/drefan/Projects/RENDI VIRGO/components/providers.tsx:119>), [reservasi order](</Users/drefan/Projects/RENDI VIRGO/api/src/orders/orders.service.ts:500>).

### F09 · P2 · Formulir dan ringkasan mobile masih dapat disederhanakan

**Bukti browser/kode:** ringkasan berada setelah seluruh formulir dan tombol konfirmasi pada ponsel. Kode pos dan provinsi selalu opsional; “Other” menjadi negara literal tanpa kolom nama negara tambahan. Telepon memakai input teks biasa. Nama belakang selalu wajib. Teks checkout menampilkan kata “preview”, “Admin”, dan “API”.

**Rekomendasi:** tampilkan ringkasan yang bisa dibuka/tutup di atas formulir, sediakan “Ubah keranjang”, dan simpan draft alamat ketika pembeli kembali mengedit barang. Terapkan validasi alamat sesuai negara serta metode kirim, dukung nama lengkap tanpa harus memaksakan dua bagian, gunakan keyboard telepon, dan buat pilihan “Negara lainnya” dapat diisi. Gunakan teks berorientasi pembeli, misalnya “Lengkapi alamat untuk menghitung ongkir”. Jelaskan mata uang USD, estimasi pengiriman, dan kebijakan biaya tambahan yang memang berlaku untuk toko.

Sumber: [form checkout](</Users/drefan/Projects/RENDI VIRGO/components/checkout-view.tsx:475>), [teks checkout](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:290>), tangkapan layar mobile di lampiran.

### F10 · P1 · Varian dan stok nol memerlukan uji lanjutan

**Status: risiko dari kode, belum lolos uji browser.** Produk Moss Tumbled memiliki dua varian di database, tetapi detailnya terhenti di 404. Kartu katalog menambah produk dasar tanpa memilih varian. `maxQuantityFor()` membatasi stok minimum menjadi satu bahkan bila stok sebenarnya nol. Jalur server memiliki validasi stok; UI perlu menyampaikan kondisi tersebut sebelum pembeli mencapai kegagalan checkout.

**Rekomendasi:** produk dengan varian mengarahkan pembeli memilih varian terlebih dahulu. Nonaktifkan varian stok nol. Setelah katalog pulih, uji harga, berat, SKU, batas stok, serta ongkir tiap varian dan pastikan produk dasar tidak melewati aturan pilihan varian.

Sumber: [kartu produk](</Users/drefan/Projects/RENDI VIRGO/components/product-card.tsx:108>), [batas jumlah](</Users/drefan/Projects/RENDI VIRGO/lib/catalog.ts:75>), [validasi stok server](</Users/drefan/Projects/RENDI VIRGO/api/src/orders/orders.service.ts:439>).

## Urutan perbaikan yang disarankan

1. **Pulihkan integrasi lokal:** samakan port/origin dan URL callback, lalu terapkan migrasi video yang tertinggal. Pastikan katalog baru tidak bergantung pada halaman/data yang sudah terlanjur tampil.
2. **Aktifkan sandbox pembayaran:** verifikasi pengaturan dan kredensial PayPal, ketersediaan metode di UI, dan pengembalian dari PayPal ke origin yang benar.
3. **Perbaiki kehilangan dan pemulihan state:** keranjang harus bertahan setelah reload; order pending harus dapat dibuka serta dibayar ulang tanpa membuat pesanan ganda.
4. **Rapikan ongkir dan pesan gagal:** bedakan error teknis dari tujuan tidak dilayani, validasi zona/tarif, tampilkan total hanya setelah komponen biaya lengkap.
5. **Selesaikan pengalaman pembeli:** ringkasan mobile, edit keranjang, draft alamat, pilihan varian/stok nol, dan teks reservasi.
6. **Jalankan ulang uji transaksi lengkap:** setelah empat langkah pertama selesai, jalankan skenario berikut pada sandbox sebelum menganggap alur siap menerima pembelian.

## Syarat lulus pengujian ulang

- Pembelian guest satu barang unik dan beberapa barang kuantitas/varian, dengan harga final frontend sama dengan order server dan jumlah PayPal.
- Ongkir untuk Indonesia, AS, satu negara lain, negara tanpa layanan, paket berat, barang rapuh, serta batas free shipping.
- Diskon valid, invalid, kedaluwarsa, minimum belanja, batas penggunaan, kategori, dan free shipping.
- Alamat tidak lengkap, email invalid, varian habis, stok berubah setelah barang masuk keranjang, serta dua pembeli memesan barang unik bersamaan.
- Refresh keranjang, kembali dari checkout untuk mengedit barang, buka ulang order pending, klik submit berulang, timeout setelah order dibuat, dan percobaan bayar ulang.
- PayPal sandbox berhasil, dibatalkan, ditolak, pending review, callback diulang, webhook terlambat, dan pembayaran setelah reservasi habis. Status serta stok harus tetap konsisten.
- Email order diterima, email pembayaran dikonfirmasi, dan tautan pemulihan/tracking menuju origin yang tepat. Gunakan kotak surat uji agar tidak mengirim notifikasi kepada pelanggan nyata.
- Pengujian di build production, layar ponsel dan desktop, serta pemeriksaan akses keyboard dan pembacaan error. Perilaku development tidak cukup untuk menyimpulkan kesiapan production.

## Bukti dan batas pemeriksaan

- [Hasil API mentah](</Users/drefan/Projects/RENDI VIRGO/reports/checkout-audit-2026-10-15/evidence/api-results.json>): respons metode pembayaran, produk, ongkir US/ID, dan diskon invalid. Permintaan ber-origin 3002 adalah diagnosis pembanding; browser yang diuji tetap di 3001.
- [Pemeriksaan database](</Users/drefan/Projects/RENDI VIRGO/reports/checkout-audit-2026-10-15/evidence/database-checks.json>): kolom video tidak ada, migrasi yang sudah diterapkan, tarif dan region, serta jumlah varian. Tidak berisi kredensial atau data pelanggan.
- [Validasi form](</Users/drefan/Projects/RENDI VIRGO/reports/checkout-audit-2026-10-15/evidence/form-validation.json>): status required/type/valid dari input saat memakai data sintetis.
- [Checkout terblokir desktop](</Users/drefan/Projects/RENDI VIRGO/reports/checkout-audit-2026-10-15/evidence/checkout-blocked-desktop.png>).
- [Keranjang sebelum reload](</Users/drefan/Projects/RENDI VIRGO/reports/checkout-audit-2026-10-15/evidence/cart-before-reload.png>) dan [setelah reload](</Users/drefan/Projects/RENDI VIRGO/reports/checkout-audit-2026-10-15/evidence/cart-after-reload.png>).
- [Produk dari katalog berakhir 404](</Users/drefan/Projects/RENDI VIRGO/reports/checkout-audit-2026-10-15/evidence/listed-product-404.png>).
- [Keranjang mobile](</Users/drefan/Projects/RENDI VIRGO/reports/checkout-audit-2026-10-15/evidence/cart-mobile.png>), [batas empat unit](</Users/drefan/Projects/RENDI VIRGO/reports/checkout-audit-2026-10-15/evidence/cart-quantity-max-mobile.png>), [checkout mobile](</Users/drefan/Projects/RENDI VIRGO/reports/checkout-audit-2026-10-15/evidence/checkout-mobile.png>), dan [checkout Bahasa Indonesia](</Users/drefan/Projects/RENDI VIRGO/reports/checkout-audit-2026-10-15/evidence/checkout-mobile-id.png>).

Penelusuran selesai pada blocker yang dapat dibuktikan. Submit order, reservasi runtime, approve/capture PayPal, webhook, pengiriman email, serta tracking order baru belum dijalankan. Pengujian quote dan diskon hanya membaca/menghitung; tidak menghasilkan transaksi. Semua rekomendasi risiko dari pembacaan kode diberi label tersendiri agar tidak disalahartikan sebagai kegagalan yang sudah direproduksi.
