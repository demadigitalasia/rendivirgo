# Review Fungsi SEO Score

Tanggal: 25 Oktober 2026 (Asia/Jakarta).

## Ringkasan

**Nilai baseline sebelum perbaikan: 55/100. Nilai tindak lanjut setelah rekomendasi diterapkan: 78/100.** Nilai 55 mendokumentasikan kondisi awal. Nilai tindak lanjut menilai kualitas fungsi sesudah perubahan dalam laporan ini; keduanya menilai fitur, bukan SEO situs RENDI VIRGO.

Nilai ini menilai mutu fitur (kesesuaian terhadap panduan Google, ketepatan pemeriksaan, kalibrasi angka, serta bukti pengujian), bukan nilai SEO situs RENDI VIRGO dan bukan nilai yang dikeluarkan Google. Google tidak menetapkan skor SEO universal 0–100 atau bobot checklist seperti yang dipakai aplikasi ini. Aplikasi sudah menampilkan disclaimer bahwa skor editorial bukan skor Google/ranking, dan audit teknis memisahkannya dari skor editorial. [Panduan Google menjelaskan banyak sinyal dan sistem ranking](https://developers.google.com/search/docs/appearance/ranking-systems-guide), bukan satu angka checklist.

### Komponen nilai

| Aspek yang dinilai | Bobot | Nilai aspek | Kontribusi |
| --- | ---: | ---: | ---: |
| Kesesuaian prinsip dengan panduan Google | 25% | 70/100 | 17,5 |
| Ketepatan dan cakupan pemeriksaan | 30% | 58/100 | 17,4 |
| Kalibrasi dan keterbacaan skor | 25% | 48/100 | 12,0 |
| Bukti verifikasi otomatis | 20% | 40/100 | 8,0 |
| **Total dibulatkan** | **100%** |  | **55/100** |

## Ruang lingkup dan metode

Saya meninjau `lib/seo-analysis.ts`, `lib/seo-html.ts`, `components/admin/seo-panel.tsx`, halaman `/admin/seo`, integrasi editor produk/kategori/blog/halaman/home, test `scripts/seo-analysis.spec.ts`, dan panduan resmi Google Search Central. Saya juga menjalankan `npm run test:seo` karena permintaan mencakup pemeriksaan fungsi dan ketepatannya.

Pada baseline, perintah tersebut **9 lulus dan 6 gagal dari 15 kasus**. Setelah perbaikan, `npm run test:seo` lulus **22/22**. Saya tidak menjalankan crawl produksi atau memeriksa data Google Search Console/Core Web Vitals; hasil ini adalah review implementasi dan uji lokal, bukan audit performa situs di Google. Temuan pada bagian berikut merangkum masalah baseline; status tindak lanjutnya ada di bagian akhir.

## Temuan utama pada baseline pra-perbaikan

### P1 — Konten yang hampir seluruhnya pengulangan masih berstatus “Good”

Pada `lib/seo-analysis.ts`, jumlah kata target memberi kredit untuk panjang isi, pemeriksaan topik terutama mencari keberadaan token, dan pemeriksaan repetisi hanya berbobot 5 poin. Saya menjalankan contoh dengan 322 kata, sekitar 99% token berupa kata “agate”; skor masih **86/100 — Good**. Contoh tersebut mempunyai metadata, slug, heading, dan tautan yang lolos, sehingga sinyal repetisi yang gagal tidak cukup mengubah hasil.

Ini berisiko mendorong penulis mengoptimalkan checklist atau memperpanjang isi dengan filler. Google tidak menetapkan target jumlah kata dan memperingatkan agar tidak menulis untuk mesin pencari atau mengulang kata kunci secara berlebihan. Lihat [konten people-first](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [SEO Starter Guide tentang panjang konten](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), dan [kebijakan spam Google](https://developers.google.com/search/docs/essentials/spam-policies).

**Perbaikan:** jadikan jumlah kata panduan kontekstual, bukan syarat poin utama. Tambah sinyal peninjauan untuk repetisi kata/frasa yang kuat dan pastikan kondisi spam berat tidak dapat tetap menghasilkan status “Good”. Kualitas, akurasi, nilai tambah, dan pemenuhan kebutuhan pencari tetap perlu pemeriksaan manusia; teks panjang atau kecocokan token tidak dapat membuktikannya.

### P1 — Test SEO gagal dan kontrak test berbeda dari implementasi aktif

`npm run test:seo` gagal pada 6 kasus:

- Draft kosong memperoleh 3 poin, bukan 0, karena pemeriksaan repetisi memberi kredit parsial ketika teks belum cukup untuk dianalisis.
- Fixture “konten lengkap” bernilai 96, bukan 100.
- Test mengharapkan bobot konten kategori 20, sedangkan kode saat ini memberi bobot 10.
- Ekspektasi poin topik bahasa Indonesia tidak cocok dengan bobot/perhitungan aktif.
- Meta description sepanjang 500 karakter mendapat 11/15 karena setiap nilai nonkosong mendapat 75% kredit; test mengharapkan 0.
- Fixture pengulangan gagal mencapai ekspektasi di bawah 80; kasus representatif di atas bahkan menghasilkan 86/100.

Sebagian hasil ini menunjukkan fixture dan ekspektasi belum diperbarui mengikuti perubahan rubric; sebagian lain menunjukkan perilaku yang memang memberi skor terlalu optimistis. Selama kontrak test dan rubric tidak selaras, hasil hijau tidak punya interpretasi yang stabil.

**Perbaikan:** tetapkan dulu rubric yang disetujui, perbarui fixture agar mencerminkan maksud tiap aturan, dan pastikan setiap hasil check memiliki uji batas. Khusus metadata, Google tidak menentukan batas karakter tetap untuk `<title>` atau meta description; gunakan panjang sebagai petunjuk tampilan, bukan syarat Google. Lihat [panduan title link](https://developers.google.com/search/docs/appearance/title-link) dan [panduan snippet](https://developers.google.com/search/docs/appearance/snippet).

### P2 — Angka menggabungkan sinyal yang bukan ukuran ranking langsung

Skor editorial memberi bobot pada panjang isi, slug, kata topik, alt, dan keberadaan metadata. Audit HTML memberi bobot pada title/description yang sekadar ada, tepat satu H1, hierarki heading, alt attribute, social preview, dan basic JSON-LD. Ini adalah pemeriksaan hygiene/konten yang bisa membantu editor; tidak semuanya merupakan faktor ranking langsung atau bukti halaman berkualitas.

Google menyebut title harus ringkas, deskriptif, unik, dan menghindari keyword stuffing, tetapi tidak menetapkan batas karakter tetap. Google juga bisa mengambil snippet dari isi halaman alih-alih meta description, dan tidak membatasi panjang meta description dengan angka tetap. Pemeriksaan saat ini memberi skor teknis penuh hanya karena field tersedia, tanpa mengukur apakah teks itu benar-benar deskriptif atau sesuai isi.

**Perbaikan:** pertahankan pemisahan jelas antara **kelengkapan editorial** dan **validasi teknis**, beri label tiap poin sebagai terukur otomatis atau butuh review manusia, serta hindari menafsirkan rata-rata sebagai peluang ranking. Periksa uniqueness, kecocokan title dengan isi, serta kualitas deskripsi dengan review; jangan mengklaim validasi semantik otomatis jika hanya memeriksa keberadaan.

### P2 — Beberapa pemeriksaan memberi kredit berdasarkan keberadaan, bukan kualitas

- Pemeriksaan judul dan deskripsi audit teknis lulus jika tag ada. Duplikasi identik memang dicari lintas URL hasil crawl, tetapi kualitas, kemiripan, dan template yang terlalu umum tidak dinilai.
- Pemeriksaan alt teknis lulus jika setiap gambar memiliki atribut `alt`; nilai `alt=""` diterima tanpa mengetahui apakah gambar tersebut dekoratif atau gambar produk/konten yang informatif. Alt fallback editorial mendapat kredit parsial, tetapi scanner HTML tidak menguji apakah teks alt benar-benar menjelaskan gambar.
- Pemeriksaan heading teknis mensyaratkan tepat satu H1 dan urutan heading tertentu. Ini dapat menjadi petunjuk struktur yang baik, tetapi aturan tepat satu H1 bukan skor ranking Google.
- Structured data hanya dicek dengan parse JSON, tipe yang diperkirakan dari URL, dan beberapa field dasar. UI sudah menyebut ini bukan validasi penuh rich result; hasil tersebut tidak memeriksa seluruh pedoman fitur atau apakah markup akurat dan sesuai konten yang terlihat.
- Editorial link check mencari pola markdown/HTML; itu tidak membuktikan link relevan atau tujuan benar-benar ada. Scanner audit memeriksa sampai 20 tujuan internal relatif via HEAD, yang dapat gagal pada route yang tidak mendukung HEAD.

Google menganjurkan link yang dapat di-crawl, alt tekstual yang deskriptif dan kontekstual, serta structured data yang akurat; markup yang valid pun tidak menjamin rich result. Lihat [link crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable), [SEO gambar Google](https://developers.google.com/search/docs/appearance/google-images), dan [kebijakan structured data](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

**Perbaikan:** bedakan gambar dekoratif dan informatif pada data input, cek teks alt kosong/fallback/duplikat sebagai kategori yang berbeda, ikuti link dengan GET sebagai fallback saat HEAD tidak tersedia, dan gunakan validasi resmi rich result saat evaluasi manual. Jadikan aturan H1/heading sebagai saran struktur berisiko rendah, bukan penalti besar.

### P2 — Skor 0–100 berbeda makna menurut tipe halaman

Bobot dan check yang diterapkan berbeda untuk produk, blog, kategori, homepage, dan halaman umum. Contohnya artikel menerima pemeriksaan heading/link dan bobot gambar 5, kategori tidak menerima heading/link dan gambar berbobot 15, sedangkan halaman umum dinormalisasi dari total check 95. Jadi 80 pada satu jenis konten tidak berarti hal yang sama dengan 80 pada jenis konten lain.

Beberapa sumber input juga hanya mewakili sebagian konten publik. Homepage menilai hero subtitle dan owner bio, bukan keseluruhan konten yang dirender; skor gambar homepage/kategori selalu menerima alt fallback dan tidak punya kolom alt khusus. Produk berbahasa Indonesia menggunakan alt fallback dari nama produk bahasa Inggris jika teks alt tidak diisi. Artinya hasil bisa dipengaruhi keterbatasan editor/input, bukan hanya kualitas halaman publik.

**Perbaikan:** tampilkan cakupan check dan pembilang/penyebut sebelum normalisasi, bandingkan skor hanya dalam tipe konten yang sama, sertakan semua sumber konten yang relevan atau tandai input yang tidak dianalisis. Tambahkan field alt yang dilokalkan bila alt editorial memang ingin dinilai dalam tiap bahasa.

### P2 — Audit teknis memeriksa sinyal sumber, tidak membuktikan indexing atau pengalaman nyata

Audit membaca URL dalam sitemap dan HTML yang bisa di-fetch dari storefront. Ia memeriksa canonical berdasarkan kebijakan path/query yang ditulis di kode, `noindex` pada meta/header, atribut HTML, beberapa link, dan JSON-LD dasar. Ia tidak membaca `robots.txt`, tidak memeriksa status indeks Google/Search Console, tidak mengukur Core Web Vitals, dan tidak memvalidasi seluruh hreflang atau rich result.

Batas ini sebagian besar sudah diungkapkan pada halaman audit. Tetap penting agar skor “technical” tidak disalahartikan sebagai bukti crawl/indexing: canonical merupakan preferensi/sinyal yang dapat dievaluasi Google, sitemap adalah petunjuk, dan indexing tidak dijamin. Lihat [canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization), [noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing), [cara kerja Search](https://developers.google.com/search/docs/fundamentals/how-search-works), dan [pengalaman halaman/Core Web Vitals](https://developers.google.com/search/docs/appearance/page-experience).

**Perbaikan:** pertahankan coverage dan kegagalan fetch dalam ringkasan; tambahkan robots.txt serta hreflang sebagai pemeriksaan teknis; untuk status indexing dan field experience, hubungkan alur review ke Search Console dan laporan Core Web Vitals, bukan menyimpulkan dari HTML lokal saja. Pastikan aturan canonical per tipe rute tetap sejalan dengan metadata publik dan dokumentasikan pengecualian yang sah.

## Hal yang sudah baik

- Skor editor dan audit HTML dihitung terpisah; disclaimer menyatakan skor editorial bukan skor Google atau jaminan ranking.
- Ada check yang dapat ditindaklanjuti, konteks bahasa, dan URL audit diambil dari sitemap.
- Audit menampilkan coverage/kegagalan dan mengecualikan URL gagal dari rata-rata.
- Implementasi menyadari bahwa batas karakter adalah panduan, metadata dapat memakai fallback, alt kosong bisa sesuai untuk dekoratif, dan schema check bukan validasi penuh.
- Pemindaian menolak URL lintas origin/redirect dan mengirimkan header agar pembacaan artikel audit tidak menambah view.

## Rekomendasi dan status tindak lanjut

1. **Selesai:** selaraskan test dengan rubric aktif dan tutup false-green pada repetisi/filler.
2. **Selesai sebagian:** kurangi bobot panjang dan slug, tandai pemeriksaan overlap topik sebagai prompt, serta minta tinjauan manusia untuk konteks dan kualitas. Manfaat, akurasi, originalitas, dan intent tetap tidak bisa dibuktikan oleh heuristik ini.
3. **Selesai:** pisahkan skor kesiapan editorial dan audit teknis, tampilkan jumlah pemeriksaan yang dinilai, dan batasi perbandingan pada tipe konten yang sama.
4. **Selesai sebagian:** metadata duplikat lintas URL kini dinormalisasi berdasarkan bahasa utama; status alt fallback/repetisi dan keterbatasan pemeriksaan link dijelaskan. Kualitas semantik title/description/alt, validitas tujuan link menyeluruh, canonical yang tepat untuk semua variasi rute, dan kelayakan rich result masih memerlukan konteks/manual atau alat resmi.
5. **Selesai sebagian:** audit kini membaca aturan Googlebot di `robots.txt` bila dapat diambil, mencocokkan hreflang HTML dengan sitemap dan memeriksa reciprocal sitemap. Status indeks, backlink, Core Web Vitals, dan rich result lengkap belum diukur; gunakan Search Console, PageSpeed Insights, dan validator resmi untuk langkah tersebut.

## Tindak lanjut setelah perbaikan

### Nilai kualitas fitur: 78/100

Ini adalah penilaian kualitatif dengan kategori dan bobot yang sama seperti baseline, diterapkan pada kode dan pengujian setelah perbaikan. Peningkatan mencerminkan cakupan dan perilaku yang lebih dapat dipertanggungjawabkan, bukan klaim kenaikan ranking.

| Aspek yang dinilai | Bobot | Nilai tindak lanjut | Kontribusi |
| --- | ---: | ---: | ---: |
| Kesesuaian prinsip dengan panduan Google | 25% | 82/100 | 20,5 |
| Ketepatan dan cakupan pemeriksaan | 30% | 75/100 | 22,5 |
| Kalibrasi dan keterbacaan skor | 25% | 75/100 | 18,75 |
| Bukti verifikasi otomatis | 20% | 80/100 | 16,0 |
| **Total dibulatkan** | **100%** |  | **78/100** |

Perubahan yang sudah diterapkan:

- Skor editorial dan teknis diberi label terpisah; jumlah check yang benar-benar dinilai terlihat, dan skor disarankan dibandingkan dalam tipe konten yang sama.
- Batas karakter metadata tidak mengurangi poin. Panjang tulisan menjadi panduan berbobot rendah; konten pendek yang belum bisa dianalisis ditandai untuk review.
- Pemeriksaan repetisi menilai token dan frasa pendek. Pengulangan berat menghilangkan poin isi/topik sehingga contoh filler tidak lagi lolos sebagai “Good”.
- Audit tidak mensyaratkan tepat satu H1. Pemeriksaan robots.txt, kecocokan hreflang dan resiprositas sitemap ditambahkan; check yang tidak bisa diukur ditandai untuk review, bukan diberi poin semu.
- Duplikasi title/deskripsi dinormalisasi berdasarkan bahasa utama dan whitespace, lalu skor dihitung ulang. Pengecekan internal link memakai fallback GET terbatas bila HEAD tidak didukung.
- Label check menjelaskan apa yang benar-benar diukur dan apa yang masih memerlukan tinjauan manusia.

`npm run test:seo`: **22/22 lulus**. `npm run lint` dan `npm run build` juga lulus pada verifikasi lokal. Kasus repetisi yang sebelumnya mencetak 86/100 kini mencetak **66/100 — Needs work** pada repro yang sama. Test HTML menggunakan DOM parser tiruan, sehingga hasil ini tidak menggantikan crawl storefront. Audit langsung produksi, konfigurasi Search Console, status indeks, data lapangan Core Web Vitals, kualitas terjemahan, dan validasi rich result belum dilakukan.

## Sumber panduan Google

- [Search Essentials](https://developers.google.com/search/docs/essentials)
- [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Konten people-first](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Title link](https://developers.google.com/search/docs/appearance/title-link)
- [Snippet dan meta description](https://developers.google.com/search/docs/appearance/snippet)
- [Link crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- [SEO gambar](https://developers.google.com/search/docs/appearance/google-images)
- [Structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization)
- [Blocking indexing dengan noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [Page experience dan Core Web Vitals](https://developers.google.com/search/docs/appearance/page-experience)

Memo sumber lengkap dengan implikasi terhadap rubric tersimpan di `docs/SEO-GOOGLE-GUIDANCE-2026-10-25.md`.
