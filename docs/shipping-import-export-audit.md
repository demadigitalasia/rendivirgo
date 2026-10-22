# Laporan audit import/export tarif shipping

**Tanggal:** 22 Oktober 2026
**Cakupan:** halaman Admin → Settings → Shipping, endpoint API shipping rates, format workbook XLSX, dan tiga workbook kurir yang sudah disiapkan.

## Ringkasan

Alur website sudah disesuaikan untuk mengekspor tarif per kelompok **DHL**, **FedEx**, dan **Post Office (Pos Indonesia)**. Ekspor seluruh kurir tetap tersedia sebagai cadangan. Impor sekarang meminta satu workbook untuk satu kelompok kurir, menampilkan kelompok yang terdeteksi saat pratinjau, serta membatasi mode penggantian ke kurir pada workbook itu saja.

Workbook sumber masih memiliki baris yang perlu ditinjau. Dari 4.136 baris pada tiga workbook, 990 berstatus `OK` dan 3.146 perlu ditinjau. Mode `Merge` dapat menerapkan baris yang valid saja dan melewati baris bertanda; mode `Replace` tetap mensyaratkan seluruh baris valid. Uji lokal DHL berhasil membuat 385 tarif dan melewati 1.495 baris untuk ditinjau.

## Temuan dan penyesuaian

| Temuan | Risiko | Penyesuaian |
|---|---|---|
| Sebelumnya ekspor hanya menghasilkan satu workbook berisi semua tarif. | Sulit mengelola tarif per kurir. | Tombol ekspor terpisah untuk DHL, FedEx, dan Post Office; tombol `Export all` tetap tersedia. Nama alias yang tersimpan seperti `DHL`/`DHL Express`, `FedEx`/`FedEx Express`, dan `Pos Indonesia` dipetakan ke kelompok yang sama. |
| Sebelumnya workbook campuran dapat diproses sebagai satu impor. | Tarif dapat tercampur atau salah dikelola lintas kurir. | API mewajibkan kolom `carrier` dan memblokir file yang mencampur kelompok. ID tarif lintas grup ditandai pada pratinjau dan dilewati pada mode `Merge`. |
| Mode `Replace` sebelumnya menghapus semua tarif sebelum mengimpor. | Mengganti DHL saja dapat menghapus tarif FedEx, Post Office, dan kurir lain. | `Replace this carrier` hanya menghapus tarif aktif maupun nonaktif pada kelompok yang terdeteksi. Website meminta konfirmasi sebelum menjalankannya. |
| Baris bertanda membuat seluruh workbook tidak dapat diimpor. | Satu masalah menahan semua baris valid, atau impor parsial dapat menghapus data dalam mode penggantian. | Sheet `Data Impor` dan kolom `importStatus` wajib ada. `Merge` hanya membuat atau memperbarui baris valid dan melaporkan jumlah yang dilewati; `Replace` tetap memblokir workbook yang belum seluruhnya valid. |
| Nama carrier dari dokumen sumber berbeda dari sebagian nama lama di database. | Impor gabung dapat membuat baris baru padahal itu kurir yang sama. | Kunci pencocokan impor menormalkan alias DHL, FedEx, dan Post Office. ID tetap menjadi pencocok utama, dengan pemeriksaan grup kurir. |

Pratinjau impor tetap memeriksa kolom wajib, harga dan biaya, rentang berat, estimasi hari, duplikasi ID/kunci tarif, serta ID yang cocok ke lebih dari satu tarif. Baris yang gagal pemeriksaan tidak mengubah tarif yang sudah ada. Upload dibatasi hingga 5 MB, workbook hasil ekstraksi hingga 25 MB, maksimal 100 entri ZIP, dan 10.000 baris tarif. Endpoint impor memakai autentikasi Admin global dan mencatat jumlah baris yang diterapkan maupun dilewati ke audit log.

## Kesiapan tiga workbook saat ini

| Workbook | Baris | `OK` | Perlu ditinjau |
|---|---:|---:|---:|
| DHL | 1.880 | 385 | 1.495 |
| FedEx | 1.880 | 495 | 1.385 |
| Post Office / Pos Indonesia | 376 | 110 | 266 |
| **Total** | **4.136** | **990** | **3.146** |

Baris yang ditandai meliputi penempatan negara pada zona yang tumpang tindih, kode negara yang tidak didukung daftar website, dan interpretasi batas berat dari gambar. Untuk DHL/FedEx juga ada rentang berat yang perlu dicocokkan dengan sumber. Status `OK` sebaiknya baru diberikan setelah angka dan penempatan negaranya disepakati.

Format ketiga workbook sudah diperbarui pada sheet `Petunjuk`: sekarang menjelaskan syarat website, kewajiban satu kurir per file, arti status review, penggunaan `Merge`, batas berat inklusif, dan asumsi default estimasi/biaya tambahan. Sheet `Data Impor`, isi tarif, jumlah baris, dan status review dipertahankan. Nilai yang masih ambigu tidak saya tebak atau tandai `OK`.

## Risiko data sebelum impor

1. **Zona negara tumpang tindih.** Website mencari tarif berdasarkan kode negara tujuan dan berat; bila negara yang sama masuk ke dua zona dengan rentang berat yang sama, website dapat menampilkan dua tarif untuk kurir yang sama. Pastikan satu pemetaan negara yang benar per kurir, kecuali memang ada dua layanan berbeda yang ingin ditawarkan.
2. **Kode negara harus sesuai website.** Kolom `region` dipakai sebagai kode negara tujuan (misalnya `ID`) atau `Worldwide`. Nama negara biasa tidak otomatis cocok dengan pencarian negara website. Tinjau baris Kosovo yang diberi tanda kode tidak didukung.
3. **Batas berat perlu dikonfirmasi.** Website memakai batas gram inklusif. Rentang sumber `1000–2500` telah dinormalisasi menjadi `1001–2500` agar tidak bertabrakan dengan rentang sebelumnya; konfirmasi batas 1.000 g sebelum menandai baris `OK`.
4. **Waktu kirim dan biaya tambahan.** Dokumen tarif menampilkan harga, tetapi tidak mencantumkan estimasi hari atau biaya handling/insurance/fragile/oversized. Jika kolom-kolom itu kosong, website memakai estimasi 3–7 hari dan biaya tambahan nol. Pastikan asumsi ini cocok dengan operasional sebelum tarif dipakai pelanggan.
5. **Format yang didukung adalah `.xlsx`.** Website tidak menerima format Excel lama `.xls`, CSV, atau gambar. Gunakan workbook XLSX dengan sheet `Data Impor` dan struktur kolom template ekspor.

## Rekomendasi

### Sebelum impor lengkap

1. Selesaikan seluruh penanda `importStatus` di tiga file. Jangan ubah status menjadi `OK` tanpa memeriksa negara, zona, harga, dan batas berat terhadap sumber.
2. Selesaikan pemetaan zona ganda dan kode negara yang tidak didukung. Periksa pula batas berat 1.000 g dan rentang maksimum DHL/FedEx yang ditandai.
3. Tetapkan nilai estimasi pengiriman per kurir atau setujui bahwa tarif kosong memakai 3–7 hari. Pastikan biaya tambahan nol memang dikehendaki.
4. Untuk menambahkan sisa tarif, tinjau baris yang dilewati di tiap file, perbaiki zona/kode negara/batas beratnya, lalu pratinjau ulang dalam mode `Merge`. Periksa halaman admin dan quote untuk beberapa negara serta berat di batas rentang.
5. Gunakan `Replace this carrier` hanya ketika seluruh file kurir sudah lengkap, sudah ditinjau, dan memang dimaksudkan menggantikan seluruh tarif kelompok tersebut.

### Pengembangan berikutnya

- Tambahkan ringkasan perubahan yang lebih rinci pada pratinjau: nilai lama → baru, jumlah tarif yang akan dihapus, dan daftar konflik negara/rentang berat.
- Tambahkan ekspor/unduh laporan kesalahan pratinjau agar koreksi ribuan baris lebih mudah.
- Simpan snapshot sebelum impor dan sediakan pemulihan satu klik, terutama untuk mode penggantian.
- Tambahkan pengujian otomatis endpoint untuk ekspor per alias carrier, file campuran, ID lintas carrier, dan penggantian satu carrier tanpa menghapus carrier lain.

## Verifikasi saat ini

- TypeScript halaman web: `npm run lint` — lulus.
- TypeScript API: `npm run typecheck` — lulus.
- Pemeriksaan whitespace: `git diff --check` — lulus.
- Uji melalui halaman Admin lokal: workbook DHL terbaca sebagai 1.880 baris, 385 valid dan 1.495 perlu ditinjau; mode `Merge` berhasil membuat 385 tarif dan melewati 1.495 baris.
- Daftar Shipping menampilkan tarif yang baru diimpor; tarif DHL `US` yang sudah ada tetap tersimpan.
- Baris dengan zona ambigu atau nilai yang belum ditinjau tidak ikut diterapkan.
