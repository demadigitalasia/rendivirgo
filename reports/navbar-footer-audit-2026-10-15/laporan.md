# Audit navbar dan footer — RENDI VIRGO

Tanggal: 15 Oktober 2026, WIB. Objek: storefront lokal di http://localhost:3001/. Status: pemeriksaan dan rekomendasi; kode situs tidak diubah dalam audit ini.

## Kesimpulan

Palet krem dan hijau hutan, logo, ikon garis, serta garis penanda menu aktif sudah mendukung karakter galeri batu alam. Konsistensi berikutnya paling terbantu oleh tipografi yang lebih terbaca, penamaan yang sama, dan footer dengan pembagian informasi yang lebih jelas. Dua masalah penggunaan perlu didahulukan: tautan legal tertutup tombol chat pada desktop dan urutan fokus menu ponsel yang melewati tautan menu.

## Cara pemeriksaan dan batasnya

Pemeriksaan visual langsung, pengukuran ukuran elemen dari halaman yang tampil, pengujian menu dengan keyboard, serta peninjauan komponen dan aturan tampilan. Lebar yang digunakan mencakup desktop sekitar 1229–1280 piksel, ponsel 390 piksel, dan layar sempit 320 piksel. Pilihan English dan Bahasa Indonesia juga diperiksa. Tidak ada transaksi, pengiriman pesan, atau pendaftaran newsletter yang dilakukan. Audit ini tidak menyatakan kelulusan aksesibilitas secara menyeluruh, hasil konversi penjualan, atau hasil pengujian pada perangkat fisik.

## Temuan prioritas tinggi

### 1. Tombol WhatsApp menutupi Privacy dan Terms pada desktop

Bukti: pada viewport 1280 × 900, halaman di posisi paling bawah, kedua tautan legal beririsan dengan area tombol chat. Tombol chat berada pada x sekitar 1108–1245 dan y 832–880; tautan legal berada pada x sekitar 1148–1217 dan y 860–874. Tautan legal pada footer ponsel 390 piksel tidak beririsan dalam pemeriksaan yang dilakukan.

Dampak: akses ke kebijakan dan syarat penggunaan terhalang tombol mengambang.

Rekomendasi: buat ruang aman bagi tombol chat pada bagian bawah halaman, atau pindahkan tombol naik saat footer memasuki viewport. Ruang aman harus mempertimbangkan tinggi tombol, jarak dari tepi, dan inset perangkat. Uji ulang kedua tautan pada lebar desktop dan setelah penggantian bahasa.

Bukti visual: [footer desktop](evidence/footer-desktop.jpg).

### 2. Fokus keyboard melewati menu ponsel yang sedang terbuka

Bukti: setelah membuka menu pada lebar 390 piksel lalu menekan Tab dari tombol Close menu, fokus berpindah ke Explore the Collection di isi halaman; menu masih terbuka. Escape berhasil menutup menu dan mengembalikan fokus ke tombol Open menu.

Dampak: pengguna keyboard tidak langsung mencapai tautan menu yang baru dibuka.

Rekomendasi: arahkan fokus ke tautan pertama saat menu dibuka dan susun urutan Tab mengikuti tampilan. Pertahankan pengembalian fokus saat ditutup. Jika menu kelak dijadikan drawer modal dengan latar tertutup, terapkan perilaku dialog dan pembatasan fokus yang sesuai. Dropdown nonmodal tidak perlu diperlakukan sebagai modal.

## Temuan konsistensi dan polesan

### 3. Teks antarmuka terlalu kecil dibandingkan isi utama

Hasil pengukuran: tautan navbar desktop 12,48 piksel; tautan footer 12,8 piksel; teks baris legal 9,92 piksel; input newsletter 12 piksel. Pada layar 320 piksel, pengumuman memakai 8 piksel dan pilihan bahasa 9,6 piksel.

Rekomendasi: navbar dan tautan footer sekitar 14 piksel; isi footer 14 piksel; judul kelompok 12 piksel; legal dan pengumuman 12 piksel; input pada ponsel 16 piksel. Angka tersebut merupakan usulan skala desain, bukan batas ukuran teks yang diwajibkan WCAG. Pertahankan perbedaan serif untuk judul editorial dan sans-serif untuk navigasi.

### 4. Penamaan dan pengelompokan belum seragam

Navbar berbahasa Inggris menggunakan Blog; footer menggunakan Journal untuk tujuan yang sama. Kelompok Follow memuat email, sedangkan Contact berada di Help.

Rekomendasi: gunakan Journal di navbar dan footer untuk versi Inggris, Jurnal pada versi Indonesia. Gunakan kelompok footer Explore, Customer Care, dan Connect; email dan media sosial masuk Connect. Pastikan pilihan nama final sama di seluruh tempat.

### 5. Hierarki footer berat di kolom kiri

Logo, deskripsi merek, judul newsletter, penjelasan, dan formulir bertumpuk dalam satu kolom. Kolom lain lebih ringan. Pada ponsel 390 piksel, tinggi footer yang terukur sekitar 920 piksel. Panjang tersebut bukan kesalahan dengan sendirinya, tetapi membuat informasi bantuan membutuhkan lebih banyak guliran.

Rekomendasi: pisahkan newsletter menjadi baris tersendiri pada desktop, dengan pengantar di kiri dan formulir di kanan. Di bawahnya, gunakan kolom merek, Explore, Customer Care, dan Connect. Pada ponsel, susun merek dan newsletter diikuti dua kolom tautan; pertahankan Shipping, Track Order, dan Contact mudah ditemukan. Hindari menambah informasi yang belum tersedia atau logo pembayaran yang belum dipastikan aktif.

### 6. Navbar bisa lebih ringkas dan seimbang

Header desktop terukur sekitar 130 piksel termasuk pengumuman. Lebar logo 220 piksel dengan rasio gambar 3:1 ikut menentukan tinggi bar utama, bukan hanya aturan tinggi minimum.

Rekomendasi: arahkan bar utama ke sekitar 80–88 piksel dan pengumuman ke 30–34 piksel pada desktop. Atur ukuran bingkai logo sambil mempertahankan proporsi. Gunakan tiga zona dengan keseimbangan optik: logo, navigasi, lalu aksi. Pada ponsel, pilihan bahasa dapat dipindahkan ke menu agar pengumuman tidak perlu diperkecil atau dibungkus menjadi beberapa baris.

### 7. Area sentuh dan penanda aksesibilitas perlu dirapikan

Pilihan bahasa memiliki tinggi 26 piksel, ikon media sosial 40 × 40 piksel, dan tinggi tautan footer sekitar 21 piksel sebelum memperhitungkan ruang antarbaris. Tautan navbar yang aktif belum memiliki aria-current. Kelompok tautan footer masih berupa div dan label span, tanpa landmark navigasi per kelompok.

Rekomendasi: usahakan kontrol utama ponsel memiliki area efektif sekitar 44 × 44 piksel; ukuran ikon visual boleh tetap 18–20 piksel. Tambahkan aria-current="page" pada tautan aktif, kelompok navigasi footer bernama, serta heading semantik tanpa mengubah ukuran visualnya menjadi besar.

Catatan standar: WCAG 2.2 AA SC 2.5.8 memakai 24 × 24 CSS piksel dengan pengecualian, termasuk jarak dan tautan dalam kalimat. Target 44 × 44 berasal dari SC 2.5.5 tingkat AAA dan dipakai di sini sebagai sasaran kenyamanan, bukan klaim bahwa semua elemen di bawah 44 piksel gagal AA. [W3C: Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [W3C: Target Size Enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).

### 8. Umpan balik newsletter belum lengkap

Dari peninjauan kode: tombol dinonaktifkan saat permintaan berjalan, tetapi labelnya tetap Subscribe/Berlangganan. Pesan sukses dan gagal sudah memiliki role status/alert. Pengiriman ke layanan newsletter tidak diuji.

Rekomendasi: tampilkan label proses seperti Subscribing…/Memproses…, status sibuk yang jelas, dan pesan singkat setelah berhasil. Pertahankan email ketika terjadi kegagalan agar pengguna dapat mencoba lagi.

## Arah desain yang direkomendasikan

Navbar: logo → Home / Shop / About Us / Journal / Contact → Search / Wishlist / Cart. Tetap gunakan ikon garis, satu warna penanda aktif, dan animasi pendek sekitar 180–250 milidetik. Pertahankan dukungan pengurangan gerakan.

Footer desktop: baris newsletter, lalu identitas merek dan tiga kelompok tautan, diakhiri copyright dan legal. Footer ponsel: urutan yang sama dengan formulir ditumpuk dan dua kolom tautan. Logo putih di latar gelap tetap tepat; prioritaskan kesamaan bentuk dan proporsi merek, bukan memaksa warna logo sama di dua latar yang berbeda.

## Urutan pengerjaan

1. Atasi tumpang tindih tombol chat dan urutan fokus menu ponsel.
2. Rapikan skala teks, target sentuh, aria-current, dan semantik kelompok footer.
3. Samakan penamaan menu dan pindahkan newsletter ke susunan yang lebih seimbang.
4. Sesuaikan tinggi header, pilihan bahasa ponsel, dan umpan balik formulir.

Kriteria selesai: tautan legal dapat diakses di semua ukuran yang diperiksa; Tab mengikuti menu terbuka; Escape mengembalikan fokus; tidak ada gulir horizontal pada 320 dan 390 piksel; nama menu sama; footer dan pencarian tetap terbaca dalam kedua bahasa.

## Rujukan implementasi lokal

- Navbar: components/site-header.tsx
- Footer: components/site-footer.tsx
- Aturan tampilan: app/(storefront)/storefront.css dan app/globals.css
- Teks kedua bahasa: lib/i18n.ts

Audit ini tidak mengubah berkas implementasi tersebut.
