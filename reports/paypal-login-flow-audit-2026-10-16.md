# Audit alur pembayaran PayPal — 16 Oktober 2026

## Ringkasan

**Penyebab paling mungkin:** halaman pada screenshot berada di `sandbox.paypal.com`. Akun pembeli untuk Sandbox terpisah dari akun PayPal biasa/Live. Login ke halaman itu perlu memakai akun **Personal Sandbox** yang dibuat di PayPal Developer Dashboard, bukan email dan kata sandi PayPal sehari-hari atau akun Developer Dashboard.

**Temuan alur aplikasi:** halaman PayPal berhasil dibuka setelah checkout. Itu mengindikasikan—tetapi tidak membuktikan secara mutlak—server telah membuat sesi/order PayPal dan memperoleh tautan persetujuan. Pesan “Beberapa informasi Anda tidak benar” muncul di halaman autentikasi PayPal; aplikasi toko tidak menerima atau memeriksa kata sandi pembeli. Screenshot saja tidak menunjukkan apakah akun yang dipakai adalah akun Sandbox atau Live.

**Status audit:** tinjauan kode dan halaman kebijakan selesai. Tidak ada kredensial yang dimasukkan, transaksi Sandbox/Live yang dijalankan, atau perubahan kode/config produksi yang dilakukan.

## Diagnosis berdasarkan screenshot

- URL memuat `sandbox.paypal.com/signin` dan konteks checkout Sandbox. Ini bukan login PayPal Live.
- Karena halaman login PayPal sudah muncul, dugaan utama adalah ketidakcocokan akun pembeli: kredensial Live digunakan pada Sandbox, akun Sandbox yang dipilih bukan akun Personal, atau kata sandi Sandbox sudah tidak cocok.
- Jika yang digunakan memang akun Personal Sandbox, atur ulang kata sandinya melalui Developer Dashboard: **Sandbox > Accounts > pilih akun Personal > View/Edit > Change password**. Gunakan alamat dan kata sandi yang tampil/ditetapkan untuk akun uji itu.
- Kredensial REST aplikasi (`PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`) adalah kredensial server-ke-server. Kredensial tersebut berbeda dari login pembeli dan tidak boleh dimasukkan ke formulir PayPal atau dikirim lewat chat.
- Dugaan ini tidak menutup kemungkinan masalah akun PayPal Sandbox atau kebijakan akun. Jika akun Personal Sandbox yang benar tetap ditolak setelah reset, coba akun Personal Sandbox lain yang baru dibuat dan periksa status akun di Dashboard.

## Alur yang ditinjau

1. Checkout toko membuat order internal dengan status pembayaran `Pending`.
2. Browser memanggil endpoint toko untuk membuat sesi PayPal. Server menggunakan Client ID/Secret, memilih Sandbox atau Live berdasarkan `PAYPAL_ENV`, lalu membuat order PayPal dengan intent `CAPTURE`.
3. Server menyertakan nilai order, mata uang, referensi order, serta nama dan alamat pengiriman; browser diarahkan ke tautan persetujuan PayPal.
4. Pembeli login dan menyetujui pembayaran di PayPal.
5. PayPal mengarahkan pembeli kembali ke toko. Server mengambil/capture pembayaran, memeriksa nilai, mata uang, dan alamat pengiriman, lalu menandai order selesai atau menaruhnya untuk peninjauan.

Tampilan login yang gagal berada di antara langkah 3 dan 4. Toko tidak dapat memperbaiki kata sandi pembeli; perbaikannya ada pada pemilihan akun Sandbox yang benar. Bila pengalihan gagal sebelum halaman PayPal tampil, barulah periksa log API/Coolify dan kecocokan kredensial REST.

### Konfigurasi lingkungan

Konfigurasi harus berpasangan dalam satu lingkungan:

| Tujuan | `PAYPAL_ENV` di API Coolify | Kredensial REST server | Login pembeli saat uji |
|---|---|---|---|
| Uji | `sandbox` | Sandbox Client ID dan Secret dari REST app Sandbox | Akun Personal Sandbox |
| Pembayaran pelanggan | `live` | Live Client ID dan Secret dari REST app Live | Pembeli menggunakan PayPal Live di `paypal.com` |

Setelah mengubah environment variable di Coolify, deploy ulang aplikasi **API** agar proses baru membaca nilai tersebut. Jangan menyalin Client Secret, kata sandi akun, atau token di laporan/chat. Jangan mencoba transaksi Live sebagai cara mendiagnosis login Sandbox.

`PAYPAL_WEBHOOK_ID` juga harus berasal dari webhook pada lingkungan yang sama. Kode menolak verifikasi webhook bila ID tidak ada atau isi mentah request tidak tersedia. Jalur return checkout mencoba capture langsung di server, tetapi webhook tetap diperlukan sebagai jalur konfirmasi/fallback yang andal.

## Dampak pada order dan langkah pemulihan aman

- Toko membuat order dan mengosongkan keranjang sebelum browser diarahkan ke PayPal. Karena itu, kegagalan login dapat meninggalkan order berstatus `Pending` dan stok tertahan sementara.
- Panduan deploy menyatakan reservasi stok default **60 menit**; order yang belum dibayar dilepas otomatis setelah jangka itu.
- Periksa order terbaru di Admin sebelum memulai checkout baru. Jika masih `Pending` dan belum ada pembayaran di PayPal, kembali ke checkout toko dan gunakan opsi coba lagi/pemulihan untuk order yang sama. Jangan membuat order berulang tanpa memeriksa statusnya.
- Jika PayPal menunjukkan pembayaran berhasil tetapi toko masih `Pending`, jangan membayar ulang. Simpan nomor order dan hubungi admin untuk memeriksa capture/webhook.

## Tinjauan kebijakan toko yang ditampilkan

Saya membaca halaman kebijakan publik yang tersedia dan membandingkannya dengan isi awal yang disemai di `api/prisma/seed-content.cjs`/`api/prisma/seed.ts`.

| Dokumen | Isi saat ini | Rekomendasi |
|---|---|---|
| Terms & Conditions | Pesanan dianggap dikonfirmasi setelah pembayaran diterima; harga USD; variasi batu alami bukan cacat. | Tambahkan metode pembayaran, kapan order menjadi final, penanganan pembayaran gagal/ganda, pembatalan/refund dan kontak bantuan. Jelaskan bahwa proses checkout mengikuti konfirmasi penyedia pembayaran. |
| Privacy Policy | Menyebut nama, email, alamat pengiriman, riwayat order; penyedia pembayaran menangani pembayaran dan toko tidak menyimpan data kartu. | Sebut PayPal secara jelas; jelaskan bahwa nama/alamat pengiriman, jumlah/mata uang, serta referensi order dikirim ke PayPal untuk memproses pesanan; jelaskan tujuan, penerima, pemrosesan lintas negara, retensi, dan cara mengajukan permintaan privasi. Kode yang ditinjau memang mengirim nama dan alamat pengiriman ke PayPal. |
| Shipping & Returns | Pengemasan 1–3 hari kerja; estimasi internasional 7–21 hari; ongkir berdasar berat; kerusakan/perbedaan signifikan dilaporkan dalam 7 hari dengan foto. | Jelaskan proses dan waktu refund setelah disetujui, biaya pengembalian, bea/pajak impor, serta alamat dan kontak pengembalian. Hindari menyajikan batas kebijakan toko seolah-olah menghapus hak komplain melalui PayPal. |
| Returns | Form meminta pengajuan dalam 7 hari dan foto bila rusak/berbeda signifikan. | Tautkan dengan prosedur Shipping & Returns dan terangkan bahwa pengajuan ke toko dan sengketa pembayaran di PayPal adalah proses berbeda. |
| FAQ | Membahas batu, pengiriman global, keunikan, dan perawatan; tidak membahas metode pembayaran atau bantuan checkout. | Tambahkan FAQ pembayaran: PayPal Sandbox hanya untuk uji internal, cara menghubungi toko jika redirect/capture gagal, dan jangan pernah meminta kata sandi pelanggan. |

## Ketentuan PayPal yang ditinjau

- **Sandbox Testing Accounts / Overview:** Sandbox memakai akun virtual terpisah untuk buyer dan business. Kredensial akun uji dikelola dari Developer Dashboard. Sandbox hanya untuk pengujian; data uji harus fiktif/non-live.
- **Orders v2:** pola integrasi memang membuat order di server, mengarahkan pembeli untuk menyetujui, lalu menangkap pembayaran setelah persetujuan. Ini cocok dengan urutan kode yang ditinjau.
- **Developer Testing Agreement dan Sandbox User Agreement:** Sandbox bukan pemrosesan uang sungguhan dan tidak menjanjikan layanan produksi. Jangan gunakan kredensial atau data sensitif pelanggan asli untuk pengujian.
- **User Agreement wilayah C2/Asia Tenggara, Buyer Protection, Seller Protection, Privacy, dan Acceptable Use:** akun, kemampuan menerima pembayaran, biaya, perlindungan, dan aturan bergantung pada wilayah serta jenis transaksi. Untuk barang fisik, Seller Protection terkait bukti pengiriman ke alamat dalam detail transaksi; kode saat ini mengirim alamat yang disediakan dan memeriksa kecocokannya.
- **Alternative Payment Methods Terms wilayah C2:** ketentuan menyebut kategori “precious metals and stones” sebagai kategori terlarang untuk APM. Screenshot juga memperlihatkan opsi bayar dengan kartu tanpa akun PayPal. Belum dapat dipastikan dari screenshot apakah opsi tersebut merupakan APM yang diaktifkan untuk toko ini, atau bagaimana PayPal mengklasifikasikan batu alam yang dijual. Ini **bukan penyebab pesan login saat ini**, tetapi merupakan pertanyaan kelayakan merchant yang perlu dimintakan konfirmasi tertulis ke PayPal sebelum mengaktifkan atau mempromosikan guest/card checkout.

## Rekomendasi berdasarkan prioritas

### P0 — Pulihkan uji Sandbox

1. Buka PayPal Developer Dashboard → **Sandbox → Accounts**.
2. Pilih akun **Personal** untuk berperan sebagai pembeli, bukan akun Business dan bukan login dashboard.
3. Lihat detail akun dan reset kata sandi Sandbox bila perlu. Login ke halaman `sandbox.paypal.com` memakai akun uji tersebut.
4. Pastikan aplikasi API di Coolify memakai `PAYPAL_ENV=sandbox` dan Client ID/Secret dari REST app Sandbox yang berpasangan. Setelah mengubahnya, redeploy API.
5. Gunakan data checkout fiktif untuk menguji persetujuan, redirect kembali, dan status `Paid`; jangan gunakan data pelanggan asli.

### P1 — Siapkan Live secara terpisah

1. Untuk menerima pembayaran pelanggan, set `PAYPAL_ENV=live` dan pasangkan Live Client ID/Secret serta Live Webhook ID pada API produksi.
2. Pastikan webhook Live mengarah ke `https://rendivirgo.com/api/payments/paypal/webhook` dan memuat event capture selesai.
3. Sesudah deploy, pastikan URL persetujuan mengarah ke PayPal Live, bukan `sandbox.paypal.com`; periksa order kecil hanya dengan metode yang telah disepakati dan akun/alat pembayaran yang sah.
4. Jangan mengganti nilai Sandbox menjadi Live di tengah uji yang masih berjalan karena order PayPal yang sudah dibuat melekat pada lingkungan asalnya.

### P1 — Minta konfirmasi kelayakan kategori

Tanyakan ke PayPal secara tertulis apakah penjualan batu alam/cabochon toko ini masuk kategori “precious metals and stones” pada aturan APM, dan apakah opsi pembayaran kartu/guest checkout yang terlihat boleh digunakan untuk merchant serta negara akun ini. Sampai jawabannya jelas, jangan mengandalkan opsi kartu tanpa akun PayPal.

### P2 — Lengkapi informasi pelanggan

Perbarui Terms, Privacy, Shipping & Returns, dan FAQ seperti tabel di atas. Terutama jelaskan data apa yang diteruskan ke PayPal, alur refund/pembatalan, dan bagaimana melaporkan transaksi yang tertahan. Minta tinjauan hukum lokal bila kebijakan akan dipakai sebagai syarat penjualan lintas negara.

## Batas pemeriksaan

- Penilaian penyebab login adalah inferensi dari domain Sandbox pada screenshot dan alur kode; saya tidak melihat jenis akun atau kredensial yang digunakan.
- Nilai environment variable, log Coolify, dan konfigurasi PayPal akun produksi tidak dibaca. Saya tidak mengakses akun atau mencoba transaksi.
- API lokal pada port 4000 tidak berjalan saat pemeriksaan. Kebijakan publik toko tetap dibaca langsung di situs aktif dan isi seed lokal turut dibandingkan.
- Pemeriksaan ini audit statis/read-only, bukan sertifikasi atau jaminan hasil autentikasi PayPal.

## Bukti di repositori

- `api/src/payments/paypal.service.ts:63–96` — pemilihan lingkungan dan autentikasi API server.
- `api/src/payments/paypal.service.ts:130–178` — pembuatan order dan tautan persetujuan beserta alamat pengiriman.
- `api/src/payments/paypal.service.ts:201–212` — verifikasi webhook dan syarat konfigurasi ID.
- `api/src/payments/payments.service.ts:302–366` — pemeriksaan order dan pembuatan sesi PayPal.
- `api/src/payments/payments.service.ts:378–465` — capture dan validasi pembayaran.
- `components/checkout-view.tsx:179–205, 211–285, 447–461` — redirect, return/capture, status gagal, dan penyimpanan order sebelum redirect.
- `DEPLOY-COOLIFY.md:72–76, 94–107` — konfigurasi produksi, pengujian Sandbox, dan reservasi stok.
- `api/prisma/seed-content.cjs:52–107` — isi FAQ, Shipping & Returns, Privacy Policy, dan Terms & Conditions.

## Sumber PayPal

- [Sandbox testing accounts](https://developer.paypal.com/sandbox-testing/accounts)
- [Sandbox testing overview](https://developer.paypal.com/sandbox-testing/overview/)
- [Orders API integration](https://developer.paypal.com/api/rest/integration/orders-api)
- [Developer Testing Agreement](https://www.paypal.com/us/legalhub/paypal/devtest-agreement?locale.x=en_US)
- [Sandbox User Agreement](https://www.paypal.com/us/legalhub/paypal/xsand-full)
- [PayPal User Agreement — wilayah C2](https://www.paypal.com/c2/legalhub/paypal/useragreement-full?locale.x=en_C2)
- [Seller Protection — wilayah C2](https://www.paypal.com/c2/legalhub/paypal/sellerprotection-sea?locale.x=en_C2)
- [Buyer Protection — wilayah C2](https://www.paypal.com/c2/legalhub/paypal/buyer-protection?locale.x=en_C2)
- [Alternative Payment Methods Terms — wilayah C2](https://www.paypal.com/c2/legalhub/paypal/apm-tnc?locale.x=en_C2)
- [Privacy Policy — wilayah C2](https://www.paypal.com/c2/legalhub/paypal/privacy-full?locale.x=en_C2)
- [Acceptable Use Policy — wilayah C2](https://www.paypal.com/c2/legalhub/paypal/acceptableuse-full?locale.x=en_C2)
- [PayPal Legal Hub — wilayah C2](https://www.paypal.com/c2/legalhub/paypal/home?locale.x=en_C2)
