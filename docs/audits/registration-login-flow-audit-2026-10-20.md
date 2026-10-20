# Audit Alur Registrasi dan Login RENDI VIRGO

**Tanggal:** 20 Oktober 2026  
**Cakupan:** Registrasi, verifikasi email, login, sesi, logout, lupa/reset kata sandi untuk customer dan admin.  
**Metode:** Tinjauan kode statis dengan fokus keamanan autentikasi, dipandu skill `review-security`.  
**Status:** Audit statis selesai. Tindak lanjut kode diterapkan setelah persetujuan pengguna; tidak ada akun, email, atau sesi yang dibuat selama audit.

## Ringkasan

Alur customer mencakup registrasi dengan verifikasi email, login, sesi berbasis cookie, logout, dan reset kata sandi. Alur admin menyediakan login, pemulihan kata sandi, penggantian kata sandi, dan pengelolaan sesi. Fondasi autentikasi cukup baik: kata sandi di-hash dengan bcrypt, token verifikasi dan reset acak disimpan dalam bentuk hash, sesi disimpan di database, dan operasi customer memakai batas percobaan.

Temuan awal yang perlu diperhatikan sebelum mengandalkan alur ini di produksi:

1. Login admin saat ini hanya memeriksa email dan kata sandi. Kolom `totpEnabled` ada, tetapi tidak ada pemeriksaan kode TOTP atau langkah MFA pada alur login.
2. Pengiriman email yang gagal tidak diteruskan sebagai kegagalan sinkron oleh `EmailService`. Karena status akun harus tetap dirahasiakan, permintaan autentikasi memberi jawaban generik dan pengiriman ditangani melalui antrean serta retry.

**Penilaian:** alur customer punya kontrol dasar yang baik, tetapi pengalaman aktivasi dan pemulihan akun bergantung pada pengiriman email yang perlu bisa dicoba ulang dan dipantau. Akses admin perlu MFA karena dapat mengelola data dan operasi toko. Pengguna menyetujui rekomendasi selain MFA; MFA sengaja ditunda.

## Status tindak lanjut

- **Sudah diterapkan:** verifikasi email memerlukan tindakan eksplisit; tersedia kirim ulang dengan jeda dua menit dan rate limit; email verifikasi/reset diproses melalui antrean database terenkripsi dengan retry dan pemeriksaan token sebelum pengiriman.
- **Sudah diterapkan:** token reset admin dikonsumsi secara kondisional dalam transaksi; token dibersihkan dari address bar setelah pemakaian; halaman verifikasi/reset menggunakan `no-referrer` dan `noindex`.
- **Sudah diterapkan:** kata sandi admin minimal 12 karakter juga pada pergantian kata sandi; TTL sesi admin divalidasi dan dibatasi; audit login customer serta permintaan/reset kata sandi tidak mencatat token atau email yang dimasukkan.
- **Sudah diterapkan:** endpoint autentikasi memakai rate limit PostgreSQL berbagi lintas replika, selain throttle Nest yang ada. Login dan permintaan email juga punya batas per akun/email; bucket dibersihkan setelah jendelanya berakhir.
- **Ditunda sesuai arahan pengguna:** MFA admin. Sampai MFA dibuat, gunakan kata sandi admin unik dan batasi akses admin melalui kontrol jaringan yang tersedia.
- **Persyaratan operasi:** migrasi `20261020110000_auth_delivery_and_shared_throttling` harus diterapkan sebelum versi API ini menerima trafik. Konfigurasi produksi harus menyediakan `SESSION_SECRET` stabil minimal 32 karakter dan `RESEND_API_KEY` yang valid. Migrasi belum dijalankan karena PostgreSQL development lokal tidak merespons.

## Ringkasan alur saat ini

### Customer

1. Form di halaman `/account/register` mengirim nama, email, dan kata sandi ke `POST /api/customer-auth/register`.
2. Server menormalkan email, menyimpan hash kata sandi, membuat token verifikasi acak dengan masa berlaku 30 menit, menyimpan hash token, dan menyimpan payload email terenkripsi ke antrean database.
3. Worker mengirim email dari antrean dan mencoba ulang kegagalan. Halaman tautan menunggu tombol **Verify email** sebelum mengirim token ke `POST /api/customer-auth/verify-email`; server menandai alamat email terverifikasi dan mengaitkan order terdahulu yang memakai email itu.
4. Login hanya berhasil untuk customer yang emailnya sudah diverifikasi. Server membuat sesi database dan mengirim cookie `rv_customer_session`.
5. Customer Guard memeriksa sesi untuk akses akun. Logout mencabut sesi di database dan menghapus cookie.
6. Lupa kata sandi mengirim tautan reset 30 menit. Reset memakai token satu kali dan mencabut semua sesi customer yang masih aktif.

### Admin

1. Admin awal dibuat dari konfigurasi environment jika belum ada; server menolak bootstrap bila `ADMIN_PASSWORD` tidak tersedia atau kurang dari 12 karakter.
2. Form `/admin/login` mengirim email dan kata sandi ke `POST /api/auth/login`. Server membuat sesi database dan cookie `rv_admin_session` dengan masa berlaku konfigurasi, 12 jam secara default.
3. Admin Guard memeriksa cookie dan sesi database pada rute yang dilindungi. Login admin dibatasi 8 permintaan per menit per IP dan 20 per email; reset dibatasi per IP dan per email.
4. Lupa/reset kata sandi memakai tautan 30 menit. Reset mencabut semua sesi. Penggantian kata sandi dari sesi aktif mencabut sesi lain sambil mempertahankan sesi yang digunakan.

## Temuan dan rekomendasi

| Prioritas | Temuan | Dampak |
|---|---|---|
| **P1** | **Login admin belum menerapkan MFA.** `totpEnabled` hanya dibaca dan dikembalikan sebagai atribut admin; login selesai setelah pemeriksaan kata sandi. Tidak ditemukan implementasi TOTP/OTP pada API atau UI. | Jika kata sandi admin dicuri atau dipakai ulang, penyerang langsung memperoleh akses workspace admin. |
| **P1 — ditangani** | **Pengiriman email autentikasi bergantung pada provider.** EmailService mengembalikan `false` saat Resend tidak tersedia atau menolak pesan; pemanggil memberi jawaban generik agar tidak membocorkan status akun. | Antrean terenkripsi menyimpan permintaan, mencoba ulang hingga 8 kali atau sampai token 30 menit kedaluwarsa, lalu membersihkan payload. Registrasi menyediakan kirim ulang dengan cooldown; log mencatat kegagalan tanpa isi pesan atau token. |
| **P2 — ditangani** | **Verifikasi email sebelumnya berjalan otomatis saat halaman dibuka.** | Halaman kini menunggu tindakan eksplisit customer sebelum memakai token. |
| **P2 — ditangani** | **Token reset admin sebelumnya tidak dikonsumsi secara atomik.** | Reset kini memakai update kondisional dalam transaksi; sesi dicabut hanya jika tepat satu token berhasil digunakan. |
| **P2 — ditangani** | **Throttler bawaan menyimpan hitungan per proses.** | Endpoint autentikasi juga memakai bucket PostgreSQL bersama per IP dan aksi; login serta permintaan email memiliki batas tambahan per identitas yang di-HMAC. Batas bekerja lintas replika. |
| **P2 — ditangani** | **Standar panjang kata sandi admin sebelumnya tidak konsisten.** | DTO dan UI ganti kata sandi kini meminta minimal 12 karakter, sesuai bootstrap dan reset. |
| **P3 — ditangani** | **Token verifikasi/reset berada di query URL.** | Halaman verifikasi dan reset menggunakan `no-referrer` dan `noindex`; browser menghapus token dari address bar setelah request selesai. Komponen admin menyimpan token di memori agar request gagal bisa dicoba lagi. |

## Rekomendasi prioritas

### P1 — Lindungi login admin dengan MFA

- Terapkan langkah MFA pada login admin untuk akun yang mengaktifkannya; jangan anggap flag `totpEnabled` sebagai proteksi selama kode login belum memeriksanya.
- Buat proses setup dan pemulihan MFA yang aman, simpan secret terenkripsi, dan minta autentikasi ulang sebelum menonaktifkan MFA.
- Sampai MFA tersedia, batasi akses admin melalui kontrol jaringan/SSO yang sudah tersedia dan gunakan kata sandi unik yang kuat.

### P1 — Jadikan email verifikasi dan reset dapat diandalkan

- Diterapkan: kegagalan provider dan retry dicatat di log tanpa isi pesan atau token; pantau log antrean pada deployment.
- Diterapkan: endpoint dan aksi **Kirim ulang verifikasi** memakai cooldown serta batas percobaan. Respons tetap tidak membocorkan status alamat email.
- Diterapkan: antrean/outbox database terenkripsi dan retry idempoten hingga 8 percobaan; token yang sudah diganti atau kedaluwarsa tidak dikirim. Pastikan konfigurasi Resend, domain pengirim, dan alamat `APP_ORIGIN` diperiksa pada deployment, lalu pantau log kegagalan antrean.
- Diterapkan: UI menyatakan sistem akan mencoba mengirim, bukan menjanjikan email sudah terkirim; customer dapat meminta tautan verifikasi ulang tanpa membocorkan status akun.

### P2 — Perbaiki perilaku tautan dan token

- Ubah verifikasi email menjadi halaman konfirmasi dengan tombol **Verifikasi email**; konsumsi token hanya setelah tindakan eksplisit customer.
- Setelah token dibaca dan request selesai, hapus token dari address bar menggunakan navigasi pengganti. Terapkan `Referrer-Policy: no-referrer` khusus halaman verifikasi dan reset.
- Diterapkan: reset admin mengonsumsi token dengan update kondisional atas hash token dan waktu kedaluwarsa dalam transaksi; sesi dicabut hanya jika tepat satu token berhasil dikonsumsi.

### P2 — Konsolidasikan kontrol autentikasi

- Samakan minimum kata sandi admin menjadi 12 karakter pada DTO ganti kata sandi, reset, bootstrap, dan UI.
- Diterapkan: endpoint autentikasi memakai bucket PostgreSQL bersama per IP dan aksi. Login, registrasi, dan permintaan email juga dibatasi per email dengan jendela singkat; ini berlaku lintas replika tanpa layanan Redis tambahan dan tidak membuat lockout permanen.
- Diterapkan: login customer berhasil/gagal dan permintaan/reset email dicatat tanpa kata sandi, cookie, token, atau email permintaan reset.
- Diterapkan: `SESSION_TTL_HOURS` memakai fallback 12 jam untuk nilai invalid dan dibatasi maksimal 30 hari.

## Kontrol yang sudah ada

- Validasi DTO server membatasi format dan panjang input; global `ValidationPipe` menghapus field yang tidak dikenal.
- Kata sandi admin dan customer disimpan sebagai bcrypt hash dengan cost 12, bukan teks asli.
- Token verifikasi dan reset dibuat dengan `randomBytes(32)`, disimpan sebagai SHA-256 hash, dan berlaku 30 menit.
- Login customer dan admin memakai pesan kredensial yang sama untuk email/kata sandi yang tidak cocok; permintaan lupa kata sandi memberi respons generik.
- Cookie sesi memakai `HttpOnly`, `SameSite=Lax`, dan `Secure` saat `NODE_ENV=production`; token sesi yang disimpan di database juga di-hash.
- Reset kata sandi mencabut sesi lama. Ganti kata sandi admin mencabut sesi lain.
- Ada throttling khusus untuk login, registrasi, verifikasi, dan reset. API juga memakai allowlist CORS dan pemeriksaan header `Origin` pada request mutasi yang memiliki header tersebut.
- Login admin mencatat login berhasil dan gagal ke audit log; daftar sesi admin dapat dilihat dan dicabut.

## Metode dan batas audit

- Meninjau halaman dan komponen login/registrasi, controller dan service autentikasi, DTO, guard, konfigurasi API, proxy API Next.js, service email, serta skema sesi/token.
- Audit awal tidak mengirim request login/registrasi/reset ke server lokal, tidak membuat akun, tidak mengubah database, dan tidak mengirim email. Hasil audit awal statis dan bukan uji end-to-end; perubahan implementasi belum diuji. Klien Prisma berhasil dibuat ulang dari skema baru. Status migrasi lokal tidak dapat diperiksa karena PostgreSQL di `localhost:5432` tidak merespons, sehingga migrasi belum diterapkan.
- Konfigurasi runtime rahasia dan status domain/email provider tidak dibaca. Karena itu, laporan tidak menyimpulkan apakah email benar-benar terkirim pada deployment yang sedang berjalan. Implementasi antrean memerlukan `SESSION_SECRET` stabil minimal 32 karakter pada produksi dan mencoba ulang kegagalan kirim; status provider tetap perlu dipantau setelah deployment.
- Referensi yang diperiksa: `components/customer-account.tsx`; `components/admin/login-form.tsx`; `components/admin/forgot-password-form.tsx`; `components/admin/reset-password-form.tsx`; `api/src/customers/customer-account.controller.ts`; `api/src/customers/customer-auth.service.ts`; `api/src/customers/customer-auth.dto.ts`; `api/src/auth/auth.controller.ts`; `api/src/auth/auth.service.ts`; `api/src/auth/auth-rate-limit.service.ts`; `api/src/auth/dto/auth.dto.ts`; `api/src/auth/admin.guard.ts`; `api/src/customers/customer.guard.ts`; `api/src/main.ts`; `api/src/app.module.ts`; `api/src/email/email.service.ts`; `api/src/email/auth-email-outbox.service.ts`; `api/prisma/schema.prisma`; `api/prisma/migrations/20261020110000_auth_delivery_and_shared_throttling/migration.sql`; `DEPLOY-COOLIFY.md`; `lib/api-proxy.ts`; `next.config.ts`.
