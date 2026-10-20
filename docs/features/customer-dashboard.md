# Spesifikasi Akun dan Dashboard Customer

| | |
|---|---|
| Produk | RENDI VIRGO Online Store |
| Status | Implementasi UI, API, dan skema tersedia; migrasi belum diterapkan ke database lokal |
| Tanggal | 18 Oktober 2026 |
| Cakupan | Registrasi, login, riwayat order, dan pengelolaan profil customer |

## 1. Ringkasan

Customer Portal memberi customer RENDI VIRGO akses akun untuk melihat pesanan dan mengelola informasi profilnya. Portal menggunakan registrasi dan login email-password. Email harus diverifikasi sebelum akun dapat membuka data customer atau order.

Dashboard ini menjadi fondasi untuk fitur customer selanjutnya, termasuk Wholesale. Hak Wholesale tetap menjadi izin terpisah yang diberikan dan dikelola admin.

## 2. Kondisi saat ini

- Admin sudah memiliki login email-password dan sesi tersendiri.
- Customer memiliki profil dengan email, nama, telepon, alamat utama, catatan, dan tag.
- Registrasi email-password, verifikasi email, login, reset password, sesi customer, profil, dan riwayat order sudah tersedia di aplikasi.
- Checkout guest tetap tersedia. Order yang dibuat sebelum email diverifikasi dapat dihubungkan setelah customer membuktikan kepemilikan email.
- Halaman `/orders` menyediakan tautan email sementara untuk melihat riwayat order.

## 3. Istilah dan hubungan data

- **Customer profile** adalah rekaman orang atau bisnis pada data commerce RENDI VIRGO. Profil dapat terbentuk dari checkout meskipun customer belum memiliki akun.
- **Customer account** adalah identitas login customer yang sudah memverifikasi email. Satu account terhubung ke satu customer profile.
- **Order** tetap menjadi rekaman pembelian dengan detail harga, alamat pengiriman, dan item saat order dibuat. Perubahan profil tidak mengubah snapshot order lama.
- Email yang sudah diverifikasi menjadi dasar untuk mencocokkan account dengan profil dan order terdahulu.

Jika customer mendaftar dengan email yang sudah memiliki profil atau order, verifikasi email menghubungkan account ke profil tersebut dan menautkan order guest yang sesuai. Jika customer berbelanja sebagai guest setelah account terverifikasi, order baru masuk ke dashboard saat customer login berikutnya. Checkout guest tidak boleh mengubah profil terverifikasi atau menautkan order ke akun tersebut sebelum pemilik email login.

## 4. Tujuan

- Memungkinkan customer membuat account dan masuk dengan email-password.
- Menampilkan riwayat dan detail order milik customer yang sedang masuk.
- Menampilkan status pembayaran, pemenuhan, dan informasi pelacakan yang tersedia.
- Memungkinkan customer memperbarui nama, telepon, dan alamat pengiriman utama.
- Menyediakan alur verifikasi email dan pemulihan password.
- Menjadi autentikasi bersama untuk akun customer umum dan akun yang memiliki izin Wholesale.

## 5. Ruang lingkup versi pertama

### 5.1 Registrasi dan keamanan akun

- Customer dapat mendaftar dengan nama, email, dan password.
- Sistem mengirim tautan verifikasi ke email yang didaftarkan. Account belum dapat membuka dashboard sebelum alamat email diverifikasi.
- Tautan verifikasi bersifat sekali pakai dan memiliki masa berlaku terbatas.
- Setelah berhasil memverifikasi email, customer dapat masuk ke dashboard.
- Login menggunakan email dan password. Pesan kegagalan login tidak membocorkan apakah suatu email terdaftar.
- Customer dapat meminta tautan reset password melalui email. Respons permintaan reset tidak membocorkan apakah email terdaftar.
- Reset password menggunakan token sekali pakai yang kedaluwarsa. Reset mencabut sesi aktif lainnya.
- Customer dapat keluar dari sesi saat ini.
- Password disimpan dalam bentuk hash, bukan teks biasa.

### 5.2 Beranda dashboard

Setelah masuk, customer melihat:

- sapaan dan ringkasan account;
- jumlah order dan ringkasan order terbaru;
- order yang masih menunggu pembayaran atau sedang diproses;
- order terbaru dengan status serta tautan ke detail;
- navigasi ke Order Saya dan Profil.

### 5.3 Riwayat dan detail order

- Customer dapat menyelesaikan checkout Retail sebagai guest tanpa membuat Customer account. Login/registrasi tidak menjadi syarat untuk membeli.
- Setelah checkout guest, customer dapat mendaftar menggunakan email yang sama untuk membuat account dan mengakses order terdahulunya setelah memverifikasi email.
- Daftar order ditampilkan dari yang terbaru, dengan pagination jika jumlahnya banyak.
- Baris order menampilkan nomor order, tanggal, jumlah item, total, status order, dan status pembayaran.
- Halaman detail menampilkan item, kuantitas, harga yang tercatat, ringkasan total, alamat pengiriman pada saat order, metode pembayaran, serta informasi carrier dan tracking jika tersedia.
- Customer dapat membuka hanya order yang terkait dengan account-nya.
- Order guest yang dibuat sebelum registrasi hanya ditautkan ke account setelah email account diverifikasi dan cocok dengan email order yang dinormalisasi. Order guest yang dibuat setelah email sudah terverifikasi ditautkan saat pemilik account login berikutnya. Checkout guest tidak mengubah profil terverifikasi.
- Tautan riwayat order `/orders` yang sudah ada tetap tersedia untuk customer yang belum membuat account.

### 5.4 Profil customer

- Customer dapat melihat dan memperbarui nama, nomor telepon, serta alamat pengiriman utama.
- Perubahan profil hanya berlaku untuk order berikutnya; alamat dan nama pada order yang sudah dibuat tetap menjadi snapshot.
- Email login tidak dapat diubah pada versi pertama. Perubahan email memerlukan alur verifikasi khusus pada iterasi berikutnya.
- Customer mengubah password melalui tautan reset yang dikirim ke email terverifikasi.
- Persetujuan email marketing ditampilkan dan dikelola terpisah dari persetujuan pembuatan account.

## 6. Alur utama

### Registrasi

1. Customer mengisi nama, email, dan password.
2. Sistem menormalisasi email dan membuat atau menyiapkan account yang belum terverifikasi.
3. Sistem mengirim tautan verifikasi ke email tersebut.
4. Customer membuka tautan yang masih berlaku.
5. Sistem menandai email terverifikasi, menghubungkan account dengan profil customer yang memakai email itu, lalu membuka dashboard.

### Login

1. Customer mengisi email dan password.
2. Server memverifikasi kredensial dan status email.
3. Server membuat sesi customer dan mengirim cookie sesi yang aman.
4. Customer diarahkan ke dashboard atau ke halaman yang sebelumnya diminta.

### Melihat order lama

1. Customer membuat account dengan email yang dipakai saat checkout guest atau order terdahulu.
2. Customer memverifikasi kepemilikan email.
3. Server menghubungkan account ke customer profile serta order yang memiliki email terverifikasi sama.
4. Server memeriksa kepemilikan pada setiap permintaan order detail dan tidak mengandalkan nomor order saja.

## 7. Privasi dan keamanan

- Pemeriksaan autentikasi dan kepemilikan dilakukan di server pada setiap endpoint privat. Menyembunyikan tombol atau tautan di frontend tidak dianggap sebagai kontrol akses.
- Sesi memakai token acak yang disimpan dalam bentuk hash di database. Cookie bersifat `HttpOnly`, `SameSite=Lax`, dan `Secure` pada production.
- Halaman dan respons API account bersifat privat dan tidak boleh masuk cache publik atau indeks mesin pencari.
- Registrasi, login, verifikasi email, dan reset password diberi pembatasan laju.
- Token verifikasi dan reset disimpan sebagai hash, memiliki masa berlaku, dan hanya dapat dipakai sekali.
- Password memiliki panjang minimum 12 karakter.
- Pemulihan password mencabut sesi yang sudah aktif agar account yang mungkin terkompromi tidak tetap terbuka.
- Customer tidak dapat memilih `customerId` atau email lain untuk membaca order. Server mengambil identitas dari sesi terverifikasi.
- Kegagalan permintaan reset dan registrasi tidak mengungkap keberadaan account kepada pihak yang tidak terautentikasi.

## 8. Kriteria penerimaan

- Customer dapat mendaftar dengan email dan password, tetapi tidak dapat masuk sebelum email diverifikasi.
- Customer yang sudah memiliki profil dan order dapat menghubungkannya ke account setelah membuktikan kepemilikan email.
- Customer dapat membeli sebagai guest, lalu mendaftar dengan email yang sama dan melihat order guest setelah email diverifikasi.
- Customer baru belum dapat memakai profil atau dashboard sebelum verifikasi email berhasil.
- Customer yang masuk melihat ringkasan, daftar, dan detail order miliknya.
- Permintaan untuk membaca order milik customer lain ditolak di server, termasuk jika nomor order diketahui.
- Perubahan profil tidak mengubah snapshot order yang sudah ada.
- Reset password membuat password lama tidak berlaku dan mencabut sesi aktif lainnya.
- Customer yang belum memiliki account tetap dapat meminta tautan riwayat melalui `/orders`.
- Informasi sesi dan data order tidak dikirim dalam respons publik storefront.

## 9. Parameter versi pertama

Keputusan dan parameter yang dipakai implementasi versi pertama:

1. Registrasi self-service tersedia untuk customer, tidak harus didahului pembelian.
2. Password minimum 12 karakter.
3. Tautan verifikasi dan reset berlaku selama 30 menit dan hanya dapat dipakai sekali.
4. Sesi customer berlaku 30 hari atau berakhir saat customer keluar, password direset, atau sesi dicabut.
5. Versi pertama menyimpan satu alamat pengiriman utama di profil; belum menyediakan address book beberapa alamat.
6. Customer tidak dapat mengubah email login sendiri pada versi pertama.
7. Izin Wholesale dikelola admin pada profil customer; formulir pengajuan publik tidak termasuk versi pertama.

## 10. Pengembangan lanjutan di luar versi pertama

1. Address book untuk beberapa alamat pengiriman.
2. Perubahan email login dengan verifikasi alamat baru.
3. Wishlist tersinkronisasi, retur, loyalty, dan penghapusan account.
4. Terapkan migrasi `api/prisma/migrations/20261018200000_customer_accounts_wholesale/migration.sql` pada database lokal/target sebelum fitur memakai skema baru.
