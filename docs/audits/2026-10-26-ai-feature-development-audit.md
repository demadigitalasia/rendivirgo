# Audit dan Rekomendasi Pengembangan AI RENDI VIRGO

**Tanggal:** 26 Oktober 2026
**Cakupan:** Fitur AI yang ditemukan pada aplikasi dan batas integrasi AI/SEO.
**Metode:** Tinjauan statis kode dan dokumentasi resmi OpenRouter serta Google Search Console. Tidak mengirim prompt ke provider, tidak memeriksa konfigurasi akun OpenRouter produksi, dan tidak menjalankan test.

## Ringkasan

Fitur AI yang tersedia saat ini adalah **asisten admin untuk membuat draf copy berbahasa Inggris**: deskripsi produk/kategori, artikel, halaman, homepage, banner, dan metadata SEO. Satu koneksi OpenRouter menyediakan model teks yang dipilih admin. Draf perlu ditinjau dan disimpan manual; model tidak menerbitkan konten atau mengubah status publikasi.

Skor dan checklist SEO yang terlihat di editor dihitung oleh aturan lokal deterministik. AI hanya membantu menyusun metadata/copy; audit SEO bukan analisis AI, bukan skor Google, dan tidak memakai data Search Console. Tidak ditemukan chatbot customer, rekomendasi produk AI, pencarian semantik, atau pengolahan gambar AI pada cakupan kode yang diperiksa.

Fondasi kontrolnya baik: hanya admin yang dapat memakai API, payload dibatasi, konteks dipilih berdasarkan jenis konten, output harus memenuhi skema, penggunaan dicatat tanpa isi prompt, dan request meminta routing ke endpoint ZDR serta mengecualikan provider yang mengizinkan pengumpulan data. Namun kontrol privasi itu tidak menjadikan proses sepenuhnya lokal: OpenRouter meneruskan input ke provider model, dan praktik retensi provider berbeda. Ada satu masalah implementasi yang perlu dibereskan sebelum memperluas fitur: **draf AI homepage menampilkan pilihan hero title/subtitle, tetapi handler Apply tidak menyimpan kedua field tersebut.**

## Fitur dan alur yang benar-benar ada

1. Admin memberi konteks yang sudah ada, memilih memakai konten lengkap atau judul plus brief, lalu meminta draf. Brief maksimal 4.000 karakter; konteks request maksimal 24.000 karakter. Server menyaring ulang field yang boleh diteruskan dan menolak sumber kosong.
2. Server mengirim prompt ke `https://openrouter.ai/api/v1/chat/completions`. Model yang dipilih di Admin Settings harus mendukung teks dan structured output. Model default di kode adalah `openai/gpt-4.1-mini` melalui OpenRouter; admin dapat memilih model kompatibel lain.
3. Hasil berupa field JSON dengan batas karakter, lalu divalidasi lagi oleh server. UI menampilkan pratinjau, pemilihan field, edit, Apply/Discard/Undo, dan pengguna tetap harus menyimpan form secara manual.
4. Jenis draf yang aktif: `product`, `category`, `blog`, `page`, `home`, `banner`, serta `seo` yang menghasilkan meta title dan meta description saja. Semua output dipaksa ke bahasa Inggris.
5. API mencatat admin, jenis, model, hasil, durasi, panjang input, token dan biaya yang dilaporkan provider, serta IP/user-agent. Prompt dan hasil tidak ditulis ke audit log aplikasi.

**Bukti kode:** `api/src/content/content-copy.service.ts:6-26, 71-95, 97-139`; `components/admin/ai-draft.tsx:35-67`; titik pemakaian di `components/admin/product-form.tsx:617-622`, `app/admin/(dashboard)/categories/page.tsx:421-423`, `app/admin/(dashboard)/content/blog/[id]/page.tsx:265-275`, `app/admin/(dashboard)/content/pages/[id]/page.tsx:191-200`, `app/admin/(dashboard)/content/home/page.tsx:221-231`, `app/admin/(dashboard)/content/banners/page.tsx:257-259`, dan `components/admin/seo-panel.tsx:70-71, 97`.

## Temuan dan risiko

| Prioritas | Temuan | Dampak dan bukti |
|---|---|---|
| **P2** | **AI homepage tidak menerapkan semua field yang ditawarkan.** Output `home` mencakup `heroTitle` dan `heroSubtitle`, dan pratinjau mengizinkan memilihnya, tetapi callback halaman homepage hanya menerapkan `ownerBio`, `metaTitle`, dan `metaDescription`. | Pilihan Apply pada hero dapat terlihat berhasil tetapi tidak mengubah form. Rapikan kontrak field-preview dan handler supaya setiap field yang bisa dipilih benar-benar diterapkan. `api/src/content/content-copy.service.ts:13-14`; `app/admin/(dashboard)/content/home/page.tsx:221-223`. |
| **P1** | **Larangan mengirim data pribadi belum ditegakkan server.** UI memperingatkan agar tidak mengirim data customer pribadi, tetapi brief bebas hingga 4.000 karakter dan beberapa field konteks diteruskan tanpa pemeriksaan PII. | Admin dapat tanpa sengaja mengirim nama, kontak, atau data lain dalam brief/konten ke OpenRouter. Pembatasan field mengurangi paparan, tetapi bukan deteksi nilai sensitif. Pertahankan larangan di UI, tambahkan pemeriksaan/redaksi server untuk pola sensitif dan batasi konteks ke data produk/editorial yang memang dibutuhkan. `components/admin/ai-draft.tsx:54`; `api/src/content/content-copy.service.ts:18-36, 79-80`. |
| **P1** | **Routing privat adalah kontrol transit, bukan jaminan pemrosesan lokal.** Request menetapkan `data_collection: "deny"` dan `zdr: true`, tetapi input tetap diteruskan ke endpoint model yang memenuhi routing tersebut. | Kebijakan tiap provider dan endpoint tetap relevan; belum ada bukti audit akun, endpoint efektif, kontrak, atau kebijakan provider yang benar-benar dipakai di produksi. OpenRouter menjelaskan bahwa input dikirim ke provider model dan praktik retensi/pemakaian data berbeda; parameter ZDR/data-collection membatasi routing, bukan menghapus pemrosesan pihak ketiga. Sebelum memakai data sensitif, cek privasi provider dan konfigurasi akun yang berlaku. [`OpenRouter Privacy Policy`](https://openrouter.ai/privacy/), [`ZDR dan kontrol routing`](https://openrouter.ai/blog/insights/zero-data-retention/). |
| **P2** | **Validasi bentuk output tidak memverifikasi kebenaran fakta.** Prompt melarang klaim yang tidak didukung, tetapi validasi server hanya menjamin field berupa teks, tidak kosong, dan tidak melebihi batas karakter. | Model masih dapat membuat klaim geologi, asal, treatment, manfaat, atau SEO yang keliru. Preview dan persetujuan manual sudah tepat; tambahkan review fakta sebelum publish dan jangan menyebut hasil sebagai terverifikasi. `api/src/content/content-copy.service.ts:54-64, 84-95`; `components/admin/ai-draft.tsx:61-67`. |
| **P2** | **AI usage berguna untuk pemantauan, tetapi bukan pembatas biaya.** Halaman menampilkan jumlah request, token dan biaya provider yang dilaporkan, serta mengingatkan bahwa biaya bisa tidak lengkap dan penggunaan di atas 5.000 record hanya disampel. | Tidak ada hard cap pada aplikasi atau alert pengeluaran yang dibuktikan oleh source. Dashboard OpenRouter perlu menetapkan limit nyata; lanjutkan dengan alert dan batas request/biaya operasional. [`settings.service.ts`](api/src/settings/settings.service.ts:275-326); `app/admin/(dashboard)/settings/page.tsx:738-766`. |
| **P2** | **Rotasi `SESSION_SECRET` dapat membuat API key AI tersimpan tidak dapat dibaca.** Kunci enkripsi diturunkan langsung dari secret sesi dan dekripsi gagal jika secret berubah. | Rotasi secret operasional dapat memutus AI sampai key OpenRouter dimasukkan ulang. Pisahkan key enkripsi dari secret sesi dan beri versi agar rotasi terencana dapat mendekripsi lalu mengenkripsi ulang key. `api/src/settings/settings.service.ts:483-525`. |
| **P2** | **Usage dashboard bergantung pada audit log best-effort.** `AuditService.log` menangkap kegagalan tulis lalu hanya memberi peringatan, sementara rekap AI menghitung request/token/biaya dari baris audit. | Request AI tetap dapat selesai saat database gagal mencatat pemakaian; angka dashboard dapat kurang dari pemakaian sebenarnya. Pertahankan agar kegagalan logging tidak membuka prompt atau menggagalkan konten, tetapi pantau error audit dan gunakan metrik pemakaian terpisah yang tahan kehilangan untuk biaya. `api/src/audit/audit.service.ts:21-37`; `api/src/settings/settings.service.ts:275-326`. |
| **P2** | **Insight SEO belum memakai performa pencarian aktual.** `lib/seo-analysis.ts` menghitung checklist dari panjang/struktur/teks lokal; `components/admin/seo-panel.tsx` menyebutnya editorial checklist, bukan skor ranking. Tidak ditemukan integrasi Search Console pada fitur yang diperiksa. | Saran AI belum dapat menjawab query atau halaman mana yang punya impresi/CTR rendah. Search Console API menyediakan data klik, impresi, CTR, posisi dan dimensi query/page, dengan batas bahwa API tidak selalu mengembalikan seluruh baris data. Hubungkan data itu sebelum membuat rekomendasi yang mengklaim berbasis performa. [`Google Search Analytics API`](https://developers.google.com/webmaster-tools/v1/searchanalytics/query). |

## Kontrol yang sudah baik

- AdminGuard diterapkan global di API; route generator juga memiliki throttle khusus (umumnya 10 request/menit dan blog 5/menit), di samping throttle global default 300 request/menit. `api/src/app.module.ts:29-59`; `api/src/content/content-copy.controller.ts:22-30`; `api/src/content/blog.controller.ts:46-54`.
- Konteks dipilih dengan allowlist per jenis konten; panjang brief dan request dibatasi pada DTO. API mengirim field terkait konten/editorial dan bukan order/customer profile.
- Prompt meminta model menganggap konteks sebagai data, membatasi klaim dan output ke English. Server memakai strict JSON schema dan memvalidasi output kembali; status publikasi tidak termasuk field yang sah.
- Key dashboard disimpan terenkripsi AES-256-GCM, dengan kunci turunan dari `SESSION_SECRET` stabil; key tidak dikembalikan di UI. Env key menjadi fallback. `api/src/settings/settings.service.ts:329-340, 483-525`; `api/src/settings/settings.controller.ts:19-55`.
- Fitur tidak melakukan generate otomatis. UI meminta draf ditinjau dan disimpan manual; ada perlindungan snapshot terhadap perubahan sumber saat request berjalan.
- OpenRouter menyatakan prompt/completion API tidak dicatat oleh OpenRouter secara default, tetapi request diteruskan ke provider model. Itu tidak menggantikan pengecekan kebijakan provider yang dipilih. [`OpenRouter Support`](https://openrouter.ai/support/); [`Privacy Policy`](https://openrouter.ai/privacy/).

## Rekomendasi pengembangan bertahap

### Tahap 0 — Perbaiki kontrak dan batas aman

1. Perbaiki mismatch penerapan AI homepage; pastikan setiap field yang dapat dicentang diterapkan sesuai perilaku preview.
2. Terapkan minimisasi input dan pemeriksaan data sensitif di server. Tetap jangan mengirim order, customer account, email, nomor telepon, atau data transaksi ke generator copy. Jika kontrol PII OpenRouter dipertimbangkan, verifikasi dulu bahwa fitur tersebut tersedia di plan/akun; dokumentasi guardrails menyebut kemampuan ini pada level organisasi/API key, bukan fitur yang diasumsikan aktif. [`OpenRouter Guardrails`](https://openrouter.ai/docs/guides/features/guardrails/overview).
3. Tentukan model/provider yang disetujui, tinjau kebijakan privasi endpoint, atur hard spend limit/alert di OpenRouter, dan buat prosedur rotasi key enkripsi yang tidak bergantung pada `SESSION_SECRET`. Nilai “ZDR aktif” jangan diterjemahkan menjadi “data tidak keluar dari layanan”.
4. Pantau kegagalan penulisan audit dan pisahkan metrik biaya yang harus lengkap dari log operasional best-effort.
5. Konsolidasikan alur generator lama dan baru agar preview, Apply/Undo, aturan field, rate limit, serta pencatatan penggunaan konsisten. Saat ini controller legacy produk/kategori/blog membungkus service yang sama, sementara workflow UI utama sudah memakai `AiDraft`.

### Tahap 1 — Asisten editorial yang berlandaskan data katalog

- Tambahkan fakta terstruktur yang disetujui untuk produk/batu (jenis, lokasi asal terverifikasi, kondisi, treatment yang diketahui, berat/ukuran, batas stok), dan hanya masukkan fakta yang relevan ke prompt.
- Beri indikator sumber fakta untuk editor, tandai bagian yang tidak punya sumber, dan minta editor memeriksa fakta serta klaim sebelum simpan/publish. Tetap human-in-the-loop; jangan izinkan publish otomatis.
- Ukur kualitas berdasarkan waktu penyuntingan, draft yang diterima/diubah/ditolak, koreksi fakta, tingkat kegagalan, latensi dan biaya per jenis konten—bukan hanya jumlah generasi.
- Tambahkan panduan penggunaan per jenis konten: copy produk berbasis atribut, artikel berbasis outline/fakta, banner ringkas, metadata SEO akurat dan unik. Jangan memakai jumlah kata atau checklist sebagai sasaran ranking.

### Tahap 2 — Rekomendasi SEO berbasis Search Console

- Hubungkan Search Console secara read-only melalui otorisasi admin. Ambil query/page, negara/perangkat, clicks, impressions, CTR dan average position untuk periode yang dipilih; API punya batas kelengkapan baris, sehingga jelaskan data sebagai sampel performa.
- Tampilkan metrik mentah dan periode di UI. Gunakan AI untuk merangkum peluang/editorial next step, bukan menyatakan perubahan copy akan menaikkan ranking.
- Tambahkan tautan ke halaman sumber, freshness timestamp, dan preview perubahan. Lindungi token OAuth dan jangan memasukkan query atau data akun yang tidak perlu ke provider.

### Tahap 3 — AI customer-facing hanya setelah knowledge base siap

Jika dibutuhkan, mulai dari pencarian/pemandu produk berbasis katalog dan artikel publik yang telah dikurasi; jawab dengan tautan dan inventori aktual, beri fallback ke customer service bila tidak yakin. Jangan mulai dari agen yang mengubah harga, order, stok, atau memberikan saran kesehatan/penyembuhan batu. Rilis bertahap dan ukur jawaban tanpa sumber, pertanyaan yang gagal, eskalasi, dan kepuasan sebelum membuka ke semua pengunjung.

## Prioritas yang disarankan

Urutkan pekerjaan: **(1)** perbaiki handler homepage; **(2)** tegaskan dan tegakkan aturan data yang boleh dikirim serta provider yang disetujui; **(3)** tambah grounding dan review fakta pada draf CMS; **(4)** baru bangun SEO yang memakai Search Console; **(5)** evaluasi pengalaman AI customer setelah data katalog dan prosedur eskalasi siap.

## Referensi kode utama

- `api/src/content/content-copy.service.ts` — field, allowlist, prompt, provider request, validasi, usage audit.
- `api/src/content/content-copy.controller.ts`, `api/src/catalog/products.controller.ts`, `api/src/catalog/categories.controller.ts`, `api/src/content/blog.controller.ts` — API admin, DTO dan throttle.
- `components/admin/ai-draft.tsx`, `components/admin/seo-panel.tsx` — prompt UI, preview/apply dan AI metadata.
- `api/src/settings/settings.service.ts`, `api/src/settings/settings.controller.ts`, `app/admin/(dashboard)/settings/page.tsx` — konfigurasi key/model, enkripsi, usage.
- `lib/seo-analysis.ts` — skor editorial lokal yang deterministik.
