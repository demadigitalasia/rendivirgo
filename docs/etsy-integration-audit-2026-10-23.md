# Audit Integrasi Etsy — 23 Oktober 2026

## Ringkasan audit baseline

Integrasi Etsy sudah mencapai tahap **OAuth dan pembacaan profil toko**, tetapi belum terbukti melakukan **sinkronisasi listing end-to-end**. Etsy terlihat `Connected` pada tangkapan layar pengguna; log produksi juga menunjukkan proses OAuth berhasil diarahkan kembali, lalu permintaan status, daftar kandidat, dan profil toko menerima HTTP 200. Namun, belum ada bukti listing Etsy dibuat atau diperbarui.

Pada saat audit baseline, switch Etsy yang terlihat ada di workspace lokal, tetapi kode tersebut dan migrasi database terkait belum di-commit. Coolify menjalankan commit `935f12b` (`fix: send OAuth token during Etsy shop lookup`), sehingga fitur sales channel yang baru belum ada di produksi. Status API lokal juga menunjukkan belum ada konfigurasi/koneksi Etsy dan semua antrean berjumlah nol.

**Kesimpulan:** belum aman menganggap produk web otomatis terjual di Etsy. Lengkapi rilis dan defaults, uji satu listing Draft, lalu siapkan sinkronisasi stok/pesanan sebelum mengaktifkan listing Published secara luas.

## Batas audit

Audit baseline dilakukan dengan membaca kode, status API lokal, riwayat deploy/log Coolify, konfigurasi persistent storage, tangkapan layar yang diberikan, dan dokumentasi resmi Etsy. Pada audit baseline tidak ada listing Etsy yang dibuat, diubah, diaktifkan, atau dinonaktifkan; tidak ada perubahan Coolify, deploy, commit, maupun push. Dashboard admin produksi meminta login, jadi status live belum dapat dibaca ulang dari dashboard.

## Hasil bertahap

| Tahap | Temuan | Status |
|---|---|---|
| Aplikasi Etsy & OAuth | Tangkapan layar menunjukkan shop `Connected`. Log produksi 22 Oktober mencatat `POST /connect 201`, callback OAuth `302`, lalu GET status, sync candidates, dan shop profiles semuanya `200`. Profil pengiriman dan readiness berhasil dibaca. | **Terbukti untuk koneksi dan baca profil** pada waktu tersebut. Callback 302 sendiri bukan bukti cukup; status Connected pada screenshot dan GET profil 200 melengkapinya. |
| Konfigurasi listing | Tangkapan layar Settings menunjukkan listing defaults belum lengkap: taxonomy, shipping profile, return policy, readiness state, who made, when made, dan is supply. Daftar profil tidak mengembalikan return policy. | **Belum siap membuat listing.** Kode saat ini mensyaratkan ketujuh nilai tersebut, termasuk return policy. |
| Switch produk | Di localhost, checkbox Etsy tampil tetapi nonaktif karena API lokal menjawab `configured:false`, `connected:false`, konfigurasi koneksi kosong, tujuh defaults kosong, dan antrean `Pending/Processing/Synced/Failed` semuanya 0. Pesan di halaman menyuruh menghubungkan Etsy di Settings. | **Belum bisa diuji di lokal** dengan konfigurasi saat ini. Tidak ada produk yang diubah selama audit. |
| Produksi versus workspace | Coolify menunjukkan service API `Running` dan deploy terakhir memakai commit `935f12b`. Implementasi sales channel produk, perubahan schema, dan migrasi `20261023090000_product_etsy_sales_channel` masih berupa perubahan lokal yang belum di-commit. | **Fitur switch/auto-queue belum terpasang di produksi.** Jangan menyamakan UI lokal dengan perilaku live. |
| Worker & listing | Kode membuat antrean sinkronisasi dan worker API memeriksanya berkala. Pembuatan listing memakai reservasi lokal untuk mengurangi risiko listing ganda bila respons Etsy hilang, lalu memperbarui konten, foto, inventory, dan state. Log produksi yang tersedia belum menunjukkan request sync produk atau listing ID. | **Alur ada di kode, belum terbukti ke Etsy.** Belum ada hasil sukses listing yang bisa direkonsiliasi. |
| Foto produk | Worker mengunggah foto dari direktori API lokal. Coolify memiliki persistent volume di `/app/uploads`, sesuai jalur upload default aplikasi. | **Prasyarat storage terlihat terpenuhi.** Audit belum mengirim foto ke Etsy atau memastikan berkas tertentu tersedia. |
| Stok dan pesanan | Update produk dan sebagian aksi bulk mengantrekan sync. Alur order website mengurangi stok/menandai barang unik terjual, tetapi tidak memanggil antrean Etsy. UI Settings juga menyebut impor pesanan Etsy dan perubahan stok berbasis pesanan belum termasuk. | **Risiko tinggi overselling.** Penjualan Etsy tidak mengurangi stok website; penjualan web/POS/wholesale juga tidak memperbarui inventory Etsy melalui alur order saat ini. |

## Risiko yang perlu ditangani

1. **Rilis lokal dan produksi berbeda (penghambat utama).** Pengguna melihat switch pada localhost, sementara produksi masih menjalankan commit sebelumnya. Migrasi dan field `sellInEtsy` belum ada di commit aktif produksi.
2. **Defaults listing belum lengkap.** Shop profile API tidak mengembalikan return policy pada tangkapan layar. Etsy API Reference menyebut `return_policy_id` wajib untuk listing fisik aktif kecuali shop berbasis EU; aplikasi ini saat ini tetap mensyaratkannya untuk semua shop. Selain itu, satu `ETSY_DEFAULT_TAXONOMY_ID` dan beberapa metadata listing dipakai sebagai nilai global; itu mudah salah untuk produk dengan kategori atau keterangan asal/pembuatan yang berbeda.
3. **Belum ada sinkronisasi pesanan/stok lintas kanal.** Listing aktif bisa tetap tersedia di Etsy setelah barang habis/terjual di web, atau stok website tetap tinggi setelah penjualan di Etsy.
4. **Keterikatan listing ke shop belum tersimpan di mapping.** Mapping menyimpan ID listing tetapi tidak menyimpan shop ID. Kode mencegah requeue saat reconnect ke shop berbeda, tetapi perubahan produk berikutnya dapat mencoba menggunakan ID lama dengan koneksi baru. Sebelum mendukung pergantian shop, mapping perlu menyimpan `shopId` dan menolak sinkronisasi jika tidak cocok.
5. **Kesiapan API processing profile belum boleh diasumsikan.** Etsy Listings Tutorial saat ini mensyaratkan shipping profile dan readiness state untuk listing fisik, sementara halaman migrasi processing profile masih menyebut masa transisi, penggunaan `legacy=false`, dan larangan menguji pada toko live sampai go-live resmi. Etsy Help terbaru menjelaskan pengelolaan processing profile di Shop Manager. Karena dokumen API itu tidak konsisten satu sama lain, jangan menekan “Create processing profile” atau melakukan listing write live sebelum memastikan model API yang aktif untuk aplikasi/toko ini.

## Rekomendasi tindakan berurutan

1. **Satukan rilis terlebih dahulu.** Review dan commit hanya perubahan Etsy yang dimaksud—termasuk schema/migrasi dan switch produk—lalu push/deploy melalui Coolify. Pastikan migrasi produksi benar-benar selesai dan verifikasi halaman admin live, bukan hanya localhost. Jangan masukkan file lokal lain yang tidak terkait.
2. **Lengkapi tujuh listing defaults di environment API Coolify.** Cocokkan taxonomy untuk produk uji, shipping profile dengan kebijakan kirim toko, readiness profile dengan waktu proses aktual, dan metadata `who_made`/`when_made`/`is_supply` dengan fakta produk. Karena panel saat ini tidak menemukan return policy, periksa pengaturan kebijakan Etsy. Bila shop termasuk pengecualian Etsy, sesuaikan aplikasi agar mengikuti aturan API alih-alih mengisi ID yang tidak tersedia. Setelah perubahan env, restart API dan pastikan panel menyatakan defaults lengkap.
3. **Konfirmasi perilaku processing profiles ke Etsy atau uji memakai developer/test shop.** Jangan buat profil baru di shop live hanya untuk melewati blocker. Pilih profil yang sudah ada jika sesuai, lalu pastikan request listing yang dipakai cocok dengan versi API/ketentuan migrasi Etsy yang berlaku.
4. **Lakukan satu uji listing Draft.** Setelah rilis dan konfigurasi siap, pilih produk `Draft`, tanpa variants, dengan satu foto yang tersimpan di API, harga dalam mata uang shop, judul sesuai aturan Etsy, dan taxonomy yang benar. Antrekan satu produk saja. Cocokkan status sync, URL/ID listing, foto, harga, SKU, kuantitas, shipping, return policy, dan readiness di Etsy. Pastikan listing tetap inactive/Draft.
5. **Aktifkan listing hanya setelah pemeriksaan manual.** Kode dapat mengaktifkan listing ketika produk lokal berstatus Published dan stoknya lebih dari nol. Jangan mengaktifkan produk Published sebagai uji pertama.
6. **Sebelum memakai Etsy sebagai sales channel sungguhan, buat sinkronisasi inventory/order.** Prioritaskan Etsy order import/webhook, deduplikasi event, reservasi stok lintas kanal, sinkronisasi perubahan web/POS/wholesale, serta proses refund/cancel/restock. Uji kondisi dua kanal menjual unit terakhir sebelum menambah banyak listing aktif.
7. **Tambahkan shop binding pada listing mapping.** Simpan shop ID di setiap mapping, blokir reconnect ke shop berbeda tanpa proses remap, dan sediakan rekonsiliasi untuk listing yang state-nya ambigu.

## Kriteria selesai untuk uji pertama

- Produksi menjalankan commit yang berisi sales channel Etsy dan migrasinya.
- API Settings menunjukkan connected, konfigurasi koneksi lengkap, serta listing defaults lengkap.
- Satu produk Draft menghasilkan satu listing Etsy Draft, tanpa duplikasi, dengan foto/konten/harga/stock dan shipping yang sesuai.
- Perubahan data produk menghasilkan status antrean yang dapat dilihat; kegagalan menampilkan pesan yang dapat ditindaklanjuti.
- Tidak ada listing Published sampai pengguna memeriksa draft.

## Sumber Etsy

- [Listings Tutorial — Etsy Open API v3](https://developers.etsy.com/documentation/tutorials/listings/)
- [Processing Profiles Migration — Etsy Open API v3](https://developers.etsy.com/documentation/tutorials/migration/)
- [How to Set Processing Times and Processing Profiles — Etsy Help](https://help.etsy.com/hc/en-us/articles/115015588087-How-to-Set-Processing-Times-Processing-Profiles-and-Ship-By-Dates)
- [Etsy Open API Reference](https://developers.etsy.com/documentation/reference/)

## Referensi kode yang diaudit

- [Status, defaults, profil toko, dan pembuatan profil](</Users/drefan/Projects/RENDI VIRGO/api/src/etsy/etsy-integration.service.ts:285>)
- [Validasi produk, pembuatan listing, upload foto, dan inventory](</Users/drefan/Projects/RENDI VIRGO/api/src/etsy/etsy-integration.service.ts:960>)
- [Update produk dan antrean Etsy](</Users/drefan/Projects/RENDI VIRGO/api/src/catalog/products.service.ts:613>)
- [Reservasi stok order website](</Users/drefan/Projects/RENDI VIRGO/api/src/orders/order-lifecycle.service.ts:147>)
- [Switch Etsy di form produk](</Users/drefan/Projects/RENDI VIRGO/components/admin/product-form.tsx:568>)

## Tindak lanjut setelah persetujuan rekomendasi

Perubahan berikut sudah dibuat di workspace untuk menutup risiko sinkronisasi stok keluar dan salah tujuan toko:

- Reservasi checkout, pembatalan/masa bayar habis, pembayaran barang unik, restock retur, reservasi POS, penyelesaian penjualan POS, dan pelepasan hold POS kini mengantrekan sinkronisasi produk Etsy di transaksi database yang sama dengan perubahan stok.
- Setiap `EtsyListingMapping` mendapat `shopId` dan waktu percobaan POST listing. Listing baru menyimpan ID toko dan waktu percobaan. Mapping lama tanpa `shopId` harus diverifikasi lewat data Etsy sebelum dipasangkan; jika toko tidak cocok, worker gagal dengan pesan rekonsiliasi dan tidak menulis ke toko itu.
- OAuth menolak penggantian toko jika sudah ada mapping yang terikat ke toko lain. Reservasi listing baru dan penggantian koneksi memakai lock database agar tidak saling berlomba.
- Jika respons pembuatan draft hilang setelah Etsy mungkin sudah membuat listing, Settings menyediakan rekonsiliasi setelah job berstatus Failed. Admin memasukkan listing ID; API memeriksa toko terhubung, status draft/nonaktif, waktu pembuatan dalam rentang percobaan POST (dua menit toleransi sebelum, maksimum 15 menit sesudah), lalu SKU atau judul produk. SKU Etsy yang terisi tetapi berbeda akan selalu ditolak. Jika Etsy tidak memberi timestamp, mapping lama tidak menyimpan waktu percobaan, atau identitas tidak cocok, mapping tidak berubah. Produk harus tetap Draft, dan ID yang sudah dipakai produk lain ditolak.
- Migrasi menambahkan `sellInEtsy` dan `shopId` secara kompatibel. ID toko mapping lama dibiarkan belum terverifikasi sampai dibaca kembali dari Etsy, bukan ditebak dari koneksi saat migrasi.

Verifikasi workspace: `npm run prisma:generate`, `npx prisma validate --schema prisma/schema.prisma`, API `npm run typecheck`, API `npm test` (**35 lulus**), API `npm run build`, root `npm run lint`, dan root `npm run build` berhasil. Pemeriksaan ini tidak membuat atau mengubah listing Etsy.

### Verifikasi rilis produksi

- Commit fitur `2d6af5d2695f2e05956bdc7027513759302d0725` sudah di-push ke `origin/main`.
- Service `rendivirgo-api` dan `rendivirgo-web` di Coolify sama-sama berhasil dideploy dari commit tersebut dan berstatus Running.
- Log startup API mengonfirmasi migrasi `20261023090000_product_etsy_sales_channel` berhasil diterapkan; Prisma melaporkan semua migrasi berhasil.
- `https://rendivirgo.com/api/health` mengembalikan `status: ok`, `database: up`, dan `uploads: up`.
- Audit/deploy ini tidak membuat, mengubah, menerbitkan, atau menonaktifkan listing Etsy.

### Yang masih belum selesai untuk pemakaian Etsy sebagai kanal penjualan live

1. Tujuh listing default di API Coolify masih perlu nilai yang benar untuk shop dan produk uji. Jangan mengarang taxonomy, return policy, readiness, atau metadata asal/pembuatan.
2. Uji satu listing Draft di toko uji/lingkungan yang Etsy izinkan masih perlu dilakukan setelah konfigurasi lengkap; belum ada listing Etsy yang dibuat atau diterbitkan oleh audit ini.
3. OAuth saat ini hanya meminta `listings_r`, `listings_w`, `shops_r`, dan `shops_w`. Impor receipt/pesanan Etsy serta pengurangan stok lokal dari pembelian Etsy belum dibuat; untuk itu dibutuhkan `transactions_r`, persetujuan scope pada Etsy, deduplikasi receipt, dan rekonsiliasi pesanan. Karena itu penjualan Etsy masih belum tercermin ke stok RENDI VIRGO secara otomatis.
4. Sinkronisasi stok lokal tetap tertunda sampai worker mengirim perubahan ke Etsy. Tanpa impor receipt Etsy, jeda ini belum aman untuk menjamin pencegahan overselling saat dua kanal aktif.
5. Produk dengan varian tetap ditolak untuk sinkronisasi Etsy. Pemetaan SKU/harga/stok tiap variasi perlu dibuat sebelum listing bervarian dipakai.
6. Jika Etsy tidak mengembalikan waktu pembuatan atau listing yang mungkin berhasil tidak bisa ditemukan dengan ID, SKU, atau judul saat ini, rekonsiliasi tetap memerlukan investigasi operasional. Sistem sengaja tidak menghapus reservasi atau mengulang POST secara otomatis dalam kondisi ambigu agar tidak membuat listing duplikat.

Endpoint pembacaan listing yang dipakai untuk verifikasi mapping lama adalah `GET /v3/application/listings/{listing_id}`; respons Etsy memuat `shop_id`. Lihat [Etsy Open API Reference](https://developers.etsy.com/documentation/reference/).

### Status rilis

Rilis fitur tercatat pada commit `2d6af5d` dan sudah sukses di-deploy ke API serta website. Migrasi database dan health API produksi sudah terverifikasi. Rilis ini menyiapkan kanal Etsy dan antrean listing Draft, tetapi belum membuktikan pengiriman listing karena defaults Etsy belum lengkap dan belum ada produk uji yang dikirim.
