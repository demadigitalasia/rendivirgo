# Spesifikasi Fitur POS Workshop

| | |
|---|---|
| Produk | RENDI VIRGO Online Store |
| Status | Implementasi UI dan API memakai stok bersama serta reservasi lima menit; migrasi belum diterapkan ke database lokal |
| Tanggal | 18 Oktober 2026 |
| Cakupan | Penjualan langsung di workshop melalui dashboard admin |

## Keputusan yang sudah dikonfirmasi

- Mata uang transaksi POS: **IDR**.
- Harga katalog USD dikonversi memakai kurs USD–IDR yang diatur admin; kurs yang dipakai disimpan pada setiap transaksi.
- POS memakai harga katalog USD yang dikonversi dengan kurs tersimpan sebagai harga awal. Admin dapat menyesuaikan harga satuan setiap item langsung di keranjang; penyesuaian berlaku hanya untuk transaksi tersebut dan tidak mengubah harga katalog atau website.
- Setiap harga item hasil konversi dibulatkan ke rupiah penuh sebelum dijumlahkan.
- Metode pembayaran: **tunai, transfer bank, dan QRIS**.
- Customer boleh tidak dicatat pada transaksi.
- Transaksi harus lunas sebelum diselesaikan; pembayaran parsial tidak termasuk kebutuhan awal.
- Admin boleh memberi diskon manual berupa persen atau nominal untuk seluruh order; alasan diskon wajib dicatat.
- Kupon toko online tidak berlaku di POS.
- Retur dan refund dicatat melalui alur pesanan admin yang sudah ada.
- Struk menggunakan format sederhana tanpa format pajak/nomor khusus yang diminta saat ini.
- Retail, Wholesale, dan POS memakai satu pool stok tanpa alokasi terpisah per channel.
- Sebelum pembayaran dikonfirmasi, POS memvalidasi dan menahan sementara stok secara atomik. Stok yang ditahan POS tidak dapat dijual oleh Retail, Wholesale, atau transaksi POS lain.
- Setelah pembayaran lunas dikonfirmasi, sistem membuat order POS dan mengikat reservasi menjadi penjualan secara atomik. Jika hold dilepas atau kedaluwarsa, jumlah stok dikembalikan ke pool bersama.
- POS hanya mencatat penjualan; koreksi stok dilakukan lewat manajemen produk.

## 1. Ringkasan

POS (point of sale) dipakai admin untuk mencatat pembelian offline, terutama transaksi pelanggan yang datang langsung ke workshop. POS hanya tersedia setelah admin masuk ke dashboard. Fitur ini membuat catatan penjualan yang terhubung dengan katalog, stok, pelanggan, pesanan, dan laporan toko.

POS bukan halaman kasir publik dan tidak menambahkan tombol atau alur pembelian offline ke website storefront. Catatan POS harus dapat dibedakan dari pesanan online, tetapi tetap memakai data pesanan dan inventaris yang sama agar laporan serta riwayat pelanggan tidak terpecah.

## 2. Tujuan

- Mempercepat pencatatan transaksi di workshop.
- Mengurangi risiko menjual produk yang sama melalui workshop dan website pada waktu bersamaan.
- Menyimpan metode dan status pembayaran serta rincian barang yang dibeli.
- Menghubungkan transaksi dengan customer bila informasinya tersedia.
- Menampilkan penjualan workshop di daftar pesanan dan laporan admin.

## 3. Pengguna dan akses

- **Admin**: satu-satunya pengguna POS pada cakupan saat ini. Admin harus sudah terautentikasi di dashboard.
- **Customer walk-in**: tidak menggunakan POS secara langsung dan tidak memerlukan akun untuk menyelesaikan transaksi.

Menu POS, halaman kasir, pencarian katalog kasir, dan API pembuat transaksi POS wajib dibatasi untuk admin. Menghilangkan tautan dari storefront saja tidak cukup; pemeriksaan akses juga dilakukan di server.

## 4. Alur transaksi

1. Admin membuka modul **POS** dari navigasi dashboard.
2. Admin mencari produk melalui nama atau SKU, lalu memilih produk/varian dan jumlahnya.
3. Sistem menampilkan harga, stok yang tersedia, subtotal, diskon yang berlaku, dan total.
4. Admin dapat memilih customer yang sudah tercatat atau melanjutkan sebagai pembeli walk-in tanpa profil lengkap.
5. Sebelum pembayaran diminta atau dikonfirmasi, server memeriksa ulang channel, harga, diskon, dan stok; sistem menahan stok yang tersedia secara atomik.
6. Setelah reservasi berhasil, admin memilih metode pembayaran, mencatat referensi/catatan bila diperlukan, dan mengonfirmasi pembayaran yang benar-benar sudah diterima.
7. Jika stok tidak tersedia, sistem tidak melanjutkan ke pembayaran dan meminta admin memperbarui keranjang. Jika reservasi kedaluwarsa atau pembayaran gagal, sistem melepas reservasi tanpa membuat order Paid.
8. Setelah pembayaran lunas terkonfirmasi, pembuatan order POS, pengurangan stok fisik, dan pelepasan reservasi diselesaikan secara atomik dan idempoten.
9. POS menampilkan konfirmasi dan menyediakan bukti/struk yang bisa dicetak atau disimpan.
10. Barang diserahkan langsung di workshop. Pesanan POS tidak membutuhkan alamat atau ongkos kirim; penyelesaian transaksi tidak boleh mencatat status pengiriman.

## 5. Kebutuhan fungsional

### 5.1 Keranjang dan harga

- Pada pengaturan produk, admin mengaktifkan channel Retail/Web, Wholesale, dan POS Workshop secara independen. Kombinasi channel menentukan katalog tempat produk tersedia; Wholesale-only dan POS-only tidak tampil di katalog publik.
- Produk **Workshop POS saja** hanya muncul di katalog kasir admin dan tidak boleh tampil pada katalog, pencarian, halaman produk, sitemap, atau API publik website.
- Pengaturan channel menentukan di mana produk boleh dijual. Channel tidak membuat pool atau alokasi stok terpisah.
- Admin dapat menambah, menghapus, dan mengubah jumlah barang dalam keranjang.
- Pencarian mendukung nama dan SKU. Pemindai barcode dapat digunakan bila perangkat mengirim hasil scan sebagai input teks; kebutuhan perangkat keras khusus belum termasuk cakupan.
- Harga katalog dikonversi ke IDR sebagai harga awal. Admin dapat mengubah harga satuan langsung pada setiap baris keranjang; nilai ini hanya berlaku untuk transaksi berjalan.
- Harga satuan akhir yang dikonfirmasi disimpan sebagai snapshot di item pesanan sehingga perubahan harga katalog, kurs, atau keranjang berikutnya tidak mengubah transaksi lama.
- Produk unik tidak dapat dijual melebihi stok tersedia. Produk dengan model stok kuantitas mengikuti jumlah tersedia dan satuan produk.
- Produk Draft, Reserved, Sold, Archived, atau tidak tersedia tidak dapat ditambahkan sebagai barang yang dapat dijual.
- POS hanya menampilkan produk yang diizinkan untuk kanal Workshop POS dan memiliki status/ketersediaan yang dapat dijual.
- Menambahkan produk ke keranjang tidak menahan stok. Sebelum pembayaran diterima/dikonfirmasi, server memeriksa ulang jumlah tersedia dan membuat reservasi sementara POS secara atomik.
- Jumlah tersedia adalah stok fisik dikurangi reservasi aktif dari Retail, Wholesale, dan POS. Tidak ada alokasi stok khusus Workshop.
- Reservasi POS memiliki batas waktu yang ditetapkan sistem. Reservasi dilepas saat transaksi dibatalkan, pembayaran gagal, atau batas waktu tercapai. Jika pembayaran eksternal berhasil setelah reservasi berakhir, transaksi masuk ke rekonsiliasi admin dan tidak otomatis mengurangi stok.
- Setelah pembayaran lunas, sistem membuat order, mengurangi stok fisik, dan melepas reservasi secara atomik. Operasi harus idempoten agar retry atau callback pembayaran tidak mengurangi stok dua kali.
- Jika metode pembayaran telah berhasil di luar sistem tetapi finalisasi order gagal, transaksi masuk ke antrean rekonsiliasi admin; sistem tidak boleh menyatakan pembayaran/order selesai tanpa rekonsiliasi.
- Admin boleh memberi diskon manual berupa persen atau nominal untuk seluruh order. Alasan wajib dicatat. Nilai sebelum diskon, jenis/nilai diskon, alasan, dan total akhir disimpan pada transaksi serta ditampilkan pada struk.
- Kupon toko online tidak dapat digunakan pada transaksi POS.

### 5.2 Customer walk-in

- Customer bersifat opsional untuk transaksi.
- Admin dapat memilih customer yang sudah ada agar transaksi muncul di riwayatnya.
- Jika profil baru dimasukkan, field minimum dan aturan duplikasi email mengikuti manajemen customer yang ada.
- Transaksi tanpa email tetap dapat disimpan; bukti cetak tidak bergantung pada pengiriman email.

### 5.3 Pembayaran dan status

- Catat metode pembayaran, jumlah diterima, waktu pembayaran, dan referensi pembayaran bila tersedia.
- Metode POS yang didukung: **Tunai, Transfer Bank, dan QRIS**. Metode dipilih dan disimpan secara terpisah agar laporan dapat mengelompokkan pemasukan per metode.
- Mata uang order POS adalah **IDR**. Harga dan total yang dikonfirmasi customer serta struk menggunakan IDR.
- Harga produk USD dikonversi ke IDR memakai kurs yang dikonfigurasi admin. Setiap harga item hasil konversi dibulatkan ke rupiah penuh sebelum dijumlahkan. Nilai kurs yang dipakai harus disimpan sebagai snapshot pada transaksi agar order lama tetap dapat direkonsiliasi setelah kurs berubah.
- Status hanya boleh menjadi Paid setelah pembayaran penuh benar-benar diterima dan dikonfirmasi admin. Transaksi belum lunas tidak dapat diselesaikan.
- Pembayaran parsial, uang muka, dan split payment tidak termasuk cakupan awal.
- Catatan koreksi dan pembatalan tersimpan di riwayat pesanan/audit log. Retur dan refund ditangani melalui alur pesanan admin yang ada, bukan tindakan khusus di layar POS. Stok hanya dikembalikan setelah retur disetujui dan barang memang kembali ke inventaris.

### 5.4 Stok, pesanan, dan laporan

- Setiap transaksi memiliki penanda sumber penjualan **POS/workshop** dan tipe pemenuhan **ambil langsung** atau ekuivalen.
- Pengurangan stok dan pembuatan pesanan harus konsisten sebagai satu operasi: tidak boleh ada order berbayar tanpa perubahan stok yang sesuai, atau stok berkurang dua kali saat permintaan diulang.
- Transaksi muncul di dashboard admin pada daftar pesanan dengan penanda POS dan customer (jika dihubungkan).
- Admin dapat mengatur channel Retail/Web, Wholesale, dan Workshop POS secara independen; produk POS-only atau Wholesale-only tidak bocor ke storefront maupun API publik.
- Seluruh channel membaca satu stok fisik bersama dan menghormati reservasi aktif dari semua channel.
- Saat POS menahan stok untuk pembayaran, jumlah tersebut tidak dapat dibeli Retail/Wholesale atau ditahan oleh POS lain. Jika transaksi batal/gagal/kedaluwarsa, jumlah tersedia kembali.
- Setelah pembayaran berhasil, transaksi POS mengikat stok yang ditahan sebagai penjualan tanpa mengubah status pengiriman.
- POS tidak menyediakan tindakan koreksi stok; penyesuaian dilakukan dari manajemen produk.
- Pesanan POS tidak meminta data shipping, tidak menghitung ongkir, dan tidak menghasilkan resi.
- Laporan dapat memfilter atau membandingkan penjualan POS dengan penjualan online tanpa menghitung transaksi POS dua kali.
- Admin dapat membuka kembali detail transaksi dan mencetak ulang struk.

## 6. Batasan akses dan privasi

- Semua layar dan endpoint POS hanya dapat dipakai admin.
- POS tidak dapat diakses melalui navigasi, halaman, atau endpoint publik.
- Informasi customer yang dikumpulkan dibatasi pada kebutuhan transaksi dan bukti penjualan.
- Aksi membuat, membatalkan, mengubah, dan mengembalikan transaksi dicatat dengan admin serta waktu tindakan.

## 7. Kriteria penerimaan

- Admin dapat menyelesaikan transaksi workshop tanpa memasukkan alamat pengiriman.
- Customer boleh dikaitkan ke transaksi atau dibiarkan kosong.
- Harga dan rincian item transaksi tetap sama walau harga produk berubah kemudian.
- Dua transaksi bersamaan tidak dapat menjual unit stok terakhir yang sama.
- Metode pembayaran dan status lunas terlihat di detail pesanan.
- Total POS menggunakan IDR, kurs USD–IDR yang dipakai tersimpan pada order, dan diskon order menyimpan nilai serta alasan.
- Harga item hasil konversi dibulatkan ke rupiah penuh sebelum total keranjang dihitung.
- Admin dapat menyesuaikan harga satuan tiap item di keranjang POS; harga hasil penyesuaian tersimpan pada transaksi dan tidak mengubah katalog produk atau harga website.
- POS menahan stok yang tersedia sebelum pembayaran dikonfirmasi; stok tidak bisa diambil oleh checkout online atau transaksi lain selama reservasi aktif.
- Pembayaran lunas membuat order POS dan mengikat stok yang ditahan sebagai penjualan secara atomik; pelepasan atau kedaluwarsa mengembalikan jumlah ke pool bersama.
- Stok POS, Retail, dan Wholesale berasal dari satu pool tanpa alokasi khusus channel.
- Kupon toko online ditolak pada POS; retur/refund mengikuti alur pesanan admin.
- Transaksi POS terlihat dalam daftar pesanan dan laporan, dengan penanda sumber POS.
- Pengguna publik dan customer tidak dapat membuka POS atau membuat transaksi POS melalui URL/API.
- Struk dapat dicetak atau disimpan setelah transaksi sukses.

## 8. Catatan implementasi

Kode POS tersedia di dashboard admin dan API admin. POS memakai stok bersama dengan Retail dan Wholesale. Sebelum pembayaran diterima admin, API menahan stok secara atomik selama lima menit; hold dapat diperpanjang atau dilepas. Konfirmasi pembayaran penuh membuat order POS Paid/Completed dan mengikat hold ke order dalam satu transaksi.

Admin mengatur kurs USD–IDR, memilih metode tunai/transfer/QRIS, dapat menyesuaikan harga item dan memberi diskon dengan alasan, lalu mencetak struk. Jumlah stok yang ditahan tidak tersedia bagi Retail, Wholesale, atau POS lain. API melepas hold yang tidak dikonfirmasi setelah masa berlakunya habis.

Migrasi penggabungan alokasi stok lama ke pool bersama dan tabel reservasi POS ada di `api/prisma/migrations/20261018200000_customer_accounts_wholesale/migration.sql`. Pemeriksaan database lokal belum berhasil pada turn implementasi ini, sehingga migrasi perlu diterapkan sebelum versi kode terbaru berjalan dengan database.
