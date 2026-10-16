# Audit Bahasa dan Multibahasa RENDI VIRGO

**Tanggal:** 16 Oktober 2026  
**Cakupan:** storefront publik, bahasa antarmuka, konten produk/CMS, metadata, aksesibilitas, dan konfigurasi bahasa admin  
**Status:** audit source-level, read-only; tidak ada kode yang diubah

**Skala prioritas:** P1 adalah penghalang utama untuk tujuan bilingual, bukan berarti situs sedang outage; P2 adalah konsistensi operasional, aksesibilitas, atau SEO; P3 adalah penyempurnaan gaya dan pemeliharaan.

## Ringkasan

Fondasi dua bahasa sudah ada dan arahnya benar: bahasa default adalah Inggris (`en`), Indonesia (`id`) tersedia di switcher, dan kamus Indonesia harus mengikuti bentuk kamus Inggris secara TypeScript. Header dan footer juga mengambil banyak teks dari kamus yang sama.

Namun, situs **belum konsisten bilingual**. Memilih Bahasa Indonesia mengubah banyak tombol dan label, tetapi tidak selalu mengubah halaman atau data yang sedang dibaca. Halaman Tentang Kami, Kontak, Journal, beberapa bagian 404, status pesanan, dan sebagian konten produk/CMS tetap berbahasa Inggris. Pengaturan “Languages” di admin juga belum menjadi sumber konfigurasi switcher. Karena itu, kondisi sekarang lebih tepat disebut **antarmuka inti yang sebagian diterjemahkan**, bukan seluruh pengalaman toko dalam dua bahasa.

Bahasa Indonesia dapat dipahami, tetapi beberapa kalimat terasa diterjemahkan kata per kata dan beberapa istilah Inggris/teknis dibiarkan tanpa penjelasan. Untuk permintaan “bahasanya tidak hardcore”, rekomendasi utamanya adalah memakai kalimat pendek dan langsung untuk bantuan, pembayaran, pengiriman, form, serta error; istilah batu yang memang perlu tetap dipakai, tetapi diberi penjelasan sederhana.

## Kekuatan yang sudah ada

- **Bahasa default tepat.** `Language` dibatasi ke `en | id`, kamus `id` mengikuti tipe dari `en`, dan `defaultLanguage` adalah `en`. Ini membuat key terjemahan lebih sulit tertinggal saat kamus berubah. Lihat [lib/i18n.ts:1](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:1>), [lib/i18n.ts:480](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:480>), dan [lib/i18n.ts:959](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:959>).
- **Pilihan bahasa dapat ditemukan.** Switcher menampilkan “English / Bahasa Indonesia”, memakai `lang` pada masing-masing tombol dan menunjukkan pilihan aktif lewat `aria-pressed`. Pada layar kecil, switcher juga tersedia di menu mobile. Lihat [components/site-header.tsx:10](</Users/drefan/Projects/RENDI VIRGO/components/site-header.tsx:10>) dan [components/site-header.tsx:78](</Users/drefan/Projects/RENDI VIRGO/components/site-header.tsx:78>).
- **Pilihan bahasa disimpan untuk browser yang sama.** Setelah dipilih, nilai locale disimpan di `localStorage`. Lihat [components/providers.tsx:29](</Users/drefan/Projects/RENDI VIRGO/components/providers.tsx:29>) dan [components/providers.tsx:119](</Users/drefan/Projects/RENDI VIRGO/components/providers.tsx:119>).
- **Alur inti toko sudah banyak memakai kamus.** Label navigasi, sebagian besar katalog, cart, checkout, pencarian, tracking/order history, dan form permintaan retur mengambil teks dari `useCopy()`. Form retur yang baru ditambahkan sudah memakai kamus, contoh baik untuk pola implementasi berikutnya: [components/return-request-form.tsx:8](</Users/drefan/Projects/RENDI VIRGO/components/return-request-form.tsx:8>).
- **Ada pesan khusus untuk konten yang belum diterjemahkan.** Kamus bahkan memiliki `draft.title` dan `draft.body` dalam kedua bahasa. Akan tetapi, pencarian pemakaian menunjukkan pesan ini belum digunakan untuk menandai isi CMS yang masih Inggris. Lihat [lib/i18n.ts:474](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:474>) dan [lib/i18n.ts:953](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:953>).

## Temuan menurut tingkat prioritas

### P1 — Cakupan Bahasa Indonesia berhenti di sebagian antarmuka

**Bukti:**

- Halaman Tentang Kami berisi judul, deskripsi, empat nilai merek, empat langkah proses, janji pengiriman, dan CTA berbahasa Inggris yang ditulis langsung di komponen. Cerita utama juga berasal dari satu body CMS atau fallback Inggris. Lihat [components/about-content.tsx:63](</Users/drefan/Projects/RENDI VIRGO/components/about-content.tsx:63>), [components/about-content.tsx:131](</Users/drefan/Projects/RENDI VIRGO/components/about-content.tsx:131>), dan [app/(storefront)/about-us/page.tsx:22](</Users/drefan/Projects/RENDI VIRGO/app/(storefront)/about-us/page.tsx:22>).
- Halaman Kontak dan form-nya berbahasa Inggris, termasuk label input, validasi, status kirim, dan pesan sukses. Lihat [components/contact-content.tsx:20](</Users/drefan/Projects/RENDI VIRGO/components/contact-content.tsx:20>) dan [components/contact-form.tsx:27](</Users/drefan/Projects/RENDI VIRGO/components/contact-form.tsx:27>).
- Halaman daftar dan detail Journal mempunyai banyak label statis Inggris seperti “The journal”, “Read the guide”, “In this guide”, dan “Keep reading”. Teks artikel, judul, excerpt, tag, dan body juga ditampilkan langsung dari API. Lihat [app/(storefront)/blog/page.tsx:43](</Users/drefan/Projects/RENDI VIRGO/app/(storefront)/blog/page.tsx:43>) dan [halaman detail blog:120](</Users/drefan/Projects/RENDI VIRGO/app/(storefront)/blog/[slug]/page.tsx:120>).
- FAQ, Shipping & Returns, Privacy Policy, dan Terms mengambil `title` serta `body` tunggal dari CMS. Komponen tidak memilih konten berdasarkan locale. Contoh: [components/api-content-page.tsx:19](</Users/drefan/Projects/RENDI VIRGO/components/api-content-page.tsx:19>) dan [app/(storefront)/faq/page.tsx:15](</Users/drefan/Projects/RENDI VIRGO/app/(storefront)/faq/page.tsx:15>).
- Global 404 menampilkan kalimat Inggris dan Indonesia bersamaan, sedangkan 404 storefront mengambil satu bahasa dari kamus. Lihat [app/not-found.tsx:3](</Users/drefan/Projects/RENDI VIRGO/app/not-found.tsx:3>) dan [app/(storefront)/not-found.tsx:6](</Users/drefan/Projects/RENDI VIRGO/app/(storefront)/not-found.tsx:6>).

**Dampak:** orang yang memilih Bahasa Indonesia tetap harus membaca bahasa Inggris untuk informasi tentang merek, kontak, kebijakan, artikel, atau pesan global 404. Ini paling terasa pada informasi bantuan dan kebijakan yang perlu dipahami sebelum bertransaksi.

**Rekomendasi:** pindahkan teks statis About, Contact, Journal, metadata halaman, pesan 404, dan label/error form ke kamus. Untuk kebijakan dan konten editorial, jangan diam-diam menampilkan body Inggris seolah-olah berbahasa Indonesia. Tampilkan terjemahan yang sudah ditinjau; bila belum tersedia, beri penanda singkat bahwa konten hanya tersedia dalam bahasa Inggris dan sediakan tombol untuk membacanya.

### P1 — Data dinamis produk dan CMS tidak memiliki versi per bahasa

**Bukti:**

- Model Product menyimpan satu `name`, `description`, `condition`, dan relasi kategori tanpa pasangan bahasa. Lihat [api/prisma/schema.prisma:228](</Users/drefan/Projects/RENDI VIRGO/api/prisma/schema.prisma:228>).
- Model BlogPost dan Page masing-masing menyimpan satu `title`, `excerpt`/`body`, dan metadata SEO; tidak ada locale atau record terjemahan. Lihat [api/prisma/schema.prisma:565](</Users/drefan/Projects/RENDI VIRGO/api/prisma/schema.prisma:565>) dan [api/prisma/schema.prisma:586](</Users/drefan/Projects/RENDI VIRGO/api/prisma/schema.prisma:586>).
- Tipe storefront juga memuat satu string produk dan satu string artikel/halaman. Lihat [lib/storefront.ts:26](</Users/drefan/Projects/RENDI VIRGO/lib/storefront.ts:26>), [lib/storefront.ts:78](</Users/drefan/Projects/RENDI VIRGO/lib/storefront.ts:78>), dan [lib/storefront.ts:96](</Users/drefan/Projects/RENDI VIRGO/lib/storefront.ts:96>).
- Home menggunakan judul kategori, nama produk, testimonial, dan sebagian konten toko langsung dari API. Sebagian annotation editorialnya juga Inggris saja. Lihat [components/home-content.tsx:50](</Users/drefan/Projects/RENDI VIRGO/components/home-content.tsx:50>) dan [components/home-content.tsx:81](</Users/drefan/Projects/RENDI VIRGO/components/home-content.tsx:81>).

**Dampak:** switcher hanya dapat menerjemahkan teks UI yang ditulis di frontend. Nama/deskripsi produk, kategori, artikel, halaman kebijakan, testimoni, dan metadata tetap dalam bahasa apa pun yang dimasukkan admin. Ini membuat satu halaman dapat mencampur Bahasa Indonesia dengan isi Inggris tanpa penjelasan.

**Rekomendasi:** tambahkan pemodelan locale untuk konten yang memang perlu dibaca dalam dua bahasa. Minimal, produk/kategori perlu nama dan deskripsi per locale; artikel/halaman perlu judul, ringkasan, body, dan metadata SEO per locale. Fakta yang sama di kedua bahasa—SKU, ukuran, berat, harga, dan nama wilayah—tetap satu sumber. Di admin, tampilkan tab Bahasa Inggris/Bahasa Indonesia, status terjemahan, dan status publikasi masing-masing bahasa. Beri fallback yang eksplisit, bukan fallback sunyi.

### P2 — Pengaturan bahasa admin terlihat aktif tetapi tidak mengendalikan situs

**Bukti:** nilai default `store.languages` adalah `en, id`; pengaturan admin dapat menyunting dan menyimpan daftar itu. Lihat [api/src/settings/settings.service.ts:14](</Users/drefan/Projects/RENDI VIRGO/api/src/settings/settings.service.ts:14>) dan [app/admin/(dashboard)/settings/page.tsx:183](</Users/drefan/Projects/RENDI VIRGO/app/admin/(dashboard)/settings/page.tsx:183>). `PublicSettings` memang memuat `languages`, tetapi switcher frontend hanya memiliki tombol tetap untuk `en` dan `id`, dan provider tidak memakai daftar bahasa tersebut. Lihat [lib/storefront.ts:144](</Users/drefan/Projects/RENDI VIRGO/lib/storefront.ts:144>) dan [components/site-header.tsx:10](</Users/drefan/Projects/RENDI VIRGO/components/site-header.tsx:10>).

**Dampak:** admin dapat mengubah daftar bahasa tanpa mengubah pilihan yang terlihat di situs. Ini berisiko menimbulkan harapan yang salah dan menyulitkan pengelolaan locale.

**Rekomendasi:** jadikan konfigurasi itu authoritative: validasi daftar terhadap locale yang benar-benar didukung, lalu gunakan untuk membuat switcher dan fallback. Jika pengaturan belum memiliki efek nyata, sembunyikan atau jadikan read-only sampai implementasi locale siap.

### P2 — Bahasa pilihan belum tersedia pada render pertama atau metadata

**Bukti:** root layout selalu mengirim `<html lang="en">`; metadata title, description, Open Graph, dan Twitter juga hanya Inggris. Lihat [app/layout.tsx:4](</Users/drefan/Projects/RENDI VIRGO/app/layout.tsx:4>) dan [app/layout.tsx:26](</Users/drefan/Projects/RENDI VIRGO/app/layout.tsx:26>). Bahasa tersimpan baru dibaca di effect browser, lalu atribut `document.documentElement.lang` baru diubah di effect berikutnya. Lihat [components/providers.tsx:64](</Users/drefan/Projects/RENDI VIRGO/components/providers.tsx:64>) dan [components/providers.tsx:119](</Users/drefan/Projects/RENDI VIRGO/components/providers.tsx:119>).

**Dampak:** pengunjung yang sebelumnya memilih Indonesia dapat menerima HTML awal dalam Inggris, lalu melihat teks berganti setelah halaman aktif. Pembaca layar dan mesin pencari juga tidak mendapat locale Indonesia yang benar dari HTML awal. Karena pilihan berada di `localStorage`, bahasa tidak tercermin pada URL dan sulit dibagikan.

**Rekomendasi:** simpan locale pada cookie yang dapat dibaca server agar render pertama, `html lang`, dan metadata mengikuti pilihan. Jika konten Indonesia perlu ditemukan dari pencarian dan punya URL yang dapat dibagikan, gunakan URL per bahasa—misalnya `/id/...` dengan Inggris sebagai URL default—serta canonical dan `hreflang` per versi. Pilih strategi URL sebelum migrasi konten agar terjemahan tidak perlu dipindah dua kali.

### P2 — Status, tanggal, dan respons API dapat kembali ke Inggris

**Bukti:** halaman tracking dan riwayat menerjemahkan label umum lewat kamus, tetapi status Order/Payment memakai `labelize()` langsung dari enum seperti `Cancelled`, `Paid`, atau `Pending`. Tanggal memakai locale browser (`toLocaleString()` tanpa locale yang dipilih). Lihat [components/order-tracking.tsx:40](</Users/drefan/Projects/RENDI VIRGO/components/order-tracking.tsx:40>), [components/order-tracking.tsx:164](</Users/drefan/Projects/RENDI VIRGO/components/order-tracking.tsx:164>), dan [components/order-tracking.tsx:220](</Users/drefan/Projects/RENDI VIRGO/components/order-tracking.tsx:220>). Form kontak juga menampilkan pesan backend mentah atau fallback Inggris untuk error, validasi, dan sukses. Lihat [components/contact-form.tsx:27](</Users/drefan/Projects/RENDI VIRGO/components/contact-form.tsx:27>) dan [components/contact-form.tsx:45](</Users/drefan/Projects/RENDI VIRGO/components/contact-form.tsx:45>).

**Dampak:** bagian yang paling penting saat terjadi masalah pembayaran atau pengiriman dapat berganti bahasa di tengah halaman Indonesia.

**Rekomendasi:** petakan enum status ke key terjemahan yang jelas; jangan menampilkan enum internal. Format tanggal, angka, dan mata uang menggunakan locale aktif. Untuk error API, ubah kode error menjadi pesan lokal di frontend atau kembalikan kode stabil yang dapat dipetakan ke kamus—jangan menjadikan kalimat server berbahasa Inggris sebagai teks final.

### P3 — Terjemahan Indonesia memiliki beberapa calque dan istilah yang terlalu teknis

Kamus sudah memuat banyak frasa yang wajar, tetapi beberapa contoh terdengar harfiah atau mencampur istilah Inggris:

- “Batu alami dengan rasa tempat” ([lib/i18n.ts:606](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:606>)) terasa seperti terjemahan kata per kata. Alternatif: **“Batu alam pilihan dari berbagai daerah di Indonesia.”**
- “cabochon poles, material mentah” ([lib/i18n.ts:607](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:607>) terasa seperti catatan internal. Alternatif: **“batu cabochon yang sudah dipoles, batu mentah, dan manik-manik.”** Pada kemunculan pertama, jelaskan “cabochon” sebagai batu yang dipoles dengan permukaan membulat.
- “Inklusi menyerupai lumut. Warna vulkanik.” dan “Dari potongan pertama perajin” ([lib/i18n.ts:571](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:571>) dan [lib/i18n.ts:573](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:573>)) terdengar teknis/kurang natural. Alternatif: **“Pola mirip lumut dan warna khas alam. Setiap batu memiliki pola yang berbeda.”** dan **“Dari batu yang dipoles para perajin hingga temuan baru para kolektor.”**
- “Wishlist”, “Checkout”, “Natural”, dan “Treated” tetap tampil dalam kamus Indonesia ([lib/i18n.ts:498](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:498>), [lib/i18n.ts:557](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:557>), [lib/i18n.ts:799](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:799>)). Gunakan **“Daftar favorit”**, **“Lanjut ke pembayaran”**, **“Alami”**, dan **“Sudah melalui perlakuan”**; jelaskan jenis perlakuan pada detail kondisi batu.
- “Dari atelier” dan “Override admin” ([lib/i18n.ts:522](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:522>) dan [lib/i18n.ts:930](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:930>)) sebaiknya menjadi **“Dari studio kami”** dan—bila label tarif itu memang dilihat pembeli—**“Tarif khusus toko”**.
- “Kekerasan Mohs” ([lib/i18n.ts:780](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:780>)) dapat dibuat lebih jelas sebagai **“Kekerasan (skala Mohs)”**.

Inggris juga memakai beberapa istilah kolektor seperti *provenance*, *inclusion*, dan *cabochon*. Jangan menghapus istilah yang membantu pembeli menilai batu; jelaskan dengan kata umum saat pertama kali muncul. Frasa puitis seperti “A little piece of earth” dapat tetap dipakai di area brand. Sebaliknya, tombol, instruksi, pembayaran, kebijakan, serta pesan error sebaiknya lugas.

**Rekomendasi:** buat pedoman bahasa singkat untuk kedua locale: satu gagasan per kalimat, gunakan kata kerja umum, hindari frasa promosi pada instruksi, pertahankan nama teknis hanya jika berguna, lalu jelaskan istilah itu saat pertama muncul. Gunakan glosarium dua arah agar istilah seperti *cabochon*, *treated*, *return*, dan *shipping* tidak berganti-ganti terjemahan.

### P3 — Sumber terjemahan terpecah dan format Inggris belum sepenuhnya seragam

`OwnerStory` menyimpan kamus `en` dan `id` sendiri di komponen, terpisah dari kamus utama. Polanya berfungsi, tetapi membuat peninjauan dan konsistensi lebih sulit. Lihat [components/owner-story.tsx:12](</Users/drefan/Projects/RENDI VIRGO/components/owner-story.tsx:12>). Kamus utama yang panjang masih memberi kontrak tipe yang baik; pemecahan ke beberapa berkas per domain dapat dipertimbangkan kemudian selama pemeriksaan kesamaan key tetap dipertahankan.

Inggris banyak memakai ejaan UK seperti “colour” dan “jewellers”, sementara format harga memakai `en-US` dan format tanggal artikel memakai `en-GB`. Lihat [lib/i18n.ts:92](</Users/drefan/Projects/RENDI VIRGO/lib/i18n.ts:92>), [lib/catalog.ts:67](</Users/drefan/Projects/RENDI VIRGO/lib/catalog.ts:67>), dan [components/page-body.tsx:49](</Users/drefan/Projects/RENDI VIRGO/components/page-body.tsx:49>). Ini tidak otomatis salah—harga USD memang boleh memakai format yang lazim untuk USD—tetapi aturan format perlu dibuat eksplisit dan tanggal harus mengikuti bahasa yang dipilih.

**Rekomendasi:** tetapkan UK English sebagai gaya editorial Inggris karena sudah dominan pada ejaan dan format tanggal. Untuk Indonesia gunakan `id-ID`. Pastikan format tanggal dan angka mengikuti locale aktif; tentukan dengan sengaja apakah USD tetap memakai pemisah `en-US` demi kebiasaan pembeli internasional.

Catatan kecil untuk komunikasi berikutnya: model pelanggan newsletter sudah punya kolom `locale`, tetapi form footer hanya mengirim email dan sumber pendaftaran. Lihat [api/prisma/schema.prisma:681](</Users/drefan/Projects/RENDI VIRGO/api/prisma/schema.prisma:681>) dan [components/site-footer.tsx:38](</Users/drefan/Projects/RENDI VIRGO/components/site-footer.tsx:38>). Jika newsletter nantinya dikirim dalam dua bahasa, simpan locale pilihan pengguna saat pendaftaran.

## Cakupan halaman

- **Header/footer dan sebagian besar antarmuka toko:** cakupan terjemahan relatif baik melalui kamus. Identitas merek, nama sosial, alamat, nama produk, dan data API tetap mengikuti sumber aslinya.
- **Beranda:** sebagian besar judul/CTA menggunakan kamus. Tetapi annotation “Moss agate · A landscape within”, kategori, nama produk, testimoni, dan data toko tidak otomatis diterjemahkan. Lihat [components/home-content.tsx:50](</Users/drefan/Projects/RENDI VIRGO/components/home-content.tsx:50>) dan [components/home-content.tsx:77](</Users/drefan/Projects/RENDI VIRGO/components/home-content.tsx:77>). `OwnerStory` sendiri sudah punya dua bahasa, tetapi memakai kamus terpisah.
- **Shop, kategori, detail produk:** label/filter/condition note memakai kamus; nama kategori, nama/deskripsi produk, asal, dan data katalog berasal dari satu set nilai API. Kondisi “Natural/Treated/Dyed” sudah memiliki kunci Indonesia, namun terjemahannya masih Inggris.
- **Cart, checkout, search, wishlist, tracking, order history, form retur:** banyak kontrol dan pesan UI mengambil dari kamus. Status enum, pesan error backend, nama/isi produk, dan beberapa format tanggal belum mengikuti pilihan bahasa.
- **About, Contact, Blog/Journal, FAQ, Shipping & Returns, Privacy Policy, Terms, global 404:** banyak atau sebagian besar kontennya masih satu bahasa Inggris, dengan pengecualian fallback 404 global yang mencampur Inggris dan Indonesia.
- **Admin:** form pengelolaan dan teks dashboard berbahasa Inggris. Ini bisa tetap menjadi bahasa internal terpisah, tetapi perlu dinyatakan sebagai cakupan berbeda jika janji bilingual hanya untuk pelanggan.

## Rekomendasi pelaksanaan

1. **Tentukan kontrak bahasa produk.** Tegaskan bahwa situs pelanggan mendukung `en` dan `id`, Inggris menjadi default, dan Bahasa Indonesia menjadi alternatif. Tentukan apakah admin ikut dalam cakupan atau tetap Inggris.
2. **Rapikan konten yang terlihat sebelum memperluas fitur.** Lokalisasi About, Contact, Journal shell, halaman kebijakan, form kontak, status/error, global 404, dan metadata yang terlihat pembeli. Gunakan Bahasa Indonesia natural; pastikan peninjau memahami konteks batu dan transaksi.
3. **Tambahkan locale pada konten dinamis.** Rancang terjemahan produk/kategori/blog/halaman di CMS, termasuk ringkasan dan metadata SEO. Buat status “belum diterjemahkan”, “perlu ditinjau”, dan “siap tayang” per bahasa.
4. **Hilangkan ketergantungan render pada `localStorage` saja.** Gunakan cookie untuk mempertahankan preferensi saat server membuat HTML. Jika visibilitas pencarian penting bagi dua bahasa, sediakan URL locale dan canonical/`hreflang` yang berbeda.
5. **Satukan kontrak dan gaya bahasa.** Pindahkan copy `OwnerStory` ke sistem terjemahan yang sama, pertahankan pemeriksaan tipe key, dan susun glosarium sederhana. Pastikan daftar bahasa admin hanya menampilkan bahasa yang betul-betul aktif.
6. **Lakukan QA per bahasa, bukan hanya cek key.** Periksa beranda, katalog, detail produk, cart/checkout, kontak, retur, tracking, kebijakan, artikel, metadata, halaman error, serta pesan email/notifikasi. Verifikasi bahwa tidak ada status/error Inggris yang tersisa di halaman Indonesia dan bahwa HTML memakai `lang` yang benar.

## Batas audit

Audit ini membaca source dan model data; saya tidak menjalankan situs dalam browser dengan kedua locale, memeriksa isi data produksi/API, atau meminta review penutur asli. Karena itu, temuan teks hard-coded dapat diverifikasi dari source, sedangkan kualitas setiap deskripsi produk/testimoni dan tampilan runtime masih perlu QA konten saat implementasi.

Lensa desain modul yang dipakai mengikuti **Matt Pocock codebase-design**: memeriksa batas antara kamus UI, konten dinamis, dan pemilik state locale. Temuan utamanya adalah batas kamus frontend sudah jelas, tetapi locale belum menjadi kontrak bersama antara frontend, CMS/API, SSR, dan metadata.
