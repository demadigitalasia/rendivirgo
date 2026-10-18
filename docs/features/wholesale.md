# Spesifikasi Fitur Wholesale

| | |
|---|---|
| Produk | RENDI VIRGO Online Store |
| Status | Draft awal untuk validasi bisnis |
| Tanggal | 18 Oktober 2026 |
| Cakupan | Harga dan pemesanan wholesale privat di dashboard customer terpilih |

## 1. Ringkasan

Wholesale menyediakan katalog/harga dan alur pemesanan khusus untuk customer yang telah disetujui owner. Fitur ini hanya muncul setelah customer masuk ke akun yang memiliki akses Wholesale. Pengunjung publik dan customer tanpa izin tidak boleh melihat halaman, data produk khusus, harga grosir, atau API Wholesale.

Asumsi awal dokumen ini: customer tetap dapat melihat katalog retail publik sesuai aturan storefront yang berlaku. Wholesale menambahkan ruang privat untuk melihat harga dan melakukan pemesanan khusus; produk yang hanya boleh dijual secara wholesale dapat ditandai terpisah oleh admin.

## 2. Tujuan

- Menawarkan harga grosir kepada reseller, pengrajin, dan mitra yang dipilih owner.
- Mengelola akses per customer tanpa menampilkan penawaran grosir di storefront publik.
- Menerima pesanan Wholesale dengan harga dan ketentuan yang tercatat pada saat pemesanan.
- Menampilkan customer, order, dan performa penjualan Wholesale di dashboard admin.

## 3. Pengguna dan hak akses

- **Admin**: mengaktifkan, menangguhkan, atau mencabut akses Wholesale; mengatur harga dan ketentuan; meninjau order.
- **Customer Wholesale aktif**: dapat membuka modul Wholesale dari dashboard akunnya, melihat penawaran yang diizinkan, dan membuat order sesuai ketentuan akun.
- **Customer biasa dan pengunjung publik**: tidak melihat tautan, halaman, harga, produk khusus, atau data Wholesale.

Pemberian akses dilakukan manual oleh admin pada fase awal. Fitur tidak menyediakan pendaftaran Wholesale publik kecuali owner memutuskan untuk menambah proses aplikasi tersendiri.

## 4. Prasyarat akun customer

Saat ini customer tersimpan sebagai data profil/riwayat order. Riwayat order dapat dibuka lewat tautan email sementara, tetapi belum tersedia autentikasi akun customer permanen dan dashboard akun umum. Karena itu, Wholesale bergantung pada pembangunan akses akun customer yang aman, termasuk:

- login dan sesi customer yang dapat diverifikasi di server;
- hubungan terverifikasi antara akun login dan satu profil customer;
- halaman dashboard customer yang memerlukan autentikasi;
- proses pemulihan akses dan pencabutan sesi yang sesuai.

Tautan riwayat pesanan sementara tidak cukup sebagai kontrol akses untuk menampilkan harga dan katalog privat.

## 5. Pengalaman customer

1. Admin menyetujui akun customer dan mengaktifkan akses Wholesale.
2. Customer masuk ke akun. Dashboard hanya menampilkan bagian Wholesale bila akses masih aktif.
3. Customer membuka katalog Wholesale dan melihat produk/varian yang tersedia beserta harga dan ketentuan akun.
4. Customer menambah produk ke keranjang Wholesale. Sistem memvalidasi harga, jumlah minimum, kemasan/kelipatan, stok, dan akses akun di server.
5. Customer mengirim order melalui alur checkout privat. Ongkir, alamat, metode pembayaran, dan konfirmasi mengikuti ketentuan Wholesale yang telah dikonfigurasi.
6. Customer melihat status serta riwayat order Wholesale di dashboard akun.
7. Jika akses ditangguhkan atau dicabut, customer tidak dapat membuat order baru atau melihat harga Wholesale. Order lama tetap tersimpan dan dapat diakses sesuai kebijakan riwayat order.

## 6. Kebutuhan fungsional

### 6.1 Pengelolaan akses customer

- Admin dapat melihat status Wholesale pada profil customer dan mengaktifkan, menangguhkan, atau mencabut akses.
- Admin dapat mencatat tanggal perubahan, pemberi akses, catatan internal, dan tier/ketentuan akun bila digunakan.
- Customer tanpa akses aktif mendapat respons akses ditolak jika mencoba URL langsung atau memanggil API Wholesale.
- Informasi izin tidak boleh bergantung hanya pada tombol/tab yang disembunyikan di frontend.
- Pengaktifan akses tidak boleh mengubah data profil publik customer atau membuat penanda Wholesale terlihat di storefront.

### 6.2 Katalog dan harga privat

- Admin dapat memilih produk/varian yang ditawarkan secara Wholesale.
- Harga Wholesale ditetapkan secara eksplisit per produk/varian. Harga retail tidak otomatis ditampilkan sebagai harga grosir.
- Produk dapat dikonfigurasi untuk: retail dan Wholesale, Wholesale saja, atau tidak ditawarkan secara Wholesale.
- Produk tanpa harga/izin Wholesale tidak ditampilkan kepada customer Wholesale.
- Harga, mata uang, minimum order, dan kelipatan pemesanan ditampilkan dengan jelas sebelum customer mengirim order.
- Harga yang digunakan disimpan sebagai snapshot di item order. Perubahan daftar harga tidak mengubah order sebelumnya.
- Tier harga berdasarkan volume dapat ditambahkan sebagai aturan opsional; batas volume dan cara menghitungnya perlu keputusan owner sebelum implementasi.

### 6.3 Order dan pembayaran

- Order Wholesale memiliki penanda sumber **Wholesale** dan hubungan ke customer yang terautentikasi.
- Sistem memvalidasi akses akun, harga, jumlah minimum, stok, ongkir, diskon, dan total di server saat order dikirim.
- Order memakai mekanisme ketersediaan/penahanan stok yang konsisten dengan checkout toko agar tidak terjadi overselling.
- Detail order menampilkan harga per unit, jumlah, harga Wholesale yang disimpan, ongkir, diskon yang diizinkan, total, dan status pembayaran.
- Pembayaran berjangka/kredit tidak aktif secara default. Jika dibutuhkan, admin harus mengatur termin dan batas kredit secara eksplisit.
- Diskon retail dan kode kupon tidak dapat ditumpuk dengan harga Wholesale kecuali admin mengizinkannya secara khusus.
- Customer dapat melihat daftar dan detail order Wholesale miliknya saja. Akses akun lain harus ditolak di server.

### 6.4 Pengelolaan admin dan laporan

- Admin dapat mencari customer Wholesale, melihat status akses, dan membuka riwayat order mereka.
- Daftar order admin dapat membedakan sumber Wholesale dari POS dan order online.
- Laporan penjualan dapat memfilter atau mengelompokkan penjualan Wholesale.
- Perubahan akses, harga, minimum order, dan ketentuan akun tercatat di audit log.

## 7. Privasi dan keamanan

- Tidak ada halaman pemasaran atau pendaftaran Wholesale publik pada cakupan awal.
- URL privat tidak dimasukkan ke sitemap dan tidak dapat diindeks mesin pencari.
- API hanya mengirim produk, harga, dan order Wholesale setelah memeriksa sesi serta izin customer.
- Harga/produk privat tidak dikirim di payload publik, HTML awal, metadata, atau data terstruktur storefront.
- Customer hanya dapat membaca order yang terkait dengan akun/profilnya.
- Akses Wholesale dicabut efektif pada request berikutnya setelah status dinonaktifkan.

## 8. Kriteria penerimaan

- Customer Wholesale aktif melihat bagian Wholesale di dashboard setelah login.
- Customer biasa dan pengunjung publik tidak melihat bagian tersebut atau harga Wholesale.
- Percobaan membuka halaman/API privat tanpa akses aktif ditolak di server.
- Customer aktif hanya melihat produk/varian yang dipilih untuk akun atau tier-nya.
- Harga dan aturan order yang telah disepakati tersimpan di order sebagai snapshot.
- Sistem menolak jumlah di bawah minimum, jumlah yang tidak sesuai kelipatan, harga basi, atau stok yang sudah tidak cukup.
- Customer hanya dapat melihat order Wholesale miliknya sendiri.
- Admin dapat menonaktifkan akses dan melihat order terdahulu tetap tercatat.
- Order Wholesale muncul di dashboard dan laporan dengan penanda sumber yang jelas.

## 9. Keputusan yang perlu dikonfirmasi

1. Apakah harga Wholesale sama untuk semua akun aktif atau berbeda per customer/tier?
2. Apakah harga Wholesale ditentukan per produk, per varian, per jumlah pembelian, atau gabungan?
3. Apakah ada nilai minimum belanja, minimum per produk, atau kelipatan/ukuran paket tertentu?
4. Apakah customer Wholesale langsung melakukan checkout dan membayar, atau mengirim permintaan penawaran untuk disetujui admin?
5. Metode pembayaran dan termin apa yang tersedia? Apakah kredit/net terms pernah diizinkan?
6. Apakah item Wholesale juga dijual retail secara publik, atau ada katalog produk Wholesale-only?
7. Apakah owner ingin menerima permohonan akses Wholesale, atau akses sepenuhnya diberikan manual?

## 10. Konteks implementasi saat ini

Dokumen perencanaan proyek sudah menyebut segmen reseller, catatan customer, dan harga grosir untuk role reseller sebagai fitur lanjutan. Implementasi saat ini memiliki customer dengan tag/catatan dan order, tetapi model customer belum memiliki autentikasi atau status Wholesale. Dashboard akun customer juga belum tersedia; halaman `/orders` saat ini menggunakan tautan email untuk melihat riwayat pesanan. Akses akun, katalog privat, aturan harga, dan penanda sumber order perlu dirancang sebelum implementasi Wholesale.
