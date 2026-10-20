# Spesifikasi Fitur Wholesale

| | |
|---|---|
| Produk | RENDI VIRGO Online Store |
| Status | Implementasi UI, API, dan migrasi tersedia; migrasi belum diterapkan ke database lokal |
| Tanggal | 18 Oktober 2026 |
| Cakupan | Katalog privat dan pemesanan Wholesale untuk customer pasar nasional dan internasional |

## 1. Ringkasan

Wholesale adalah katalog dan checkout khusus untuk customer pasar nasional maupun internasional yang memiliki Customer account terverifikasi dan telah diberi akses Wholesale oleh admin. Pendaftaran Customer account umum tetap terbuka, tetapi registrasi maupun verifikasi email saja tidak memberikan akses Wholesale.

Katalog Wholesale ditampilkan di dashboard customer yang berhak. Produk dapat diaktifkan secara terpisah untuk channel Retail, Wholesale, dan POS Workshop. Jika Retail dan Wholesale sama-sama aktif, produk tampil pada website publik dengan harga retail dan pada katalog privat dengan harga Wholesale. Produk yang hanya aktif untuk Wholesale tidak muncul di katalog publik. Harga Wholesale tidak pernah dikirim ke halaman atau API publik.

Customer mengirim order melalui checkout langsung. Pembayaran dan pengiriman mengikuti konfigurasi checkout online umum. Stok Retail, Wholesale, dan POS Workshop memakai satu stok bersama; pengaturan channel produk menentukan tempat produk dapat dibeli.

## 2. Tujuan

- Menawarkan produk dan harga Wholesale secara privat kepada reseller, pengrajin, dan mitra pasar nasional maupun internasional yang dipilih owner.
- Mengelola akses Wholesale terpisah dari Customer account umum.
- Memungkinkan customer membuat order Wholesale langsung dari dashboard.
- Mencatat harga, jumlah, biaya pengiriman, dan total pada order saat dibuat.
- Memisahkan order Wholesale dalam daftar dan laporan admin.

## 3. Akun, akses, dan channel penjualan

### 3.1 Customer account dan izin Wholesale

- Customer menggunakan Customer account email-password yang sama untuk fitur customer umum dan Wholesale.
- Email account wajib diverifikasi sebelum account dapat digunakan.
- Izin Wholesale adalah akses tambahan yang dikelola admin dan terhubung ke profil Customer; izin ini bukan account atau kredensial login terpisah.
- Admin memberi izin setelah meninjau Customer account yang emailnya sudah terverifikasi.
- Tidak ada formulir pengajuan Wholesale publik pada MVP. Customer dapat memiliki account umum tanpa akses Wholesale.
- Setiap permintaan ke katalog, harga, keranjang, dan checkout Wholesale memeriksa sesi Customer serta izin Wholesale aktif di server.
- Customer yang aksesnya ditangguhkan atau dicabut tetap dapat melihat riwayat order terdahulu. Katalog dan pembuatan order baru memerlukan izin aktif.
- Order yang sudah dikirim sebelum izin ditangguhkan/dicabut tetap dapat dibayar dan diproses. Admin dapat membatalkan order melalui alur order yang berlaku.

Istilah Customer account dan Customer profile mengikuti [Spesifikasi Akun dan Dashboard Customer](./customer-dashboard.md).

### 3.2 Pengaturan channel produk

Admin mengatur ketersediaan tiap produk untuk tiga channel:

- **Retail**: tampil pada website publik dan memakai harga retail.
- **Wholesale**: tampil di katalog privat dan memakai harga Wholesale.
- **POS Workshop**: tersedia untuk penjualan di Workshop.

Channel bersifat independen. Produk dapat aktif di lebih dari satu channel. Produk Wholesale-only tidak boleh muncul di katalog publik, pencarian publik, halaman produk publik, data terstruktur, sitemap, metadata, maupun payload API publik.

### 3.3 Harga Wholesale

- Admin menetapkan harga Wholesale terpisah untuk produk atau varian yang ditawarkan.
- Harga retail tidak otomatis menjadi harga Wholesale.
- Harga Wholesale dapat diubah melalui dashboard admin.
- MVP memakai satu harga Wholesale untuk setiap produk/varian; harga khusus per customer, tier akun, dan diskon berdasarkan volume tidak termasuk.
- Harga final per unit disimpan sebagai snapshot pada item order. Perubahan harga katalog tidak mengubah order sebelumnya.
- Harga hanya ditampilkan kepada Customer dengan izin Wholesale aktif.

## 4. Pengalaman Customer

1. Customer membuat Customer account umum dan memverifikasi email.
2. Admin meninjau account dan mengaktifkan izin Wholesale pada profil Customer.
3. Customer masuk ke dashboard yang sama; modul Wholesale muncul saat izinnya aktif.
4. Customer membuka katalog privat dan melihat hanya produk yang tersedia untuk channel Wholesale beserta harga Wholesale.
5. Customer menambahkan barang ke keranjang. Server memeriksa ulang izin, harga, stok, dan batas minimum order.
6. Customer menyelesaikan checkout langsung dengan opsi pembayaran dan pengiriman checkout online umum.
7. Order tersimpan dengan sumber Wholesale dan muncul di riwayat Customer serta laporan admin.

Customer yang tidak memiliki izin Wholesale tidak dapat membuka katalog privat, melihat harga Wholesale, atau membuat order Wholesale.

## 5. Kebutuhan fungsional

### 5.1 Pengelolaan akses

- Admin dapat mencari profil Customer dan mengaktifkan atau mencabut akses Wholesale.
- Perubahan akses dan identitas admin dicatat pada audit log. Akses hanya dapat diberikan setelah email customer terverifikasi.
- Admin dapat memberi akses hanya setelah email Customer account terverifikasi.
- Akses diperiksa saat setiap request privat, termasuk ketika membuat atau mengirim checkout.
- Menyembunyikan menu di frontend tidak menggantikan pemeriksaan otorisasi server.
- Admin dapat mengaktifkan kembali akses melalui kontrol yang sama; versi pertama tidak membedakan status ditangguhkan dari dicabut.

### 5.2 Katalog dan produk

- Admin dapat mengaktifkan atau menonaktifkan channel Retail, Wholesale, dan POS Workshop per produk.
- Produk yang aktif pada Retail dan Wholesale dapat tampil pada kedua channel dengan harga masing-masing.
- Produk tanpa channel Wholesale aktif atau tanpa harga Wholesale tidak masuk katalog privat.
- Produk dengan stok **Unique** harus berupa satu item tanpa varian. Produk Unique yang masih memiliki varian tidak tampil di katalog Wholesale dan checkout menolaknya sampai konfigurasi produknya diperbaiki.
- Produk Wholesale-only tidak dikirim melalui endpoint atau halaman publik.
- Harga Wholesale tidak boleh masuk ke HTML awal, cache publik, sitemap, SEO, data terstruktur, atau endpoint katalog retail.
- Setiap produk/varian memiliki unit jual untuk keranjang dan faktor konversi ke pcs untuk minimum order. Produk yang dijual langsung per pcs memakai faktor 1; produk per pair, bag, gram, strand, atau unit lain memerlukan faktor pcs yang ditetapkan admin agar dapat dihitung pada batas 100 pcs.

### 5.3 Batas minimum order

Dashboard admin menyediakan pengaturan minimum Wholesale dengan nilai awal:

- Minimum subtotal barang: **US$300**.
- Minimum jumlah: **100 pcs**.

Kedua nilai berlaku global untuk seluruh customer Wholesale pada MVP; pengaturan minimum per customer tidak termasuk cakupan awal.

Order memenuhi batas minimum jika **salah satu** kondisi berikut tercapai:

- subtotal barang Wholesale mencapai minimum nilai; **atau**
- total pcs hasil konversi semua baris order mencapai minimum 100 pcs.

Contoh: 40 pcs dengan subtotal US$350 lolos melalui batas nilai; subtotal US$250 dengan 100 pcs lolos melalui batas jumlah; subtotal US$250 dengan 90 pcs tidak lolos. Jika produk dijual per pair, setiap pair dihitung sesuai faktor konversi yang ditetapkan admin.

- Kedua nilai minimum dapat diubah admin melalui dashboard admin.
- Batas jumlah dihitung dalam pcs ekuivalen: kuantitas setiap baris dikalikan faktor pcs produk/varian, lalu dijumlahkan. Produk yang tidak memiliki faktor konversi tidak menyumbang ke batas 100 pcs, tetapi tetap dihitung ke subtotal barang.
- Batas dihitung dari subtotal barang sebelum ongkir, pajak, dan diskon. Kupon/promosi Retail tidak berlaku untuk Wholesale pada MVP.
- Server menghitung dan memvalidasi ulang kedua syarat saat customer mengirim checkout; validasi di keranjang hanya membantu customer dan tidak menjadi kontrol final.
- Batas MOQ atau kelipatan khusus per produk tidak menjadi syarat MVP kecuali ditambahkan melalui keputusan berikutnya.

### 5.4 Order, pembayaran, pengiriman, dan stok

- Checkout Wholesale membuat order dengan sumber **Wholesale** yang ditentukan server; browser tidak dapat mengatur `source`, `customerId`, atau harga final.
- Customer dan profil order diambil dari sesi terverifikasi, bukan dari ID customer yang dikirim client.
- Pembayaran serta pengiriman mengikuti pilihan dan konfigurasi checkout online umum.
- Mata uang awal adalah USD, sesuai checkout online umum.
- Wholesale melayani alamat tujuan di Indonesia dan negara lain. Negara tujuan menentukan pilihan pengiriman, pembayaran, mata uang, pajak, dan biaya lain sesuai konfigurasi checkout yang tersedia.
- Server memeriksa ketersediaan layanan untuk alamat tujuan saat menghitung quote dan memvalidasinya ulang sebelum membuat order. Checkout menolak alamat yang tidak didukung konfigurasi pengiriman/pembayaran yang aktif.
- Checkout menampilkan ringkasan final subtotal barang, ongkir, pajak/biaya yang dapat dihitung, dan total sebelum customer menyetujui. Jika bea atau biaya impor tidak dapat dihitung oleh checkout, tanggung jawab pembayarannya harus dinyatakan jelas sebelum order dikirim.
- Setelah persetujuan, server memvalidasi ulang akses, produk/channel, harga, minimum order, alamat tujuan, dan stok secara atomik saat membuat order serta reservasi stok.
- Order menyimpan harga per unit, kuantitas, total per baris, ongkir, pajak, mata uang, total, dan snapshot alamat. Kupon/promosi Retail tidak diterapkan pada checkout Wholesale MVP.
- Tidak ada pembayaran kredit atau net terms khusus Wholesale pada MVP.
- Stok adalah satu pool bersama untuk Retail, Wholesale, dan POS Workshop. Penjualan pada salah satu channel mengurangi stok pool yang sama secara aman.
- Channel toggle hanya mengatur ketersediaan jual; toggle Workshop tidak membuat alokasi stok terpisah. Ketersediaan memperhitungkan seluruh reservasi aktif Retail, Wholesale, dan POS.
- Reservasi dan pelepasan stok mengikuti siklus checkout online umum.
- Order yang belum lunas tidak dapat masuk ke tahap Processing, Packed, Shipped, atau Completed. Pembatalan order Pending menandai pembayaran Failed dan melepas reservasi; expiry sweep juga mencakup order berstatus Packed yang masih Pending.
- Order berstatus Paid atau PartiallyRefunded harus menerima pencatatan refund penuh sebelum dapat dibatalkan. Pencatatan refund merekam pengembalian dana; admin tetap perlu menyelesaikan transfer dana melalui penyedia pembayaran atau bank.
- Order berstatus Returned tidak otomatis mengembalikan barang ke stok. Setelah memeriksa kondisi barang, admin menjalankan tindakan restock satu kali; tindakan tersebut dicatat pada aktivitas order.
- Bukti transfer yang ditolak dapat dikirim ulang selama order masih menunggu pembayaran dan belum kedaluwarsa. Saat bukti sedang diverifikasi, order tetap menunggu dan tidak boleh memulai percobaan pembayaran lain yang berisiko menagih customer dua kali.
- Pembayaran yang terkonfirmasi setelah order dibatalkan karena kedaluwarsa masuk ke antrean penanganan admin untuk rekonsiliasi/refund; sistem tidak otomatis membuka kembali order atau mengambil stok yang sudah dilepas.
- Order memakai status order, status pembayaran, dan pelacakan yang tersedia saat ini.
- Partial fulfillment dan pengiriman khusus masih perlu dikonfirmasi.

### 5.5 Pengelolaan admin dan laporan

- Admin dapat mencari Customer Wholesale, melihat status akses, dan membuka riwayat order.
- Daftar order dapat memfilter sumber Wholesale terpisah dari Online dan POS.
- Perubahan izin akses dan harga dicatat di audit log.
- Laporan minimum menampilkan order Wholesale dengan mata uang dan status pembayaran. Definisi metrik penjualan final masih perlu ditentukan.

## 6. Privasi dan keamanan

- Customer umum dan pengunjung publik tidak menerima harga atau data katalog yang hanya tersedia melalui Wholesale.
- Produk yang diaktifkan untuk Retail boleh tampil secara publik menggunakan harga retail; harga Wholesale tetap privat.
- API katalog dan order Wholesale memerlukan sesi Customer terverifikasi serta izin Wholesale aktif.
- Customer hanya dapat membaca order yang terhubung dengan profilnya.
- Order historis tetap dapat dibaca setelah akses Wholesale ditangguhkan atau dicabut.
- Permission diperiksa ulang di server saat checkout, sehingga keranjang yang dibuka sebelum pencabutan tidak dapat melewati pemeriksaan akses.
- Perubahan akses admin tercatat pada audit log.

## 7. Kriteria penerimaan

- Customer account umum dapat dibuat melalui registrasi terbuka dan harus memverifikasi email.
- Customer tanpa izin Wholesale tidak dapat mengakses katalog, harga, keranjang, atau checkout Wholesale melalui URL maupun API.
- Checkout Wholesale mengunci aksi kirim order sampai sesi dan izin Wholesale aktif berhasil dimuat; server memeriksa izin kembali saat quote dan pembuatan order.
- Admin dapat memberi izin Wholesale pada Customer account yang terverifikasi.
- Customer dengan akses aktif melihat katalog privat dan harga Wholesale.
- Produk yang aktif pada Retail dan Wholesale tampil di website publik dengan harga retail dan di dashboard Wholesale dengan harga Wholesale.
- Produk Wholesale-only tidak muncul dalam payload atau halaman publik.
- Harga Wholesale yang diubah admin tidak mengubah snapshot harga pada order lama.
- Order diterima bila subtotal barang sebelum ongkir, pajak, dan diskon mencapai minimum yang diatur **atau** total pcs ekuivalen mencapai minimum yang diatur; server menjadi sumber validasi final.
- Customer Wholesale dapat mengirim order ke Indonesia maupun negara lain yang didukung konfigurasi pengiriman/pembayaran.
- Order Wholesale menampilkan quote final untuk disetujui customer sebelum server membuat order dan mereservasi stok.
- Kupon/promosi Retail tidak berlaku pada checkout Wholesale MVP.
- Order Wholesale berbagi stok yang sama dengan Retail dan POS Workshop; penjualan tidak menyebabkan stok negatif atau overselling.
- Order yang belum lunas tidak dapat diproses atau dikirim, dan order Packed yang masih Pending tetap kedaluwarsa serta melepas reservasi.
- Pembatalan order lunas memerlukan pencatatan refund penuh terlebih dahulu; retur menunggu inspeksi sebelum admin mengembalikan barang ke stok.
- Pembayaran serta pengiriman menggunakan konfigurasi checkout online umum.
- Order diberi sumber Wholesale dan hanya pemilik account terkait dapat melihat detailnya.
- Setelah akses dicabut, katalog dan order baru tertutup, riwayat tetap tersedia, dan order yang telah dikirim tetap dapat diselesaikan.

## 8. Keputusan bisnis yang sudah disepakati

1. Wholesale melayani customer pasar nasional dan internasional.
2. Katalog Wholesale privat di dashboard; listing retail publik tetap berfungsi bila channel Retail produk aktif.
3. Satu Customer account email-password dipakai untuk fitur umum dan Wholesale; izin Wholesale terpisah dan diberikan admin.
4. Customer harus memverifikasi email dan menerima persetujuan admin untuk mengakses Wholesale.
5. Order dibuat melalui checkout langsung, tanpa persetujuan admin per order.
6. Harga Wholesale ditetapkan admin per produk/varian dan terpisah dari harga retail. Harga per customer/tier dan volume break tidak termasuk MVP.
7. Minimum order awal adalah US$300 subtotal barang **atau** 100 pcs ekuivalen; kedua nilai dapat diatur admin dan berlaku global pada MVP.
8. Pembayaran dan pengiriman memakai checkout online umum.
9. Retail, Wholesale, dan POS Workshop mengurangi satu stok bersama.
10. Order yang sudah dibuat tetap dapat dibayar dan diproses setelah akses Wholesale dicabut; riwayat lama tetap terlihat.
11. Minimum order dihitung dari subtotal barang sebelum ongkir, pajak, dan diskon; kupon/promosi Retail tidak berlaku untuk Wholesale MVP.
12. Checkout Wholesale melayani alamat domestik maupun internasional selama konfigurasi layanan mendukung alamat tersebut.
13. Pembayaran yang masuk setelah order kedaluwarsa ditangani admin untuk rekonsiliasi/refund dan tidak otomatis membuka kembali order.

## 9. Keputusan yang masih perlu dikonfirmasi

1. Apakah Customer Wholesale perlu nama perusahaan, alamat tagihan terpisah, nomor pajak, nomor PO, atau data invoice lain?
2. Apakah perlu status penangguhan sementara yang terpisah dari pencabutan setelah MVP?
3. Metrik apa yang dibutuhkan untuk laporan Wholesale: order dibuat, order dibayar, pendapatan bersih/refund, atau kombinasi?
4. Bagaimana pajak, bea/biaya impor, dan invoice ditampilkan atau dibebankan untuk alamat domestik dan internasional, termasuk biaya impor yang tidak dapat dihitung checkout?

## 10. Status implementasi

- Customer account email-password, verifikasi email, reset password, sesi, profil, dan riwayat order tersedia melalui `/account`.
- Admin dapat memberi atau mencabut akses Wholesale dari detail Customer. Pemberian akses ditolak sebelum email diverifikasi.
- Katalog privat, harga Wholesale, checkout, quote, validasi server, dan pengaturan MOQ admin tersedia pada `/wholesale` dan `/admin/wholesale`.
- Minimum awal adalah **US$300 subtotal barang atau 100 pcs ekuivalen**. Salah satu kondisi minimum sudah cukup untuk lolos.
- Katalog menampilkan kekurangan minimum order dan menonaktifkan aksi checkout sampai batas nilai atau jumlah pcs tercapai; kuantitas baris dibulatkan ke bilangan bulat.
- Produk dapat diaktifkan pada channel Retail, Wholesale, dan POS secara independen. Harga Wholesale terpisah dan tidak ikut payload publik.
- Produk Unique ber-varian ditolak saat disimpan dan checkout, serta dikecualikan dari katalog Wholesale.
- Retail, Wholesale, dan POS memakai satu stok. POS menahan stok selama lima menit sebelum konfirmasi lunas; admin dapat memperpanjang atau melepas hold.
- Pemenuhan hanya dapat dilanjutkan setelah pembayaran lunas. Pembatalan order lunas memerlukan refund penuh yang tercatat; restock retur dilakukan manual setelah inspeksi.
- Checkout Wholesale memeriksa sesi dan izin di antarmuka, lalu server memeriksa ulang izin saat quote dan pembuatan order.
- Migrasi skema/data berada di `api/prisma/migrations/20261018200000_customer_accounts_wholesale/migration.sql`. Pemeriksaan database lokal gagal pada turn implementasi ini, jadi migrasi perlu diterapkan sebelum menjalankan versi kode baru.
