# Verifikasi penerapan navbar dan footer

15 Oktober 2026. Tindak lanjut rekomendasi audit yang disetujui pengguna.

- Navbar: tinggi bar utama 84 px pada desktop, 76 px pada tampilan ringkas. Menu desktop 14 px. Penamaan Journal/Jurnal seragam dengan footer.
- Footer: newsletter menjadi baris tersendiri; kelompok Explore, Customer Care, dan Connect; teks tautan 14 px dan legal 12 px. Input email 16 px. Tautan legal berada di atas ruang aman tombol chat.
- Lebar yang diperiksa: 320, 390, 768, 1024, dan 1280 px. Tidak ditemukan gulir horizontal pada beranda.
- Menu ponsel: fokus masuk ke Home/Beranda; Tab menuju Shop/Belanja; Escape menutup menu dan mengembalikan fokus ke tombol menu.
- Pilihan bahasa pada menu ponsel memakai tinggi area sentuh 44 px. Pada layar paling sempit, Wishlist tersedia di menu agar tombol tetap lega.
- Pencarian: autofocus berfungsi; klik di luar menutup panel.
- Navigasi ke Shop/Belanja: menu tertutup dan aria-current menandai tujuan yang aktif.
- Footer desktop pada posisi halaman paling bawah: Privacy dan Terms tidak beririsan dengan tombol WhatsApp.
- Newsletter: input email tidak valid ditolak oleh validasi browser. Tidak ada alamat email valid yang dikirim dan tidak ada pendaftaran yang dibuat selama pengujian. Label proses dan aria-busy sudah ditambahkan; hasil layanan newsletter tidak diuji dengan pengiriman langsung.
- Pemeriksaan TypeScript, git diff --check, dan build produksi lolos. Build menghasilkan 72 halaman statis.

Bukti tampilan berada di folder ini. Audit awal tetap disimpan sebagai catatan kondisi sebelum perubahan.
