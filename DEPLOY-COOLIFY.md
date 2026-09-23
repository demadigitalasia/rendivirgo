# Deploy RENDI VIRGO ke VPS dengan Coolify

Panduan langkah demi langkah. Arsitektur: **1 database PostgreSQL + 2 aplikasi** (`api` dan `web`) dalam satu project Coolify.

```
Browser ──https──▶ web (Next.js :3000) ──internal──▶ api (NestJS :4000) ──▶ postgres :5432
                        │                                  │
                        └── proxy /api/* dan /uploads/* ────┘   volume: /app/uploads
```

Browser hanya berbicara dengan `web`. `/api/*` dan `/uploads/*` diproksikan oleh Next.js ke `api` melalui internal network, jadi API **tidak perlu domain publik**.

---

## 1. Prasyarat

- VPS Ubuntu 24.04 LTS, minimal **2 vCPU / 4 GB RAM / 30 GB** (disarankan 4 vCPU / 8 GB / 60 GB)
- Coolify terpasang dan bisa diakses di `http://<IP-VPS>:8000`
- Domain `rendivirgo.com` dengan akses DNS
- Repo GitHub sudah ter-push (branch `main`)

DNS yang perlu dibuat:

| Type | Name | Value |
|---|---|---|
| A | `@` | IP VPS |
| A | `www` | IP VPS |

---

## 2. Buat database PostgreSQL

1. Coolify → **Project** (buat project `rendi-virgo`) → **+ New** → **Database** → **PostgreSQL**
2. Versi: **17** (atau 16), Name: `rv-postgres`
3. Setelah dibuat, buka resource tersebut → salin **Internal URL**
   Format: `postgresql://<user>:<password>@<host>:5432/<database>`

> Catat URL ini untuk `DATABASE_URL` di langkah 3.

---

## 3. Deploy aplikasi API (NestJS)

**+ New** → **Application** → **Public Repository** (atau GitHub App bila repo private) → pilih repo `rendivirgo` → Branch `main`.

Konfigurasi **General**:

| Field | Nilai |
|---|---|
| Name | `api` |
| Base Directory | `/api` |
| Build Pack | `Dockerfile` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `4000` |
| Domain | (kosongkan — tidak perlu publik) |

Konfigurasi **Environment Variables**:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>?schema=public
PORT=4000
NODE_ENV=production
APP_ORIGIN=https://rendivirgo.com
SESSION_SECRET=<hasil: openssl rand -base64 48>
SESSION_TTL_HOURS=12
ADMIN_EMAIL=admin@rendivirgo.com
ADMIN_PASSWORD=<password kuat pilihan Anda>
ADMIN_NAME=Rendi Virgo
UPLOAD_DIR=uploads
PUBLIC_API_URL=https://rendivirgo.com
```

Konfigurasi **Storages** (agar foto produk tidak hilang saat redeploy):

| Name | Destination |
|---|---|
| `rv-uploads` | `/app/uploads` |

Klik **Deploy**. Saat start, container otomatis menjalankan `prisma migrate deploy` lalu menjalankan API. Cek log: harus muncul `No pending migrations to apply` (atau daftar migrasi yang diterapkan) dan `RENDI VIRGO API listening`.

Setelah sukses, salin **Internal URL** aplikasi `api` dari halaman aplikasi (format `http://<nama>-<id>:4000`). Ini dipakai di langkah 4.

> Catatan: image API ±1 GB karena menyertakan Prisma CLI untuk migrasi.

---

## 4. Deploy aplikasi Web (Next.js)

**+ New** → **Application** → repo yang sama → Branch `main`.

Konfigurasi **General**:

| Field | Nilai |
|---|---|
| Name | `web` |
| Base Directory | `/` |
| Build Pack | `Dockerfile` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `3000` |
| Domain | `https://rendivirgo.com` |

Konfigurasi **Environment Variables**:

```env
API_ORIGIN=<Internal URL aplikasi api dari langkah 3, mis. http://api-abc123:4000>
```

> Wajib sama-sama berada di project + environment yang sama dengan `api` supaya bisa saling akses lewat internal network. Jika Internal URL tidak muncul, jalankan `docker ps` di VPS dan pakai nama container API sebagai host: `http://<nama-container>:4000`.

Klik **Deploy**. Setelah selesai, Coolify otomatis menerbitkan SSL (Let's Encrypt) untuk `rendivirgo.com`.

---

## 5. Verifikasi

```bash
curl -s https://rendivirgo.com/api/health          # {"status":"ok","database":"up"}
curl -s -o /dev/null -w "%{http_code}\n" https://rendivirgo.com/          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://rendivirgo.com/shop      # 200
curl -s -o /dev/null -w "%{http_code}\n" https://rendivirgo.com/admin     # 307 ke /admin/login
```

Login admin di `https://rendivirgo.com/admin/login` dengan `ADMIN_EMAIL` / `ADMIN_PASSWORD` yang diisi di langkah 3. Akun admin dibuat otomatis saat API pertama kali start.

---

## 6. Mengisi konten produksi

Seed demo **tidak** ikut ke image produksi (seed bergantung pada data katalog frontend). Isi konten lewat dashboard:

1. **Categories** — buat 13 kategori inti (Cabochons, Pair, Rough, dst.)
2. **Products** — tambah manual, atau **Products → Import CSV** untuk entri massal. Kolom CSV: `name, slug, sku, categorySlug, stoneType, origin, price, currency, unit, stockModel, stockQuantity, weightGram, weightCarat, lengthMm, widthMm, heightMm, condition, status, tone, featured, fragile, description`. Kategori yang belum ada akan **dibuat otomatis** dari `categorySlug`. Gunakan tombol **Export CSV** untuk melihat contoh formatnya.
3. **Content** — Home page (hero + owner), Pages (About, FAQ, Shipping, Privacy, Terms), Blog, Testimonials, Banners
4. **Shipping** — tarif dan profil pengiriman
5. **Settings** — identitas toko, SEO, pembayaran, notifikasi

---

## 7. Backup

- **Database**: Coolify → database `rv-postgres` → **Backups** → jadwalkan harian ke S3-compatible (Cloudflare R2 / Backblaze B2).
- **Uploads**: volume `rv-uploads` ada di disk VPS. Idealnya pindahkan foto produk ke Cloudflare R2/S3 + CDN; selama masih lokal, sertakan `/var/lib/docker/volumes/...` dalam snapshot VPS mingguan.

## 8. Update aplikasi

Push ke `main` → Coolify → aplikasi → **Deploy** (atau aktifkan **Auto Deploy** via webhook). Migrasi baru otomatis diterapkan saat container API start.

## 9. Troubleshooting

| Gejala | Penyebab umum |
|---|---|
| Web menampilkan 502 dari `/api/*` | `API_ORIGIN` salah / `api` dan `web` tidak satu network |
| Container API restart berulang | `DATABASE_URL` salah, atau migrasi gagal (cek log) |
| Login berhasil tapi langsung logout | `APP_ORIGIN` tidak sesuai domain, atau `SESSION_SECRET` berubah tiap deploy |
| Gambar upload 404 | Volume `/app/uploads` belum dipasang |
| Foto hilang setelah redeploy | Volume belum dipasang saat upload dilakukan |
| Build web gagal | Pastikan Base Directory `/` dan Dockerfile Location `/Dockerfile` |
