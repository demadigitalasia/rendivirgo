# Audit ulang end-to-end pembelian RENDI VIRGO

**Tanggal:** 15 Oktober 2026 (WIB)  
**Lingkungan yang diperiksa:** storefront lokal `http://localhost:3001`  
**Metode:** pemeriksaan halaman dengan browser, keranjang/checkout, dan telaah kode frontend serta API.

## Ringkasan

**Hasil: lulus terbatas pada tampilan checkout; transaksi belum terverifikasi end-to-end.** Halaman produk dan keranjang lokal terbuka, keranjang tetap ada saat halaman keranjang dibuka lagi, ongkir berhasil dihitung, dan pilihan PayPal serta transfer bank tampil. Contoh keadaan yang terlihat: Forest River Cabochon, subtotal **USD 148**, ongkir terpilih **USD 25**, total checkout **USD 173**.

Saya berhenti sebelum menekan Place order. Karena itu tidak ada order, reservasi stok, email, transfer, capture PayPal, atau perubahan database pesanan yang dibuat. Penyimpanan order aktual, callback, webhook, verifikasi bukti transfer, email, dan tracking belum bisa dinyatakan lulus.

## Alur dan bukti yang diperiksa

| Tahap | Hasil saat audit ini | Catatan |
|---|---|---|
| Beranda/katalog | Terbuka di localhost:3001 | Memuat produk unggulan dan tautan belanja. |
| Keranjang | 1 item satuan, Forest River Cabochon, USD 148 | Item tetap tampil saat halaman keranjang dibuka pada tab baru di origin yang sama. Ini membuktikan pemulihan penyimpanan lintas pemuatan halaman, bukan transaksi. |
| Alamat | Form checkout tampil; negara awal United States | Nama, email, alamat, dan kota wajib diisi; telepon, negara bagian, kode pos, dan catatan opsional. |
| Ongkir | Berhasil; pilihan terlihat USD 25, USD 50, USD 77 | Checkout awal memilih USD 25 sehingga total yang tampil USD 173. Belum ada alamat lengkap yang dikirim sebagai order. |
| Diskon | Kolom kode dan tombol Apply tersedia | Kode diskon tidak diuji pada audit ulang ini. Backend menghitung ulang diskon dari data produk saat membuat order. |
| Metode pembayaran | PayPal dan International bank transfer tampil | Ini mengonfirmasi kedua metode dinyatakan tersedia oleh konfigurasi API lokal; bukan bukti pembayaran selesai. |
| Place order dan pembayaran | Tidak dijalankan | Sengaja tidak membuat order atau pembayaran. |
| Bukti transfer, email, tracking | Belum diverifikasi melalui order baru | Jalur kode tersedia, tetapi perlu order sandbox/transfer uji yang disetujui untuk membuktikan integrasi menyeluruh. |

## Temuan dan rekomendasi

### P1 — Gerbang PayPal saat membuat order tidak sama dengan pemeriksaan ketersediaan checkout

Checkout publik memeriksa `paypalEnabled` **dan** kelengkapan Client ID/Secret melalui endpoint metode pembayaran. Namun endpoint pembuatan order hanya memeriksa sakelar `paypalEnabled` sebelum mencadangkan stok. Bila sakelar aktif tetapi kredensial tidak tersedia, permintaan API langsung masih bisa membuat order pending dan menahan stok, walaupun tombol PayPal di UI seharusnya tersembunyi.

Riwayat audit lokal/live pada 15 Oktober juga mencatat pengaturan PayPal live pernah aktif sementara endpoint publik melaporkan PayPal tidak tersedia. Status live tidak diperiksa ulang dalam audit ini.

**Rekomendasi:** pakai satu pemeriksaan kesiapan pembayaran di backend sebelum mengurangi stok/membuat order; pastikan PayPal aktif hanya jika sakelar, kredensial, dan lingkungan cocok. Tambahkan batas masa reservasi dan pencatatan pemulihan.  
Sumber: [orders.service.ts](</Users/drefan/Projects/RENDI VIRGO/api/src/orders/orders.service.ts:401>), [payments.service.ts](</Users/drefan/Projects/RENDI VIRGO/api/src/payments/payments.service.ts:75>).

### P1 — Harga multi-mata-uang dapat dijumlahkan sebagai satu mata uang

Field produk menerima kode mata uang bebas hingga delapan karakter, sedangkan storefront memformat semua harga sebagai USD. Saat membuat order, API menjumlahkan seluruh harga dan mengambil mata uang dari produk pertama di keranjang. Jika produk bermata uang berbeda dicampur, angka yang berbeda satuan dapat dijumlahkan lalu dikirim ke PayPal dalam mata uang item pertama.

**Rekomendasi:** karena checkout saat ini menyatakan semua harga USD, batasi mata uang produk dan varian menjadi USD di validasi admin dan API order. Jika toko ingin multi-mata-uang, lakukan konversi dan format per mata uang secara konsisten sebelum mengaktifkannya.  
Sumber: [product.dto.ts](</Users/drefan/Projects/RENDI VIRGO/api/src/catalog/dto/product.dto.ts:144>), [orders.service.ts](</Users/drefan/Projects/RENDI VIRGO/api/src/orders/orders.service.ts:529>), [catalog.ts](</Users/drefan/Projects/RENDI VIRGO/lib/catalog.ts:67>).

### P1 — Zona/nama layanan ongkir perlu disahkan sebelum menerima pesanan internasional

Pada checkout lokal, negara awal adalah United States tetapi daftar yang tampil mencakup “Asia Pacific Standard”, “Asia Pacific Express”, dan “Rest of World Express”. Audit lokal sebelumnya pada hari yang sama menemukan seluruh tarif aktif menggunakan region Worldwide dan kutipan US serta Indonesia sama. Temuan konfigurasi sebelumnya belum dibaca ulang dari database pada audit ulang ini.

**Rekomendasi:** sahkan matriks negara/zona, nama kurir, nominal, estimasi hari, biaya kemasan/asuransi, dan aturan barang rapuh. Jangan menganggap nama opsi sebagai bukti bahwa tarif kurir nyata dan tujuan sudah cocok. Pertimbangkan meminta pembeli memilih negara sebelum menampilkan ongkir final, karena negara default saat ini dapat membuat pembeli melihat harga yang bukan tujuannya.

### P2 — Bukti transfer menghentikan kedaluwarsa reservasi tanpa batas waktu

Order transfer bank tanpa bukti akan kedaluwarsa setelah jendela reservasi. Setelah satu gambar bukti diunggah, filter kedaluwarsa tidak lagi mencakup order itu selama payment status tetap Pending. Bukti palsu atau order yang tidak pernah ditinjau karena itu dapat menahan stok unik tanpa batas.

**Rekomendasi:** tampilkan antrean verifikasi bukti yang jelas untuk admin, tetapkan SLA peninjauan, dan terapkan kebijakan cadangan bila bukti tidak diverifikasi dalam batas waktu. Jangan menandai order sebagai Paid otomatis hanya karena gambar berhasil diunggah.  
Sumber: [payments.service.ts](</Users/drefan/Projects/RENDI VIRGO/api/src/payments/payments.service.ts:526>).

### P2 — Permintaan PayPal baru dapat mengganti referensi pembayaran yang sedang berjalan

Endpoint membuat order PayPal menulis `paymentRef` baru ke order setiap kali dipanggil. Jika ada retry/permintaan berulang, approval lama dapat merujuk ke ID yang tidak lagi tersimpan sebagai referensi aktif; halaman callback mencari order melalui referensi tersebut.

**Rekomendasi:** jadikan pembuatan intent PayPal idempoten per order, gunakan ulang intent pending yang valid atau batalkan intent lama, dan validasi akses ke order dengan token checkout yang aman. Uji retry dan callback ganda di sandbox.  
Sumber: [payments.service.ts](</Users/drefan/Projects/RENDI VIRGO/api/src/payments/payments.service.ts:271>).

### P1 keamanan — Kredensial konfigurasi pernah terlihat di screenshot percakapan

Screenshot `.env` yang dibagikan sebelumnya memperlihatkan nilai session signing secret dan password admin. Saya tidak menyalin nilainya ke laporan.

**Rekomendasi:** ganti secret sesi dan password admin yang terlihat; jika salah satunya pernah dipakai di produksi, rotasi di semua lingkungan terkait. Pastikan file `.env` tidak di-commit dan jangan kirim screenshot yang menampilkan nilai rahasia.

## Rencana validasi sebelum menyebut pembelian “lulus end-to-end”

1. Perbaiki gerbang kesiapan pembayaran di API serta tetapkan satu mata uang toko.
2. Sahkan matriks tarif pengiriman untuk negara sasaran dan cek biaya transfer SWIFT/siapa yang menanggung biaya bank perantara.
3. Dengan persetujuan transaksi uji, buat order sandbox menggunakan produk uji; pastikan harga, diskon, ongkir, stok, dan total di API cocok.
4. Jalankan PayPal approve, cancel, retry, capture, callback, webhook berulang/terlambat, dan kedaluwarsa reservasi.
5. Jalankan transfer bank uji: unggah bukti, tinjau di admin, tandai Paid secara manual, lalu pastikan notifikasi/email, status, invoice, dan tracking.
6. Verifikasi ulang `https://rendivirgo.com` secara read-only sebelum tes live. Catatan lama pada 15 Oktober menunjukkan PayPal live belum aktif; hasil itu bukan pemeriksaan baru hari ini.

## Batas audit

Audit ulang ini menilai checkout **lokal** pada `localhost:3001` serta kode sumber yang ada di workspace. Dalam pemeriksaan browser awal, tidak ada API produksi yang dipanggil ulang, tidak ada order/pembayaran yang dibuat, tidak ada automated test/build yang dijalankan, dan nilai kredensial tidak dibaca. Pemeriksaan kode tindak lanjut dicatat terpisah di bawah. Status produksi harus diperiksa terpisah sebelum deploy atau menerima transaksi live.

## Tindak lanjut setelah persetujuan rekomendasi

Perubahan sumber berikut sudah disiapkan di workspace lokal dan diverifikasi melalui pemeriksaan API, tetapi **belum di-commit, di-push, atau di-deploy**:

- API sekarang menolak pembuatan order PayPal sebelum stok dicadangkan jika sakelar pembayaran mati atau Client ID/Secret tidak diisi. Pemeriksaan credential menggunakan aturan yang sama dengan endpoint metode pembayaran.
- API menolak order dengan produk selain USD atau campuran mata uang; validasi produk juga membatasi harga ke USD. Transfer bank hanya dinyatakan siap bila detail rekening lengkap dan mata uang transfer USD.
- Retry PayPal memakai sesi yang masih menunggu persetujuan, memeriksa jumlah/referensi sebelum menggunakannya kembali, dan memakai compare-and-set saat menyimpan referensi baru agar permintaan bersamaan tidak menimpa sesi aktif.
- Tarif ongkir khusus negara kini mengalahkan tarif `Worldwide`; tarif `Worldwide` hanya dipakai jika belum ada tarif yang cocok untuk negara tersebut. Admin perlu mengisi region dengan kode ISO dua huruf, misalnya `ID`, `SG`, `US`, atau `GB`.
- Validasi tarif terpilih di order juga memastikan tarif aktif dan rentang beratnya mencakup paket.

**Pemeriksaan kode:** `npm run typecheck --prefix api` lulus dan seluruh **35 tes API** lulus, termasuk tes bahwa tarif negara mengalahkan fallback `Worldwide`. Pemeriksaan ini tidak menjalankan transaksi atau deployment.

Hal berikut masih memerlukan tindakan operasional/keputusan pemilik toko sebelum checkout dapat dinyatakan lulus penuh:

- Rotasi session secret dan password admin di Coolify/lingkungan live; file `.env` lokal tidak mengubah konfigurasi produksi. Bila password admin dirotasi, sinkronkan hash admin dan cabut sesi aktif dengan prosedur yang tersedia.
- Tentukan negara tujuan prioritas dan isi tarif layanan per negara berdasarkan penawaran kurir yang berlaku untuk berat dan dimensi paket toko. Tarif `Worldwide` yang sudah ada tetap menjadi cadangan sementara; nilainya belum diverifikasi terhadap penawaran kurir aktual. FedEx Indonesia menyediakan rate sheet 2026 dan meminta penjual memakai rate tool untuk penawaran pengiriman tertentu; harga DHL juga bergantung pada asal/tujuan, berat aktual atau volumetrik, layanan, dan surcharge. Karena itu jangan menyalin tarif contoh sebagai harga final tanpa quote pengiriman toko. Sumber: [Tarif FedEx Indonesia](https://www.fedex.com/id-id/shipping/rates.html), [cara menghitung tarif dan waktu FedEx](https://www.fedex.com/id-id/new-customer/how-to-get-rates-and-transit-times.html), [faktor tarif DHL](https://www.dhl.com/id-en/home/express.html).
- Model tarif sekarang belum menyimpan atau menampilkan estimasi hari sampai. Jika ingin menjanjikan ETA saat checkout, tambahkan rentang hari minimum–maksimum pada data tarif, formulir admin, API kutipan, dan pilihan ongkir checkout; isilah hanya dari estimasi kurir untuk rute dan layanan itu.
- Tetapkan perlakuan biaya bank perantara SWIFT dan siapa yang menanggungnya sebelum menerima transfer internasional.
- Anda memilih peninjauan manual tanpa batas waktu untuk bukti transfer. Order dengan bukti yang menunggu pemeriksaan akan tetap menahan stok sampai admin menyetujui atau menolaknya; pantau antrean tersebut agar barang unik tidak tertahan tanpa disadari. Bukti unggahan tidak otomatis dianggap sebagai pembayaran berhasil.
- Jalankan transaksi sandbox yang disetujui untuk membuktikan alur order, stok, callback, capture, webhook, unggah bukti, email, dan tracking.

## Rekomendasi pengisian tarif

1. Mulai dari negara yang memang paling sering dipesan atau menjadi target penjualan; gunakan kode ISO dua huruf, bukan nama zona bebas. Contoh: Indonesia `ID`, Singapura `SG`, Australia `AU`, Amerika Serikat `US`, dan Inggris `GB`.
2. Untuk setiap negara, buat pilihan layanan dan rentang berat yang tidak tumpang tindih, misalnya layanan ekonomis dan ekspres. Masukkan ongkir kurir, handling, asuransi, biaya fragile/oversized secara terpisah agar rincian harga transparan.
3. Ambil tarif dan estimasi pengiriman dari quote kurir yang memakai alamat asal toko, kode pos tujuan, berat aktual, dimensi paket, layanan, serta biaya tambahan. Simpan tanggal pemeriksaan tarif dan tinjau lagi ketika kurir mengubah rate sheet.
4. Pertahankan `Worldwide` hanya untuk negara yang belum dikonfigurasi, setelah menilai apakah nilai cadangannya cukup menutup biaya. Untuk negara dengan rate khusus, pembeli akan melihat pilihan khusus negara itu tanpa tarif `Worldwide`.

Data seed proyek saat ini memberi contoh harga checkout berikut **sebelum biaya fragile/oversized**: Asia Pacific Standard, 0–500 g, **USD 25** (USD 22 ongkir + USD 3 handling); Asia Pacific Express, 0–1.000 g, **USD 50** (USD 46 + USD 4); Rest of World Standard, 500–3.000 g, **USD 42** (USD 38 + USD 4); dan Rest of World Express, 0–5.000 g, **USD 77** (USD 72 + USD 5). Semua baris contoh itu saat ini ditandai `Worldwide` di data seed, jadi angkanya **bukan tarif per negara dan belum diverifikasi dengan quote kurir**. Rekomendasi saya: gunakan hanya sebagai referensi sementara, lalu isi baris ISO negara dengan harga serta estimasi yang didapat dari quote aktual sebelum mengandalkannya untuk pesanan live.
