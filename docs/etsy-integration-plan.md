# Rencana Integrasi Etsy — RENDI VIRGO

**Status:** Rencana awal
**Tanggal:** 22 Oktober 2026
**Tujuan utama:** Saat produk dikelola di RENDI VIRGO, listing Etsy ikut dibuat dan diperbarui secara otomatis.

## Ringkasan

Integrasi akan menggunakan Etsy Open API v3 dari backend NestJS. RENDI VIRGO menjadi sumber utama katalog dan stok. Perubahan produk dikirim ke Etsy sebagai listing draft; listing dapat diterbitkan setelah produk memenuhi data Etsy dan statusnya di RENDI VIRGO diubah menjadi `Published`.

Tahap berikutnya dapat menyinkronkan stok, mengimpor pesanan Etsy ke dashboard RENDI VIRGO, dan mengirim nomor pelacakan kembali ke Etsy jika akses akun mengizinkannya. Pembeli tetap menyelesaikan checkout dan pembayaran di Etsy.

## Kondisi proyek saat ini

- Aplikasi memakai Next.js untuk storefront/admin dan NestJS, PostgreSQL, serta Prisma untuk API dan data.
- Model katalog sudah menyimpan SKU, harga, mata uang, status produk, stok, serta varian. Model pesanan sudah mencatat sumber, status, pembayaran, dan item pesanan.
- Belum ditemukan modul, kredensial, atau pemetaan listing Etsy dalam kode saat ini.
- Etsy menyediakan endpoint untuk membuat listing draft, memperbarui listing dan inventaris, membaca receipt/pesanan, serta mengelola profil pengiriman. Setiap endpoint memiliki scope OAuth yang berbeda.

## Cakupan yang direncanakan

### Tahap 1 — Hubungkan toko dan buat listing otomatis

1. Daftarkan **Seller App** Etsy untuk menghubungkan toko RENDI VIRGO sendiri.
2. Tambahkan alur OAuth 2.0 dengan PKCE dan state yang tervalidasi. OAuth callback harus memakai HTTPS.
3. Tambahkan pengaturan admin untuk menghubungkan/memutus toko dan melihat status koneksi.
4. Saat produk baru disimpan, buat listing Etsy sebagai draft. Simpan `etsyListingId` agar perubahan berikutnya memperbarui listing yang sama, bukan membuat duplikat.
5. Saat produk di RENDI VIRGO diterbitkan, kirim pembaruan listing yang diperlukan dan terbitkan listing Etsy jika semua data Etsy lengkap.
6. Tampilkan status sinkronisasi terakhir dan pesan kesalahan yang bisa ditindaklanjuti.

### Tahap 2 — Sinkronkan katalog dan stok

- Petakan judul, deskripsi, harga, mata uang, SKU, foto, kategori, material, dan varian produk.
- Tambahkan pemetaan untuk atribut khusus Etsy yang belum tersedia di katalog sekarang, seperti taxonomy dan informasi pembuat/masa pembuatan sesuai kebutuhan listing.
- Sinkronkan jumlah stok dan harga tiap varian. Status `Reserved`, `Sold`, atau `Archived` perlu memicu aturan Etsy yang ditentukan, misalnya menonaktifkan listing atau memperbarui jumlahnya menjadi nol.
- Tetapkan RENDI VIRGO sebagai sumber utama stok. Penjualan di kanal lain memperbarui stok pusat, lalu perubahan itu dikirim ke Etsy.

### Tahap 3 — Impor pesanan Etsy

- Ambil receipt Etsy dan itemnya, lalu tampilkan sebagai pesanan di admin RENDI VIRGO.
- Simpan Etsy receipt ID dan transaction ID sebagai identitas eksternal unik. Pemrosesan ulang event tidak boleh membuat pesanan atau pengurangan stok ganda.
- Petakan status pembayaran dan pemenuhan Etsy ke status internal tanpa mengubah pencatatan pembayaran asli Etsy.
- Tambahkan sumber pesanan Etsy ke model/dashboard jika diperlukan agar laporan dapat membedakan penjualan website, POS, wholesale, dan Etsy.
- Gunakan webhook Etsy untuk event pesanan yang tersedia, lalu sediakan sinkronisasi berkala sebagai pemulihan jika notifikasi terlewat.

### Tahap 4 — Pengiriman dan fitur tambahan

- Baca profil pengiriman Etsy dan petakan profil yang dipakai tiap listing. Pengelolaan penuh tarif dan tujuan pengiriman dapat ditambahkan setelah aturan pengiriman RENDI VIRGO disepakati.
- Kirim nomor resi/carrier dari RENDI VIRGO ke receipt Etsy jika endpoint tersedia untuk aplikasi dan wilayah toko.
- Setelah alur inti stabil, pertimbangkan impor ulasan dan data pembayaran untuk laporan.

## Rancangan teknis

- Buat modul backend terpisah, misalnya `EtsyIntegrationModule`, untuk OAuth, klien API, sinkronisasi katalog/stok, webhook, dan pesanan eksternal.
- Jangan panggil Etsy langsung dari browser. Simpan API key, shared secret, dan token di backend; token harus dienkripsi saat disimpan dan tidak dikirim ke frontend.
- Simpan pemetaan produk lokal ke listing Etsy, status sinkronisasi, waktu sinkronisasi terakhir, dan error terakhir.
- Jalankan panggilan Etsy sebagai pekerjaan latar belakang yang dapat dicoba ulang. Simpan pekerjaan sinkronisasi secara durable agar kegagalan jaringan tidak menghilangkan perubahan produk.
- Gunakan operasi idempoten: buat listing satu kali, lalu gunakan ID listing Etsy untuk semua pembaruan. Terapkan deduplikasi yang sama untuk receipt dan webhook.
- Minta OAuth scopes seminimal mungkin sesuai tahap. Tahap awal perlu `listings_w`; impor pesanan memerlukan `transactions_r`; pembaruan pengiriman memerlukan `transactions_w`; profil toko/pengiriman memerlukan scope toko yang relevan.
- Tangani batas API, respons `429`, token kedaluwarsa, retry dengan jeda bertahap, dan pencatatan audit.

## Pemetaan data awal

| RENDI VIRGO | Etsy | Catatan |
|---|---|---|
| Product ID | Pemetaan internal | Simpan bersama Etsy listing ID; jangan mengandalkan nama produk sebagai kunci. |
| SKU produk/varian | Inventory product SKU | SKU membantu mencocokkan inventaris dan varian. |
| Nama dan deskripsi | Listing title dan description | Perlu validasi batas dan format Etsy. |
| Harga dan mata uang | Listing/inventory offering | Konversi format nilai uang sesuai schema Etsy. |
| Foto produk | Listing images | Perlu unggah/tautkan gambar melalui endpoint Etsy yang sesuai. |
| Varian dan stok | Inventory products/offerings | SKU, harga, dan kuantitas dapat berbeda per varian. |
| Status produk | Status listing Etsy | Aturan draft/aktif/nonaktif perlu konsisten. |
| Etsy receipt | Order dan item internal | Simpan ID eksternal untuk mencegah duplikasi. |

## Batasan dan risiko yang perlu diperhitungkan

- **Izin aplikasi:** Seller App ditujukan untuk pemilik toko yang menghubungkan aplikasinya ke tokonya sendiri. Penggunaan untuk banyak penjual membutuhkan jalur akses aplikasi dan persetujuan Etsy yang berbeda.
- **Data alamat:** Etsy menyatakan akses ke sebagian kolom alamat pada receipt dapat bergantung pada status preferred partner di wilayah tertentu. Impor pesanan perlu diuji dengan toko dan wilayah target sebelum dijadikan dasar pemenuhan otomatis.
- **Kirim resi:** Endpoint pengiriman tracking dibatasi di wilayah tertentu untuk aplikasi yang disetujui sebagai fulfillment partner. Siapkan proses manual di Etsy jika akses ditolak.
- **Validasi listing:** Etsy membutuhkan atribut dan aturan katalog marketplace yang tidak seluruhnya sama dengan katalog website. Produk yang belum memenuhi atribut wajib harus tetap sebagai draft dan menampilkan kekurangannya.
- **Stok multi-kanal:** Sinkronisasi tertunda atau order ganda dapat menyebabkan overselling. Pembaruan stok dan impor order harus idempoten dan memiliki rekonsiliasi berkala.
- **Checkout/payout:** Integrasi mencatat data transaksi untuk operasional dan laporan; pembayaran pembeli serta payout tetap dikelola Etsy.

## Kriteria penerimaan

1. Menyimpan produk baru yang memenuhi aturan sinkronisasi membuat satu listing draft Etsy dan menyimpan ID listingnya di RENDI VIRGO.
2. Menyunting produk yang sudah terhubung memperbarui listing Etsy yang sama tanpa duplikasi.
3. Menerbitkan produk di RENDI VIRGO hanya menerbitkan listing Etsy setelah validasi field wajib berhasil.
4. Perubahan kuantitas stok dan varian tercermin di kedua kanal sesuai aturan sumber stok yang ditetapkan.
5. Receipt Etsy yang diterima berulang kali tetap menghasilkan satu pesanan internal dan satu kali efek stok.
6. Kegagalan Etsy terlihat di admin, dapat dicoba ulang, dan tidak menghapus perubahan produk lokal.
7. Token dan rahasia Etsy tidak tersedia pada respons frontend atau log aplikasi.

## Keputusan sebelum implementasi

- Pastikan toko Etsy target dan akun pemiliknya.
- Daftarkan Seller App Etsy dan siapkan callback HTTPS untuk OAuth.
- Konfirmasi perilaku penerbitan: rekomendasi awal adalah produk baru menjadi draft Etsy, lalu diterbitkan saat status RENDI VIRGO menjadi `Published`.
- Konfirmasi apakah stok RENDI VIRGO menjadi sumber utama untuk semua kanal penjualan.
- Uji apakah data alamat pesanan dan endpoint pengiriman tersedia untuk toko/wilayah tersebut.

## Referensi resmi

- [Etsy Open API v3 Reference](https://developers.etsy.com/documentation/reference/)
- [Etsy API Authentication](https://developer.etsy.com/documentation/essentials/authentication/)
- [Etsy Webhooks](https://developer.etsy.com/documentation/essentials/webhooks/)
- [Listings Tutorial](https://developer.etsy.com/documentation/tutorials/listings/)
- [Shop Management Tutorial](https://developer.etsy.com/documentation/tutorials/shopmanagement/)
- [Fulfillment Tutorial](https://developer.etsy.com/documentation/tutorials/fulfillment/)
- [Etsy API Access Levels](https://developer.etsy.com/documentation/)
