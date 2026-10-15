# Verifikasi live checkout RENDI VIRGO

Tanggal: 15 Oktober 2026, WIB
URL: `https://rendivirgo.com`
Jenis pemeriksaan: GET publik, tanpa membuat pesanan atau pembayaran.

## Hasil

- Website live merespons HTTP 200.
- `GET /api/payments/methods` merespons HTTP 200 dengan `paypal.enabled: false`.
- Pengaturan publik live menyatakan `payments.paypalEnabled: true`. Dengan implementasi API saat ini, gabungan hasil tersebut menunjukkan Client ID atau Client Secret PayPal belum tersedia pada proses API live (atau versi API yang sedang berjalan berbeda dari kode yang diperiksa). Pemeriksaan publik tidak dapat mengidentifikasi kredensial mana yang hilang dan tidak membaca nilainya.
- Alur pembayaran live belum dapat diuji end to end karena PayPal dilaporkan tidak aktif. Jangan membuat order live untuk menguji konfigurasi ini. Perubahan checkout yang disiapkan akan menonaktifkan tombol sebelum order dibuat ketika PayPal tidak tersedia, setelah kode diterapkan.
- Tidak ada order, reservasi stok, email, atau pembayaran live yang dibuat.
- Di lingkungan lokal, API telah dimulai ulang setelah konfigurasi sandbox disimpan. Endpoint metode pembayaran melaporkan aktif, dan permintaan token OAuth PayPal sandbox mendapat HTTP 200. Ini bukan bukti bahwa order, capture, callback, atau webhook sudah berhasil.

## Tindakan yang diperlukan untuk uji live

Atur Client ID dan Client Secret REST **Live** pada konfigurasi environment server API dan pastikan `PAYPAL_ENV="live"`. Sakelar `payments.paypalEnabled` sudah aktif. Jangan memakai kredensial sandbox untuk pembayaran live. Jika webhook digunakan, daftarkan endpoint `https://rendivirgo.com/api/payments/paypal/webhook` pada aplikasi PayPal Live dan simpan Webhook ID live pada server. Setelah perubahan diterapkan, mulai ulang/deploy API lalu pastikan endpoint metode pembayaran mengembalikan `paypal.enabled: true`.

Setelah indikator itu aktif, lakukan uji transaksi live hanya dengan produk uji dan nilai pembayaran yang telah disetujui. Pemeriksaan saat ini berhenti sebelum tahap tersebut karena PayPal live belum aktif.
