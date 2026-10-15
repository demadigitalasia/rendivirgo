# Laporan tindak lanjut audit checkout

Tanggal: 15 Oktober 2026, WIB
Lingkungan: lokal, storefront `http://localhost:3001`, API lokal, database `rendi_virgo_dev`.

## Status

Perbaikan kode dan migrasi lokal yang dapat dilakukan tanpa keputusan tarif bisnis sudah diterapkan. Checkout kini dapat menghitung ongkir dari browser pada port 3001, produk kembali terbaca, keranjang pulih setelah reload, dan permintaan pesanan memiliki kunci idempotensi untuk mencegah duplikasi saat klien mengulang request. Setelah API lokal dimulai ulang dengan konfigurasi terkini, PayPal sandbox terdeteksi aktif dan autentikasi OAuth ke PayPal sandbox berhasil (HTTP 200); token dan kredensial tidak dicatat.

Checkout **belum siap dinyatakan lolos transaksi end to end**: autentikasi sandbox berhasil, tetapi pembayaran sandbox penuh, callback, webhook, dan email belum dijalankan. Pemeriksaan live pada `https://rendivirgo.com` menunjukkan situs merespons HTTP 200, sedangkan `GET /api/payments/methods` masih mengembalikan `paypal.enabled: false`. Checkout sengaja mempertahankan keranjang dan menonaktifkan tombol pesanan ketika PayPal belum aktif. Tarif wilayah juga perlu keputusan bisnis sebelum konfigurasi dapat dianggap benar.

## Perubahan yang diterapkan

- Mengizinkan origin development `localhost:3001`. URL balik PayPal sekarang memakai origin storefront yang memulai checkout, jika origin tersebut masuk allowlist. Konfigurasi `APP_ORIGIN` lokal memakai port storefront aktif.
- Menerapkan migrasi video produk yang tertinggal serta migrasi checkout baru. Migrasi baru menambahkan kunci request unik dan fingerprint untuk mengenali retry order yang sama. Endpoint pemulihan hanya mengembalikan status serta total setelah email cocok, dan melepas reservasi bila batas waktunya sudah lewat.
- Membedakan produk tidak ditemukan dari gangguan API. Gangguan saat memuat detail produk menampilkan halaman coba lagi, bukan halaman 404.
- Menahan penulisan keranjang dan bahasa sampai pemulihan penyimpanan selesai. Stok nol tidak lagi dianggap tersedia, kartu produk ber-varian mengarahkan pembeli ke pemilih format, dan format yang habis dinonaktifkan.
- Checkout memeriksa metode pembayaran sebelum menerima pesanan. Quote ongkir kini membedakan status memuat, gangguan API, dan tidak ada layanan; pembeli mendapat tombol coba lagi. Total akhir tidak ditampilkan sebagai final sampai ongkir tersedia.
- Merapikan formulir: nama lengkap satu kolom, telepon memakai input telepon, negara lain dapat diisi, ringkasan memiliki tautan untuk mengedit keranjang, dan draft alamat disimpan sementara di sesi browser. Draft dihapus ketika seluruh isian dikosongkan atau order berhasil dibuat.
- Mengoreksi teks reservasi stok agar sesuai perilaku server, serta menghapus label internal tarif seperti “API default” dari tampilan pembeli.

## Pemeriksaan ulang

- Pemeriksaan tipe TypeScript storefront dan API berhasil.
- Pemeriksaan ulang lokal setelah restart API: `GET /api/payments/methods` mengembalikan `paypal.enabled: true`; autentikasi OAuth ke PayPal sandbox mendapat HTTP 200. Ini membuktikan kredensial sandbox dapat dipakai oleh API lokal, bukan transaksi atau webhook end to end.
- Pemeriksaan live read-only: `https://rendivirgo.com` merespons HTTP 200 dan `GET https://rendivirgo.com/api/payments/methods` mengembalikan `paypal.enabled: false`. Tidak ada order, reservasi stok, capture, atau perubahan data live yang dibuat. Rincian dan prasyarat pengaktifan live ada di [laporan verifikasi live](./laporan-verifikasi-live.md).
- Status Prisma menyatakan skema lokal up to date: 9 migrasi telah tercatat.
- Browser pada `localhost:3001` menampilkan 26 produk. Detail Moss Tumbled Selection dapat dibuka dan varian 500 g terpilih pada harga USD 72.
- Keranjang bertahan setelah halaman dimuat ulang. Gabungan Forest River Cabochon dan varian 500 g menghitung subtotal USD 220 dan berat 518 g.
- Checkout US memperoleh quote USD 25, USD 50, dan USD 77. Subtotal USD 148 dengan opsi pertama menampilkan total USD 173.
- Validasi kode diskon dari origin 3001 menampilkan “Discount code not found”, bukan penolakan origin. Pemilihan negara lain menampilkan kolom nama negara, dan draft uji bertahan setelah reload.
- Data uji sintetis sudah dihapus; keranjang browser dikembalikan kosong. Tidak ada order, email, atau pembayaran uji yang dibuat.

## Yang masih perlu diselesaikan

1. **PayPal sandbox:** endpoint metode pembayaran masih melaporkan `paypal.enabled: false`. Kredensial sandbox dan pengaturan aktif belum tersedia pada konfigurasi lokal. Setelah tersedia, uji approve, cancel, capture, callback, webhook, retry, dan email konfirmasi dengan inbox uji.
2. **Zona dan tarif pengiriman:** tarif aktif masih memakai region `Worldwide`; quote AS tetap memuat nama “Asia Pacific Standard/Express”. Saya membiarkan tarif database tidak berubah karena negara tujuan, nama layanan, biaya kurir, dan tarif bisnis yang benar belum ditetapkan. Minta bisnis menyetujui matriks negara/zona, nama layanan, harga, dan estimasi waktu kirim, lalu konfigurasi dan uji Indonesia, AS, negara lain, negara tanpa layanan, berat/fragile, serta free shipping.
3. **Konfirmasi transaksi:** alur submit order, reservasi stok aktual, pemulihan order dari server, idempotensi retry pada transaksi nyata, pembayaran, webhook terlambat, dan pengiriman email belum dijalankan. Meskipun jalur pemulihan/idempotensi sudah dikompilasi dan migrasinya diterapkan, validasi transaksi membutuhkan metode pembayaran sandbox.
4. **Tampilan ponsel setelah perubahan:** ringkasan lipat di atas formulir sudah ditambahkan, tetapi tidak dapat diverifikasi ulang pada ukuran viewport ponsel di sesi ini.

Laporan audit awal beserta bukti browser/API/DB tetap tersedia di [laporan checkout](./laporan-checkout.md).
