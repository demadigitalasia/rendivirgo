# Review SEO Score, Edit SEO, dan Generate AI

Tanggal: 23 Oktober 2026, Asia/Jakarta.

## Status implementasi setelah persetujuan

Rekomendasi utama telah diterapkan pada 23 Oktober 2026:

- Product/category/blog sekarang menggunakan preview Apply/Discard bersama dengan page/home/banner/SEO. Generator blog tersedia juga untuk artikel yang sudah ada dan mempertahankan status publikasi form.
- Pilihan bahasa penerapan, field, replace/fill empty, perbandingan current/generated, pilihan sumber existing content atau title+brief, dan Undo tersedia. Snapshot seluruh form mencegah hasil lama menimpa edit baru, termasuk interaksi antar-generator. Undo menolak menimpa field yang sudah berubah lagi.
- Endpoint generic AI mendukung product/category/blog; generator lama juga menolak respons terpotong dan panjang field tidak valid, tanpa clipping string secara diam-diam.
- URL preview memakai rute produk/blog/category dan prefix ID. Indikator editorial EN/ID, status terjemahan, kelengkapan metadata, penghitung karakter dan tautan technical audit ditambahkan. Header daftar menyebut EN. Focus topic hanya untuk analisis sesi, tidak disimpan sebagai field SEO baru.
- Pengulangan satu kata berlebihan mengurangi poin konten/topik/readability. Alt otomatis dan alt berulang memperoleh kredit parsial. Penilaian ini tetap heuristik, bukan pemeriksa fakta atau ranking.
- Audit memeriksa canonical origin+path, HTTP X-Robots-Tag, basic schema fields, dan sampai 20 tautan internal relatif per halaman. Mendukung sitemap index sampai 20 child maps.
- Ringkasan 20 run terakhir disimpan lokal di browser; hasil run aktif dapat diexport CSV. Ini belum histori database bersama antarperangkat dan belum menyimpan seluruh hasil detail setiap run.
- Audit browser selesai pada 118 URL: 118 berhasil di-fetch, 0 gagal, rata-rata teknis 62/100. Ditemukan duplikasi metadata pada beberapa URL. Konten publik tidak diubah otomatis.
- Verifikasi: 15 test SEO/Apply dan 46 test API lulus; TypeScript frontend/API lulus. Uji provider memakai mock. Generate OpenRouter berbayar dan simpan konten hasil generasi nyata belum dijalankan.

Catatan: temuan di bawah adalah catatan review sebelum implementasi. Pekerjaan lanjutan yang masih membutuhkan pengembangan: histori audit database, alt produk per bahasa, validasi Google rich result penuh, pemeriksaan robots.txt/Core Web Vitals, dan penyuntingan metadata/konten publik yang ditemukan bermasalah. Preview memberi tahu adanya template brand; ia belum mensimulasikan seluruh fallback/title template publik untuk setiap rute secara persis.

## Ruang lingkup dan batas pemeriksaan

Review kode scoring, adapter daftar/editor, editor product/category/blog/page/home/banner, generator API, metadata publik, dan scanner teknis. Menjalankan test SEO dan test API. Review ini tidak mengubah fitur, tidak menjalankan generasi berbayar OpenRouter, dan tidak menyatakan telah menguji seluruh alur simpan melalui browser atau seluruh URL publik secara langsung.

## Kesimpulan

Fondasi tersedia dan berguna untuk panduan editorial. Kesiapan belum cukup untuk menjadikan angka sebagai jaminan kualitas SEO. Prioritas terbesar adalah proteksi penimpaan hasil AI produk, konsistensi workflow generator, serta kesesuaian preview dan sumber skor dengan halaman publik.

## Temuan berdasarkan prioritas

### P1 — Generate copy produk dapat menimpa perubahan saat request berlangsung

`components/admin/product-form.tsx`, fungsi `generateProductCopy`, langsung menjalankan `setValues` ketika respons selesai. Tidak ada snapshot/revision check maupun preview Apply seperti pada `AiDraft`. Konten yang diedit sambil menunggu dapat tertimpa. Generator juga tidak menyertakan description yang sudah ada; sumbernya nama, brief, kategori dan atribut produk.

Rekomendasi: gunakan satu workflow preview/apply, snapshot sumber dan target, diff per field, serta pilihan isi field kosong atau ganti field terpilih.

### P1 — AI artikel mengubah status publikasi pada form

`app/admin/(dashboard)/content/blog/[id]/page.tsx`, `generateCopy`, menetapkan `status: "Draft"`. Pada artikel Published, menyimpan hasil ini akan mengubah artikel menjadi Draft. Tidak terjadi sebelum Save, tetapi konfirmasi awal hanya menyebut penggantian teks dan SEO.

Rekomendasi: pertahankan status publikasi; simpan hasil AI sebagai revisi yang dapat ditinjau, atau jelaskan perubahan status secara eksplisit.

### P1 — Proteksi perubahan bersamaan belum mencakup semua jalur

Blog/category generator lama memakai `formRevision`, tetapi callback `SeoPanel.onMetadata` memakai `setForm` langsung dan tidak menaikkan revision. Jika metadata AI diterapkan ketika generator konten masih berjalan, respons generator konten dapat menggantinya tanpa terdeteksi.

Rekomendasi: satu mekanisme revision untuk semua mutasi form, atau blokir generator yang saling menimpa selama satu request aktif.

### P2 — Preview pencarian memakai URL yang tidak sesuai rute publik

`components/admin/seo-panel.tsx` menampilkan `rendivirgo.com/{slug}` untuk semua tipe dan bahasa. Produk seharusnya memakai `/shop/{category}/{slug}`, blog `/blog/{slug}`, dan bahasa Indonesia memakai `/id/...`.

Rekomendasi: berikan canonical path dan locale ke SeoPanel dari editor. Tampilkan judul final beserta template brand yang benar-benar dipakai metadata publik.

### P2 — Skor menilai field mentah, bukan metadata efektif

`lib/seo-analysis.ts` memberi nol pada SEO title/description kosong meskipun metadata publik memiliki fallback. Ini tepat sebagai dorongan mengisi metadata khusus, tetapi bukan bukti metadata publik hilang. Daftar memakai konten utama English; editor dapat beralih ke Indonesia. Skor hijau English tidak menjelaskan kesiapan terjemahan.

Rekomendasi: beri label Editorial EN/ID, tampilkan status terjemahan, dan bedakan custom metadata kosong dari metadata publik tidak tersedia. Pisahkan skor editorial, teknis, dan readiness publikasi.

### P2 — Parameter topik dan kualitas mudah memberi hasil terlalu optimistis

`analyzeSeo` memberi poin topik bila satu token judul ditemukan di body/title/description. Panjang teks dan struktur dasar tidak memeriksa akurasi, manfaat, repetisi, intent, atau keaslian. Fixture test bahkan mencapai 100 dengan pengulangan kata agate; ini menunjukkan batas algoritma, bukan kualitas artikel.

Rekomendasi: tambahkan focus topic yang dapat dipilih, deteksi repetisi, dan checklist editorial manual. Jangan menjadikan AI penilai faktual tunggal. Pertahankan penjelasan bahwa skor bukan prediksi ranking.

### P2 — Pemeriksaan gambar menilai kelengkapan, bukan kualitas alt

Produk menggunakan fallback nama produk untuk alt; kategori/home menggunakan judul sebagai alt. Semua gambar dapat memperoleh poin penuh dengan teks identik. Alt dekoratif kosong justru kehilangan poin pada editorial, sedangkan scanner teknis mengizinkannya.

Rekomendasi: pisahkan alt eksplisit, fallback, dan gambar dekoratif. Nilai ketercakupan dan relevansi sebagai sinyal berbeda. Perlu dukungan alt per bahasa untuk produk.

### P2 — Generator belum konsisten dalam review dan validasi

Generic `AiDraft` menyediakan preview, Apply/Discard dan snapshot. Product/category/blog lama menerapkan hasil langsung ke form. Generic service menolak field kosong/kelebihan panjang dan output terpotong; generator blog lama memakai slice pada hasil dan tidak memeriksa finish_reason.

Rekomendasi: satukan kontrak respons, validasi panjang tanpa memotong kalimat, deteksi truncation, preview dan kontrol overwrite di semua generator.

### P2 — Sumber AI dapat tidak lengkap

SEO/page context memotong body ke 8.000 karakter. Artikel lama hanya mengirim title dan brief, sehingga isi artikel yang sudah ada tidak menjadi sumber otomatis. Metadata yang dihasilkan juga selalu mencakup dua bahasa dan Apply mengganti empat field sekaligus.

Rekomendasi: beri tahu bagian yang dikirim, gunakan sumber terstruktur yang relevan, pilih bahasa dan field, dan pisahkan generate ulang dengan optimize existing. Untuk halaman kebijakan, tunjukkan diff agar ketentuan bisnis dapat diperiksa.

### P2 — Scanner teknis memiliki celah yang dapat memberi skor terlalu baik

`lib/seo-html.ts` memeriksa pathname canonical tetapi tidak host/domain. JSON-LD dinilai berdasarkan parse dan tipe, belum field wajib atau kesesuaian offer/stock. Hanya keberadaan alt dan social metadata yang diperiksa, belum kualitas atau aksesibilitas URL gambar. Link internal editorial diperiksa dengan pola, bukan validitas tujuan. HTML yang dinilai melalui regex/editor juga bisa berbeda dari Markdown yang benar-benar dirender.

Rekomendasi: canonical origin+path, response headers/indexing, link checker, validasi schema sesuai tipe, pengujian parser terhadap HTML nyata dan hasil renderer konten.

### P3 — Audit belum menyimpan histori atau mencakup seluruh inventaris

`app/admin/(dashboard)/seo/page.tsx` memindai sitemap saat ini, menyimpan hasil hanya dalam state browser. Draft/arsip/URL yatim tidak masuk cakupan sitemap. Rata-rata hanya URL berhasil; kegagalan ditampilkan terpisah. Tidak ada histori, export atau tren skor. Sitemap index belum ditangani secara rekursif.

Rekomendasi: simpan run, coverage dan jumlah gagal; tampilkan last audited; export CSV; bandingkan sebelum/sesudah; dukung sitemap index bila dibutuhkan skala katalog.

## Bagian yang sudah baik

- Skor dihitung deterministik dan rentang 0–100 dinormalisasi per tipe konten.
- Bobot berbeda sesuai tipe: produk 100 kata, blog 300, page 150, kategori 35, home 100 sebagai panduan editorial.
- Editor memberi daftar perbaikan, preview dan pilihan EN/ID.
- Metadata tersambung ke payload penyimpanan dan pembacaan metadata publik dalam kode yang diperiksa.
- Generic AI menyimpan API key di server, memakai guard admin global, throttle, timeout, JSON schema dan validasi whitelist field.
- Generic AI tidak menyimpan atau mempublikasikan hasil otomatis; ada Apply/Discard dan proteksi source berubah.
- Permintaan provider meminta privacy routing data_collection deny dan zdr; ketersediaan provider/model aktual tetap perlu uji langsung.
- Scanner membatasi fetch ke origin lokal, menolak redirect, serta tidak menambah view artikel saat audit.

## Hasil verifikasi

- `npm run test:seo`: 9/9 lulus.
- `npm test`: 43/43 lulus, termasuk 6 test generic AI memakai mock provider dan 2 test view audit blog.
- Belum ada pengujian langsung `auditHtml` dengan DOMParser dalam test SEO saat ini; test scanner yang ada hanya duplikasi metadata.
- Belum terbukti lewat test end-to-end: generate real provider, Apply→Save→reload→metadata publik, proteksi dua generator bersamaan, dan semua tipe/bahasa.

## Urutan pelaksanaan yang disarankan

1. Proteksi overwrite produk dan interaksi antar-generator; pertahankan status artikel Published.
2. Satukan preview/apply, pilihan field/bahasa, diff dan undo untuk seluruh AI.
3. Koreksi URL preview dan label EN/ID; jelaskan fallback metadata publik.
4. Perbaiki kualitas scoring, alt dan validator teknis; tambah test yang memeriksa perilaku nyata.
5. Tambahkan histori audit dan coverage dashboard.

Kriteria penerimaan utama: hasil AI lama tidak dapat menimpa edit baru; generate artikel tidak mengubah status publikasi tanpa tindakan jelas; metadata tersimpan sama dengan hasil publik per bahasa; preview memakai URL aktual; kegagalan model tidak mengubah form.
