# Spesifikasi Fitur POS Workshop

| | |
|---|---|
| Produk | RENDI VIRGO Online Store |
| Status | Implementasi tersedia; migrasi telah diterapkan pada database pengembangan lokal |
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
- Stok POS dan online memakai persediaan yang sama; admin boleh mengalokasikan sebagian stok khusus untuk workshop.
- Jika alokasi workshop habis, POS boleh memakai stok bersama yang masih tersedia selama stok itu tidak terikat reservasi order online.
- Stok POS baru dikurangi setelah pembayaran lunas dikonfirmasi dan ketersediaan dicek ulang.
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
5. Admin memilih metode pembayaran, mencatat referensi/catatan bila diperlukan, lalu mengonfirmasi pembayaran yang benar-benar sudah diterima.
6. Setelah pembayaran lunas dikonfirmasi, sistem memeriksa ulang ketersediaan dan menyimpan transaksi serta pengurangan stok secara atomik. Jika stok berubah sebelum konfirmasi, sistem menolak transaksi dan meminta admin memperbarui keranjang.
7. POS menampilkan konfirmasi dan menyediakan bukti/struk yang bisa dicetak atau disimpan.
8. Barang diserahkan langsung di workshop. Pesanan POS tidak membutuhkan alamat atau ongkos kirim; penyelesaian transaksi tidak boleh mencatat status pengiriman.

## 5. Kebutuhan fungsional

### 5.1 Keranjang dan harga

- Pada pengaturan produk, admin memilih kanal penjualan: **Web + Workshop POS**, **Web saja**, atau **Workshop POS saja**.
- Produk **Workshop POS saja** hanya muncul di katalog kasir admin dan tidak boleh tampil pada katalog, pencarian, halaman produk, sitemap, atau API publik website.
- Pengaturan kanal menentukan di mana produk boleh dijual; pengaturan alokasi stok menentukan jumlah yang dilindungi untuk workshop. Keduanya berdiri sendiri.
- Admin dapat menambah, menghapus, dan mengubah jumlah barang dalam keranjang.
- Pencarian mendukung nama dan SKU. Pemindai barcode dapat digunakan bila perangkat mengirim hasil scan sebagai input teks; kebutuhan perangkat keras khusus belum termasuk cakupan.
- Harga katalog dikonversi ke IDR sebagai harga awal. Admin dapat mengubah harga satuan langsung pada setiap baris keranjang; nilai ini hanya berlaku untuk transaksi berjalan.
- Harga satuan akhir yang dikonfirmasi disimpan sebagai snapshot di item pesanan sehingga perubahan harga katalog, kurs, atau keranjang berikutnya tidak mengubah transaksi lama.
- Produk unik tidak dapat dijual melebihi stok tersedia. Produk dengan model stok kuantitas mengikuti jumlah tersedia dan satuan produk.
- Produk Draft, Reserved, Sold, Archived, atau tidak tersedia tidak dapat ditambahkan sebagai barang yang dapat dijual.
- POS hanya menampilkan produk yang diizinkan untuk kanal Workshop POS dan memiliki status/ketersediaan yang dapat dijual.
- Menambahkan produk ke keranjang tidak menahan stok. Saat admin menyelesaikan penjualan, sistem memeriksa ulang jumlah yang benar-benar dapat dijual dan mengurangi stok hanya setelah pembayaran lunas berhasil dikonfirmasi.
- Stok yang dialokasikan khusus workshop tersedia untuk POS dan tidak boleh dihitung sebagai stok yang dapat dibeli di website. Alokasi dikelola dari manajemen produk, bukan melalui koreksi stok di POS.
- Setelah alokasi workshop habis, POS boleh menggunakan sisa stok bersama, tetapi tidak boleh menjual stok yang sedang direservasi order online.
- Pemeriksaan ketersediaan dan pengurangan stok dilakukan secara atomik serta memperhitungkan reservasi order online yang belum dibayar.
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
- Stok yang dialokasikan untuk workshop tidak tersedia pada checkout online, dan penjualan online tidak dapat menghabiskan jumlah tersebut.
- Admin dapat mengatur kanal produk sebagai Web + Workshop POS, Web saja, atau Workshop POS saja; produk POS saja tidak bocor ke storefront maupun API publik.
- Saat alokasi workshop habis, POS dapat menjual stok bersama yang tersedia dan tidak sedang direservasi order online.
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
- Stok POS baru berkurang setelah pembayaran lunas, dengan pengecekan ulang terhadap stok bersama dan reservasi aktif.
- Stok alokasi workshop terlindungi dari penjualan online; POS dapat memakai stok bersama jika alokasi habis dan jumlah itu belum direservasi online.
- Kupon toko online ditolak pada POS; retur/refund mengikuti alur pesanan admin.
- Transaksi POS terlihat dalam daftar pesanan dan laporan, dengan penanda sumber POS.
- Pengguna publik dan customer tidak dapat membuka POS atau membuat transaksi POS melalui URL/API.
- Struk dapat dicetak atau disimpan setelah transaksi sukses.

## 8. Catatan implementasi

Kode POS tersedia di dashboard admin dan API admin. Implementasi menambahkan kanal penjualan produk, alokasi stok workshop, transaksi POS ber-IDR, kurs snapshot, penyesuaian harga per item di keranjang, metode tunai/QRIS, diskon order dengan alasan, struk, penanda sumber pesanan, dan pelaporan POS terpisah dari angka USD.

Migrasi database yang dipakai ada di `api/prisma/migrations/20261018180000_workshop_pos/migration.sql` dan `api/prisma/migrations/20261018190000_workshop_pos_prices/migration.sql`; keduanya telah diterapkan pada database pengembangan lokal. Kolom harga khusus dari rancangan POS sebelumnya dipertahankan sebagai data lama yang tidak digunakan oleh API atau layar produk. Admin mengatur kurs USD–IDR di halaman POS, lalu dapat menyesuaikan harga tiap item di keranjang untuk transaksi berjalan; harga akhir tersimpan pada item pesanan. Stok workshop dapat dialokasikan pada pengaturan produk; stok bersama tetap dapat dipakai POS selama belum direservasi checkout online.
