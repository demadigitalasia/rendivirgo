# Audit alur checkout PayPal RENDI VIRGO

Tanggal: 16 Oktober 2026  
Lingkup: penelusuran source checkout dan API pembayaran, ditambah dokumentasi resmi PayPal.  
Pemeriksaan audit awal bersifat read-only; tidak membuat transaksi sandbox/live.

## Kesimpulan utama

- **Billing address terpisah tidak diperlukan oleh alur PayPal Wallet standar yang dipakai proyek ini.** Checkout RENDI VIRGO juga tidak memiliki field billing address. Nama dan email tetap diminta sebagai identitas/kontak pesanan.
- **Alamat pengiriman tetap dibutuhkan untuk produk fisik**, karena sistem menghitung pilihan dan biaya kirim berdasarkan negara tujuan dan menyimpan alamat untuk fulfillment. Di proyek ini alamat diminta sebelum pembeli dialihkan ke PayPal.
- Ketidaksesuaian utama: aplikasi meminta dan menyimpan alamat pengiriman, tetapi create-order PayPal mengirim `shipping_preference: "NO_SHIPPING"` dan tidak mengirim alamat itu ke PayPal. PayPal menjelaskan bahwa pilihan tersebut menyembunyikan informasi alamat pengiriman dari halaman review dan respons API, dan ditujukan untuk transaksi tanpa pengiriman fisik.
- Rekomendasi awal: pertahankan alamat pengiriman di checkout toko agar quote saat ini tetap akurat; kirim alamat itu juga ke PayPal dengan `SET_PROVIDED_ADDRESS`, lalu verifikasi alamat transaksi pada detail PayPal. Jika ingin pelanggan memakai alamat wallet PayPal, implementasikan `GET_FROM_FILE` beserta shipping callbacks dan hitung ulang total sebelum persetujuan—jangan sekadar menghapus form.

## Jawaban atas pertanyaan alamat

### Billing address

Form checkout saat ini meminta nama dan email, tetapi **tidak meminta billing address**. Integrasi server membuat order dengan payment source PayPal Wallet, bukan dengan data kartu yang dikumpulkan langsung oleh toko. Skema PayPal Orders v2 mendefinisikan alamat payer (yang dapat berfungsi sebagai alamat billing) sebagai opsional. Jadi, secara umum tidak ada alasan untuk menambahkan billing-address form terpisah untuk metode PayPal ini. Kebutuhan khusus pajak, fraud/risk, atau metode kartu lain dapat mengubah keputusan tersebut.

### Shipping address

PayPal dapat memakai alamat wallet pembeli (`GET_FROM_FILE`), menampilkan alamat yang dipasok merchant dan mengunci perubahan (`SET_PROVIDED_ADDRESS`), atau menyembunyikan alamat (`NO_SHIPPING`). Default API adalah `GET_FROM_FILE`. Karena RENDI VIRGO menjual barang fisik, alamat pengiriman harus tersedia bagi toko dan kurir; alamat itu tidak harus diketik di halaman toko apabila integrasi PayPal mengambilnya dan toko mampu memperbarui quote shipping berdasarkan perubahan alamat.

Di implementasi sekarang, quote shipping dihitung sebelum order dibuat dan sebelum redirect ke PayPal. Maka alamat toko perlu tetap diminta kecuali alur shipping PayPal diubah cukup jauh untuk menangani perubahan alamat dan total.

## Alur yang ditemukan di source

1. Checkout mewajibkan nama, email, baris alamat, dan kota. Telepon, baris alamat kedua, provinsi/state, dan kode pos opsional. Negara memiliki nilai awal `United States`; pilihan negara dikirim sebagai input shipping. Tidak ada field billing.
2. Browser mengirim detail order ke endpoint quote. Negara tujuan ikut menentukan pilihan/rate shipping. Setelah pembeli menyetujui quote, browser membuat order lokal menggunakan quote token.
3. Order lokal dibuat lebih dahulu. Setelah respons sukses, checkout menyimpan ringkasan order lokal, menghapus cart, lalu baru meminta sesi PayPal. Jika create-order PayPal gagal, order lokal tetap `Pending`; alur bergantung pada pemulihan atau percobaan ulang.
4. API memastikan PayPal aktif/terkonfigurasi dan order masih `Pending`, belum terminal, belum kedaluwarsa, lalu membuat order PayPal dengan `intent: CAPTURE`. Payload PayPal memuat reference order dan jumlah total; payload tidak memuat alamat, item, atau rincian breakdown ongkir.
5. Browser dialihkan ke approval PayPal. Pada callback sukses, browser mengirim token PayPal ke backend untuk retrieve/capture. Backend memeriksa jumlah dan mata uang terhadap order lokal, lalu memanggil lifecycle settlement. Webhook capture completed juga memiliki jalur settlement.

Bukti kode: [checkout form dan payload order](../components/checkout-view.tsx#L548), [urutan simpan order, kosongkan cart, lalu mulai PayPal](../components/checkout-view.tsx#L367), [DTO alamat order](../api/src/orders/dto/order.dto.ts#L22), [pembuatan order PayPal](../api/src/payments/paypal.service.ts#L108), [validasi dan create sesi PayPal](../api/src/payments/payments.service.ts#L247), [capture dan settlement](../api/src/payments/payments.service.ts#L303).

## Temuan dan rekomendasi

### P1 — PayPal disetel tanpa shipping address untuk barang fisik

**Bukti:** `PayPalService.createOrder()` mengatur `shipping_preference` menjadi `NO_SHIPPING`; request purchase unit hanya berisi reference dan amount. Checkout sebelumnya telah mengumpulkan dan menyimpan shipping address serta memakai tujuan itu untuk quote.

**Dampak:** pembeli tidak meninjau alamat pengiriman di PayPal review flow dan alamat toko tidak ikut pada objek transaksi PayPal. Dokumentasi PayPal menyebut `NO_SHIPPING` menghapus data shipping address dari halaman PayPal dan respons API. Kebijakan Seller Protection PayPal AS menyatakan barang fisik harus dikirim ke alamat yang muncul di Transaction Details; kebijakan/eligibilitas berbeda menurut negara akun, jadi ini merupakan risiko yang harus diverifikasi untuk akun merchant RENDI VIRGO, bukan klaim bahwa perlindungan pasti hilang.

**Rekomendasi:** untuk alur checkout sekarang, kirim alamat dari order lokal pada `purchase_units[].shipping` dan pilih `SET_PROVIDED_ADDRESS`. PayPal menampilkan alamat merchant kepada pembeli dan tidak mengizinkan perubahan pada halaman review; pembeli masih bisa mengoreksinya di form toko sebelum order dibuat. Setelah rilis, pastikan alamat yang tampil di PayPal Transaction Details cocok dengan alamat order dan alamat pada bukti pengiriman. Konfirmasi aturan Seller Protection yang berlaku untuk negara akun bisnis.

**Alternatif UX:** jika pembeli harus memilih alamat tersimpan di PayPal, gunakan `GET_FROM_FILE`, aktifkan server-side shipping callbacks, hitung ulang opsi/biaya dan total untuk alamat yang dipilih, lalu pastikan amount final disetujui sebelum capture. Dokumentasi PayPal menyediakan callback alamat/opsi dan mengharuskan nilai shipping serta total breakdown konsisten. Itu adalah perubahan alur yang lebih besar.

### P2 — Alamat wajib di form toko adalah kebutuhan checkout saat ini, bukan syarat PayPal

**Bukti:** input alamat jalan dan kota memiliki atribut `required`; DTO backend juga mewajibkan baris alamat, kota, dan negara. Alamat negara digunakan ketika meminta quote shipping. Tidak ada aturan ini yang menunjukkan PayPal memerlukan billing address.

**Rekomendasi:** pertahankan field alamat shipping untuk checkout produk fisik, tetapi jelaskan label/helper text bahwa alamat dipakai menghitung ongkir dan mengirim barang. Jangan menambahkan form billing hanya untuk PayPal. Jika produk digital/non-shipping ditambahkan, tentukan kebutuhan alamat berdasarkan jenis fulfillment; `NO_SHIPPING` cocok untuk kasus tanpa pengiriman fisik.

### P2 — Alamat yang dikirim ke PayPal harus selaras dengan quote dan fulfillment

**Bukti:** alamat toko menentukan quote dan tersimpan pada order, sementara transaksi PayPal tidak menerima alamat tersebut. Mengganti konfigurasi hanya menjadi `GET_FROM_FILE` tanpa callbacks juga memungkinkan alamat PayPal berbeda dari tujuan yang dipakai menghitung ongkir.

**Rekomendasi:** pilih satu sumber alamat yang konsisten untuk perhitungan shipping, jumlah yang disetujui, record order, detail transaksi PayPal, dan label kurir. Untuk alur sederhana saat ini, gunakan alamat merchant yang dikunci di PayPal. Untuk alur PayPal-address-first, implementasikan callback dan pembaruan total sebagai satu fitur lengkap.

### Catatan pemulihan — Order sudah ada sebelum sesi PayPal dibuat

Order lokal dan reservasi dibuat sebelum create-order PayPal dipanggil; cart dibersihkan sesudah order lokal tersimpan. Bila panggilan PayPal gagal, order lokal tetap pending. Pastikan pelanggan dapat melanjutkan pembayaran dari order yang sama dan tidak membuat order/reservasi baru tanpa sengaja. Ini adalah risiko pemulihan yang terlihat dari urutan kode, belum direproduksi dengan transaksi PayPal dalam audit ini.

## Rencana tindak lanjut yang disarankan

1. Pastikan kebijakan PayPal yang berlaku untuk negara akun merchant dan cek satu transaksi sandbox dengan barang fisik: alamat mesti terlihat pada Transaction Details.
2. Ubah payload create-order agar membawa shipping address order dan memakai `SET_PROVIDED_ADDRESS`; sertakan rincian item/amount breakdown bila ingin menampilkan ongkir dan barang secara jelas di PayPal.
3. Verifikasi total, mata uang, alamat, dan reference di callback/capture; pastikan alamat fulfillment sama dengan alamat transaksi.
4. Uji sandbox untuk approve, cancel, capture berulang, webhook, alamat yang diubah sebelum submit di toko, dan kegagalan create-order. Jangan gunakan pembayaran live untuk pengujian.
5. Pertahankan form billing tetap tidak ada untuk PayPal Wallet kecuali ada alasan bisnis, pajak, atau kontrol risiko yang terdefinisi.

## Batas pemeriksaan

Ini adalah audit source dan dokumentasi. Saya tidak membuat order di PayPal sandbox/live atau memeriksa akun merchant, sehingga tampilan transaksi aktual, setting merchant yang mungkin meng-override `shipping_preference`, kesiapan kredensial, serta status Seller Protection akun belum diverifikasi.

## Implementasi setelah persetujuan

Pada 16 Oktober 2026 rekomendasi diterapkan pada source:

- PayPal create-order sekarang mengirim nama/alamat shipping order dan memakai `SET_PROVIDED_ADDRESS`.
- Checkout mencegah metode PayPal untuk pilihan “Other” yang tidak memiliki kode negara ISO dua huruf; transfer bank tetap tersedia.
- Server memeriksa alamat yang dikembalikan PayPal setelah membuat sesi, sebelum capture, dan pada jalur webhook. Sesi lama yang belum disetujui dan tidak memuat alamat terbaru diganti; webhook untuk sesi yang sudah diganti diabaikan.
- Kunci idempotensi create-order diberi versi baru agar retry tidak mengambil payload sesi lama yang memakai `NO_SHIPPING`.

Transaksi sandbox/live dan test suite belum dijalankan. Karena itu, merchant harus memverifikasi satu transaksi sandbox dan tampilan PayPal Transaction Details sebelum mengaktifkan perubahan pada pembayaran live.

## Dokumentasi resmi PayPal

- [Orders v2 — Order Request](https://developer.paypal.com/sdk/orders/v2/definitions/order_request): enum/default `shipping_preference` dan konteks Orders API.
- [PayPal Checkout — Shipping module](https://developer.paypal.com/platforms/checkout/standard/customize/shipping-module): arti `GET_FROM_FILE`, `NO_SHIPPING`, `SET_PROVIDED_ADDRESS`, callbacks alamat/opsi, dan konsistensi breakdown jumlah.
- [Orders v2 — Payer](https://developer.paypal.com/sdk/orders/v2/definitions/payer/): alamat payer/billing dinyatakan sebagai opsional.
- [PayPal Seller Protection Program (US)](https://www.paypal.com/us/legalhub/paypal/seller-protection?locale.x=en_US): syarat AS untuk barang fisik termasuk mengirim ke alamat pada Transaction Details; cek kebijakan sesuai negara merchant.
- [PayPal Checkout integration](https://developer.paypal.com/platforms/checkout/standard/integrate): alur create order di backend lalu capture setelah buyer mengonfirmasi; panduan juga mengingatkan seller protection dan alamat dalam konfirmasi transaksi.
