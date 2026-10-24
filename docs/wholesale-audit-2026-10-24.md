# Audit dua jalur wholesale — 24 Oktober 2026

## Lingkup dan metode

Audit implementasi lokal saat ini, termasuk perubahan belum di-commit dan file baru, dengan HEAD sebagai referensi. Skill code-review digunakan untuk menilai kesesuaian kebutuhan dan kualitas implementasi; dua reviewer independen memeriksa rough dan finished. Tidak mengubah kode aplikasi, membuat pesanan, mengirim pesan, atau melakukan deployment.

Pemeriksaan: penelusuran UI lokal, review frontend/API/model/admin, 19 tes terarah, dan HTTP tanpa cookie. Temuan berbasis sumber dibedakan dari perilaku yang diamati langsung. Audit ini bukan pengujian penetrasi penuh atau sertifikasi keamanan produksi.

## Alur aktual

### Finished Products

`/wholesale` → `/wholesale/finished` → login/registrasi → verifikasi email → formulir pengajuan → Pending → admin menyetujui → katalog harga privat → keranjang wholesale → quote server → checkout → pembayaran/pemenuhan.

Minimum finished memakai aturan tersendiri: nilai barang minimum ATAU jumlah pieces minimum. Default kode USD300 atau100pieces, dapat diubah admin. Minimum rough2ton tidak berlaku pada finished.

### Rough Materials

`/wholesale` → `/wholesale/rough` → pilih1–2entri bahan → masukkan beratkg → total gabungan minimal2.000kg → server memeriksa harga/status/stok → ringkasan → buka WhatsApp/email → pelanggan mengirim permintaan → tim mengonfirmasi harga akhir, berat, ketersediaan, ongkir dan pembayaran secara manual.

Tidak ada login, checkout, order sistem, reservasi stok, atau pengiriman pesan otomatis. Klik kanal kontak hanya membuka aplikasi pesan. Satu entri admin diperlakukan sebagai satu jenis bahan.

## Hasil verifikasi langsung

- Hub menampilkan kedua kartu dan ketentuan rough dengan benar.
- Rough saat audit masih kosong; menampilkan kondisi persiapan katalog dan kontak alternatif, bukan data harga buatan.
- Tanpa cookie: GET `/api/rough-materials`200 dengan0items; GET `/api/wholesale/catalog`401; GET `/api/admin/rough-materials`401.
-19tes lulus:13API untuk aplikasi wholesale, perhitungan/DTO rough;6frontend untuk kalkulator dan locale.
- Browser memakai sesi customer yang sudah tersedia; hasil guest berasal dari HTTP tanpa cookie, bukan asumsi sesi browser.

## Temuan implementasi

### F1 — Prioritas tinggi: varian dapat dihilangkan dari permintaan checkout

Sumber: `api/src/orders/orders.service.ts:626–642`, pemeriksaan stok `:677`; parent stock disimpan di `api/src/catalog/products.service.ts:443` dan`:667`.

Jika produk Quantity memiliki varian, request tanpa variantId tidak ditolak. Server memakai harga wholesale, SKU, berat dan stok parent. Skenario: parentstock>0 dan harga parentUSD1, sedangkan varianUSD5/10; request hanya productId dapat memakai harga parent. Ini kelemahan yang terlihat dari kode, belum direproduksi dengan order nyata. Berlaku pada fondasi checkout bersama, bukan hanya rough.

Rekomendasi: wajibkan variantId valid ketika produk mempunyai varian; tambah tes quote/order yang menolak varian kosong dan memastikan stok/harga varian digunakan. Perbaiki sebelum peluncuran penjualan produk bervarian.

### F2 — Prioritas menengah: tujuan wholesale hilang setelah registrasi

Sumber: `components/wholesale-store.tsx:507`, `components/customer-account.tsx:155`,`:205`,`:297`.

Login mempertahankan tujuan finished, tetapi tautan Create Account dan jalur verifikasi tidak mempertahankannya hingga login berikutnya. Pembeli baru dapat berakhir di dashboard akun dan harus mencari wholesale lagi.

Rekomendasi: simpan intent/return path internal yang tervalidasi sepanjang registrasi/verifikasi/login; arahkan kembali ke pengajuan finished. Tampilkan status pengajuan di dashboard sebelum akses disetujui. Hindari menerima redirect eksternal.

### F3 — Prioritas menengah: estimasi rough kedaluwarsa tampak terus memuat

Sumber: `components/rough-materials-catalog.tsx:46`,`:60–79`,`:108–109`; expiry server `api/src/rough-materials/rough-materials.service.ts:52`.

Setelah5menit, timer menonaktifkan currentQuote dan kanal kontak. Namun expiry tidak memicu fetch baru; UI mengatakan Checking current prices meskipun tidak ada permintaan berjalan. Refresh manual/refocus memulihkannya. Kesimpulan dari kode, tidak menunggu expiry dalam browser pada audit ini.

Rekomendasi: refresh otomatis saat kedaluwarsa, atau tampilkan Estimate expired—refresh prices secara jelas. Pertahankan pilihan dan tampilkan status loading terpisah dari expired.

### F4 — Prioritas menengah: sorting harga finished tidak sesuai harga varian

Sumber: `api/src/orders/orders.service.ts:455–456`, `components/wholesale-store.tsx:145–150`.

Sort memakai wholesalePrice parent, sedangkan kartu dapat menampilkan override varian. ParentAUSD1/varianUSD50 dapat mendahului parentBUSD10/varianUSD10 pada urutan termurah.

Rekomendasi: tetapkan effective from-price dan gunakan konsisten pada kartu, filter dan sorting sebelum pagination.

### F5 — Prioritas menengah, bergantung konfigurasi: format WhatsApp terlalu longgar

Sumber: `api/src/rough-materials/rough-materials.service.ts:49–52`.

Setiap8–15digit diterima setelah karakter lain dibuang. Nomor domestik08… dapat lolos dan menghasilkan wa.me yang tidak sesuai format internasional; primary seperti ini juga menghalangi fallback secondary. Audit tidak membuktikan nomor produksi salah.

Rekomendasi: validasi format internasional di Settings dan pembuat link; beri contoh62… untuk Indonesia. Tolak nomor yang diawali0 dan tampilkan kesalahan konfigurasi sebelum publikasi.

### F6 — Prioritas rendah: navigasi finished tidak ikut memperbarui persetujuan

Sumber: `components/wholesale-navigation.tsx:29–42`.

Efek mengambil akses hanya ketika status lokasi inFinishedWorkspace berubah. Persetujuan saat halaman tetap terbuka dapat membuka katalog tanpa workspace navigation sampai refresh. Status true juga tidak di-reset saat respons akses berikutnya ditolak. API tetap memeriksa akses; ini masalah UI, bukan bukti bypass keamanan.

Rekomendasi: gunakan state profil/akses bersama dan sinkronkan sesudah approval, logout, revocation, serta refocus.

## Kesesuaian spesifikasi dan risiko data

- Rough memenuhi aturan gabungan2ton dan maksimal2entri; server menolak duplikasiID, draft, unavailable, overstock, berat negatif/precision salah, dan manipulasi harga client.
- Finished memeriksa sesi, verifikasi email dan akses terbaru di database. Harga wholesale tidak diserialisasi pada response produk publik yang ditinjau.
- Pengajuan menyimpan Pending, mendukung penolakan/alasan/pengajuan ulang, revision check dan antrean email keputusan.
- Finished saat ini mengambil semua Published+sellInWholesale. Belum ada pembatas klasifikasi Finished/Rough pada model Product (`orders.service.ts:391–395`,`:622`). Produk rough lama dapat tetap muncul jika flag wholesale aktif. Ini risiko konfigurasi, bukan bukti produk bermasalah sedang dijual. Tentukan apakah rough eceran kecil tetap boleh dijual online; pisahkan bulk rough secara eksplisit tanpa mengubah harga/kg otomatis.
- Maksimal2jenis berarti2entri database, bukan2nilai stoneType. Jika kelak ada grade/varian bahan yang sama, perlukan identitas jenis bahan yang konsisten.

## Rekomendasi pengalaman dan operasional

1. Simpan draft pilihan rough dan tujuan secara lokal; revalidasi harga/stok sebelum kontak.
2. Tambahkan aksi Use2tons atau preset berat, terutama untuk satu bahan. Jangan mengubah minimum menjadi2ton per bahan.
3. Tampilkan timestamp dan pemberitahuan ketika harga server berubah dari harga katalog.
4. Berikan warning admin jika total ketersediaan dua bahan terbesar masih kurang dari2.000kg; pelanggan saat itu tidak punya kombinasi yang memenuhi MOQ.
5. Pertimbangkan nomor referensi dan unduh/salin ringkasan inquiry untuk pencocokan manual, tanpa menambah checkout.
6. Untuk katalog besar, pagination/filter server dan optimasi foto; saat ini seluruh rough dimuat sekaligus.
7. Lengkapi tes integrasi: akses setelah revocation, varian kosong, registrasi kembali ke wholesale, expired quote, kontak invalid, perubahan harga/draft saat pelanggan memilih, upload/save admin, dan keyboard/mobile. Belum semua skenario ini tercakup19tes yang ada.

## Urutan tindak lanjut

- Tahap1: F1, klasifikasi inventori finished/bulk rough, validasi kontak.
- Tahap2: F2–F4 dan sinkronisasi statusF6.
- Tahap3: ketahanan draft, panduan berat, notifikasi perubahan harga dan referensi inquiry.
- Isi foto/harga/data bahan nyata di admin dan verifikasi kontak sebelum mengumumkan rough siap menerima inquiry.
- Audit lokal ini tidak mengonfirmasi konfigurasi/deployment/migrasi produksi. Laporan pemeriksaan frontend sebelumnya menyebut31error di halaman admin navigasi; belum diperiksa ulang pada audit ini dan perlu diselesaikan/diverifikasi sebelum build rilis.

Kesimpulan: rancangan dua jalur sesuai kebutuhan dan pengaman utama ada di server. Rough belum siap secara konten karena belum ada bahan terbit; finished memerlukan perbaikan validasi varian dan kesinambungan onboarding. Tidak ada klaim bahwa sistem bebas kerentanan berdasarkan audit terbatas ini.
