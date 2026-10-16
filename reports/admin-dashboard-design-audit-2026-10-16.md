# Audit desain dashboard admin — RENDI VIRGO

**Tanggal:** 16 Oktober 2026  
**Halaman:** `/admin`  
**Status:** temuan baseline audit; rekomendasi telah diterapkan setelah persetujuan.

## Ringkasan

Dashboard sudah memiliki dasar visual yang selaras dengan identitas toko: hijau hutan, latar krem, aksen bronze, tipografi serif untuk judul, dan pola kartu yang konsisten. Navigasi dikelompokkan dengan jelas, metrik utama dipisahkan dari kondisi operasional, dan tiap grafik menyediakan label aksesibel.

Polesan paling terasa akan datang dari mengurangi pengulangan tindakan, memperpendek halaman awal, dan membuat grafik lebih mudah dibaca ketika penjualan sedikit. Perilaku di layar tablet dan ponsel juga perlu dirapikan pada header kontrol dan tombol menu yang mengambang.

## Cakupan dan bukti

- Membuka `/admin` dengan sesi admin yang aktif dan memeriksa struktur serta isi halaman yang tampil.
- Membandingkan struktur itu dengan implementasi dashboard, komponen header/kartu/grafik, dan aturan CSS responsif.
- Snapshot browser saat audit memakai rentang **30 hari**: revenue `$170.00`, 1 paid order, 6 new customers, 2 pending orders, 2 unread messages, dan 1 low-stock item. Grafik revenue/orders memiliki lima bucket mingguan; masing-masing berisi satu nilai non-zero dan empat nilai nol. Angka ini adalah data snapshot lokal saat audit, bukan klaim tentang data produksi.
- Saya dapat memeriksa aturan responsif di source, tetapi tidak memperoleh screenshot viewport tablet dan ponsel pada sesi ini. Temuan yang terkait breakpoint di bawah ditandai sebagai risiko dari source yang perlu konfirmasi visual.

## Temuan dan rekomendasi

### P2 — Tindakan operasional muncul dua kali

Bagian **Needs attention** sudah menjadi tautan untuk pending orders, unread messages, dan low stock. Tepat setelahnya, **Quick actions** mengulang tiga tujuan yang sama sebagai Review orders, Open inbox, dan Review stock. Akibatnya area awal dashboard lebih padat dan pilihan tindakan tampak lebih banyak dari yang diperlukan.

**Bukti:** `app/admin/(dashboard)/page.tsx:173–194`.

**Rekomendasi:** pertahankan **Needs attention** sebagai ringkasan masalah yang langsung membuka halaman terkait. Di **Quick actions**, tampilkan tindakan yang berbeda dan sering dipakai, seperti New product atau Create discount. Alternatifnya, gabungkan tautan tindakan ke dalam kartu perhatian dan hilangkan daftar duplikat.

### P2 — Ringkasan penting terdorong ke bawah halaman yang panjang

Setelah metrik dan tindakan, halaman memuat dua grafik, delapan order terbaru pada snapshot ini, pipeline status, daftar stok/produk lama, produk teratas, serta revenue per kategori. Delapan order dan daftar inventaris menambah panjang halaman; beberapa informasi operasional penting berpotensi jauh di bawah layar pertama.

**Bukti:** urutan bagian pada `app/admin/(dashboard)/page.tsx:196–330`; snapshot browser menampilkan delapan tautan order terbaru dan beberapa baris inventaris.

**Rekomendasi:** dahulukan urutan **metrik → perlu perhatian → tren → order terbaru**. Batasi daftar dashboard ke sekitar lima baris, sertakan tautan “View all”, dan pindahkan rincian produk lama atau kategori ke bawah. Jika pipeline tetap di halaman awal, tampilkan secara ringkas agar tidak bersaing dengan order terbaru.

### P2 — Grafik kurang informatif saat data sedikit

Grafik batang saat ini menampilkan label kategori dan batang, tanpa skala sumbu atau garis pandu. Nilai nol tidak menampilkan teks nilai. Pada snapshot 30 hari yang diperiksa, empat dari lima bucket bernilai nol, sehingga sebagian besar grafik terlihat kosong dan sulit dibedakan antara periode tanpa transaksi dengan data yang tidak tersedia.

**Bukti:** pemetaan lima bucket pada snapshot browser; `components/admin/charts.tsx:22–38`; gaya batang dan label pada `app/admin/admin.css:817–843`.

**Rekomendasi:** tampilkan garis dasar dan skala sederhana dengan satuan (USD atau jumlah order), beri label nol secara ringkas, dan sediakan keadaan “belum ada transaksi” yang jelas saat seluruh periode kosong. Untuk rentang dengan sedikit aktivitas, tambahkan kalimat ringkasan, misalnya “1 paid order this period”, supaya nilai tidak hanya bergantung pada bentuk batang.

### P2 — Header kontrol berisiko sesak di ponsel

Header dashboard menempatkan judul, subtitle, empat pilihan rentang, dan tombol Refresh dalam satu baris fleksibel. Pada breakpoint ponsel, CSS mengecilkan padding header tetapi tidak menyusun judul dan kontrol menjadi baris terpisah. Karena itu kontrol berisiko membungkus tidak rapi atau menekan area judul pada lebar kecil.

**Bukti:** `components/admin/ui.tsx:6–15`; `app/admin/(dashboard)/page.tsx:105–125`; breakpoint hanya mengubah padding header pada `app/admin/admin.css:1163–1169`.

**Rekomendasi:** pada lebar ponsel, susun judul di baris pertama dan rentang waktu/Refresh di baris kedua. Gunakan kontrol rentang yang ringkas, misalnya select atau segmented control yang dapat digeser, dan pastikan keadaan aktif tetap jelas.

### P2 — Tombol menu ponsel mengambang di atas konten

Saat layar di bawah 900px, navigasi berubah menjadi drawer, sementara tombol Menu diposisikan tetap di kiri bawah viewport. Pada halaman dashboard yang panjang, tombol itu berisiko menutupi tautan atau isi baris paling bawah saat pengguna menggulir.

**Bukti:** `components/admin/shell.tsx:198–209`; CSS drawer dan breakpoint pada `app/admin/admin.css:1128–1169`.

**Rekomendasi:** pindahkan tombol Menu ke header atas agar tata letaknya konsisten, atau berikan area aman bawah yang cukup dan posisi yang tidak menutup kontrol konten. Konfirmasi dengan viewport 390px dan 768px.

### P3 — Judul halaman belum menjadi heading utama

Teks “Dashboard” ditampilkan sebagai `div`, sedangkan bagian dashboard berikutnya memakai heading tingkat dua. Hierarki visual terlihat dari CSS, tetapi struktur heading dokumen tidak memiliki `h1` untuk nama halaman.

**Bukti:** `components/admin/ui.tsx:6–14`; judul bagian menggunakan `h2` pada `app/admin/(dashboard)/page.tsx:144–148`.

**Rekomendasi:** render judul halaman sebagai `h1` dan pertahankan gaya visual yang sekarang. Terapkan pola yang sama pada halaman admin lain melalui komponen `PageHeader`.

### P3 — Label sumbu dan rentang waktu bisa dibuat lebih eksplisit

Keterangan grafik menyebut “weekly view” atau “period view”, sementara chip memakai kode singkat seperti `30d`. Rentang tanggal lengkap baru muncul di catatan paling bawah dashboard. Pengguna perlu menghubungkan chip, grafik, dan catatan untuk memastikan periode yang sedang dilihat.

**Bukti:** `app/admin/(dashboard)/page.tsx:105–125`, `196–220`, dan catatan rentang di akhir halaman.

**Rekomendasi:** tampilkan rentang tanggal yang dipilih di dekat kontrol periode, misalnya “17 Sep–16 Okt 2026”. Pertahankan unit grafik di subjudul, dengan format yang konsisten untuk revenue dan paid orders.

## Urutan pengerjaan yang disarankan

1. Hilangkan duplikasi tindakan antara **Needs attention** dan **Quick actions**.
2. Rapikan header untuk ponsel dan pindahkan atau amankan tombol Menu agar tidak menutupi konten.
3. Perjelas baseline, nilai nol, dan keadaan data minim pada grafik.
4. Ringkas daftar panjang di dashboard dan tampilkan tanggal rentang aktif dekat filter.
5. Ubah judul halaman menjadi `h1`, lalu verifikasi ulang visual dan aksesibilitas.

## Penilaian akhir

Fondasi warna dan komponen dashboard sudah konsisten. Prioritas perbaikan adalah hierarki informasi dan responsivitas operasional; tidak diperlukan perubahan arah visual besar. Sebelum implementasi, verifikasi rekomendasi responsif pada ukuran 390px, 768px, dan desktop lebar.

## Tindak lanjut implementasi

Rekomendasi yang disetujui telah diterapkan pada dashboard:

- Quick actions kini hanya berisi tujuan yang tidak berulang dengan kartu **Needs attention**.
- Order terbaru dan inventaris dibatasi lima baris; keduanya memiliki tautan **View all**.
- Filter rentang waktu dikelompokkan, keadaan terpilih diumumkan, dan tanggal aktif tampil dekat kontrol.
- Grafik menampilkan rentang nilai, garis pandu, nilai nol untuk rentang pendek, dan pesan saat seluruh nilainya nol.
- Pada layar kecil, judul dan kontrol tersusun ulang; tombol menu dipindahkan ke bar navigasi agar tidak mengambang di atas isi.
- Judul halaman admin menggunakan `h1`.

**Pemeriksaan setelah perubahan:** membuka ulang `/admin` pada browser lokal mengonfirmasi judul `h1`, tanggal periode, dua tindakan yang tidak duplikat, serta batas lima order dan lima item inventaris. Screenshot visual pada lebar 390px dan 768px belum tersedia, dan rangkaian test tidak dijalankan.
