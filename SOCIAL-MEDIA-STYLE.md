# RENDI VIRGO — Social Media Style Guide

Dokumen ini menurunkan sistem visual website RENDI VIRGO ke format Instagram agar feed terasa sebagai satu brand yang sama.

## Brand impression

RENDI VIRGO diposisikan sebagai koleksi batu alam Indonesia yang autentik, terkurasi, tenang, dan bernilai bagi kolektor maupun maker. Nuansanya editorial commerce: fotografi batu menjadi fokus utama, sementara tipografi, garis tipis, dan ruang kosong memberi rasa premium.

Kata kunci visual:

- Natural, grounded, contemplative
- Premium tetapi hangat
- Editorial, bukan katalog massal
- Transparan tentang asal, jenis, kondisi, dan karakter batu

## Warna inti

| Token | Hex | Peran |
|---|---|---|
| Forest Green | `#103B2C` | Latar utama, panel gelap, footer, CTA |
| Forest Deep | `#08261D` | Overlay foto dan kontras tinggi |
| Jade Green | `#477D68` | Eyebrow, label, aksen sekunder |
| Warm Ivory | `#F7F4EE` | Panel terang, ruang teks, logo plate |
| Paper | `#FCFAF6` | Latar bersih dan konten edukasi |
| Sand | `#E6DFD2` | Border, card, permukaan pendukung |
| Muted Bronze | `#B08A53` | Divider, garis premium, detail logo |
| Bronze Light | `#D9BC8B` | Aksen pada latar gelap |
| Stone Black | `#1C201D` | Teks utama pada latar terang |
| Soft Gray | `#6B7069` | Metadata, caption pendukung |

## Logo

- Default: `public/brand/rendi-virgo-logo.webp` — emblem RV hijau dan wordmark emas/gelap.
- Alternatif: `public/brand/rendi-virgo-logo-black-silver.webp` — untuk treatment monokrom atau latar gelap tertentu.
- Pertahankan proporsi asli; jangan diputar, direcolor, atau diberi bevel/drop shadow berat.
- Gunakan ruang kosong minimal setinggi huruf `R` di semua sisi.
- Pada artwork 1080×1080, area aman logo dimulai kira-kira 56–72 px dari tepi.
- Jika wordmark terlalu kecil untuk dibaca, gunakan emblem RV saja.

## Tipografi

- Headline: serif editorial seperti `Iowan Old Style`, `Baskerville`, atau `Georgia`.
- Label/metadata: sans-serif bersih seperti `Avenir Next`, `Helvetica Neue`, atau `Arial`.
- Headline memakai sentence case; hindari semua huruf kapital untuk judul utama.
- Eyebrow dan metadata boleh uppercase dengan tracking lebar 3–5 px.
- Gunakan divider pendek warna bronze sebagai elemen khas website.

## Aturan layout Instagram

- Ukuran feed: 1080×1080 px.
- Satu ide utama per post; jangan memadatkan detail produk terlalu banyak.
- Jaga safe area minimal 56 px dari tepi untuk logo, judul, dan CTA.
- Rasio visual: foto 60–70%, teks 30–40%.
- Foto harus lebih dominan daripada ornamen.
- Maksimal dua warna aksen dalam satu artwork: biasanya forest + bronze atau ivory + jade.
- Hindari gradien neon, tekstur dekoratif berlebihan, frame tebal, dan layout marketplace yang ramai.

## Tiga template awal

### 01 — Product spotlight

Struktur: foto batu penuh sebagai background, overlay forest gelap di sisi teks, logo plate ivory di kiri atas, judul serif besar, metadata jenis batu dan asal, divider tipis di bawah.

Contoh copy:

> THE COLLECTION  
> Forest River Cabochon  
> MOSS AGATE  
> West Java, Indonesia

### 02 — Brand / owner story

Struktur: panel ivory di kiri, foto pemilik atau proses sourcing di kanan, logo plate, headline pendek, satu paragraf naratif, footer forest gelap.

Contoh copy:

> THE OWNER'S NOTE  
> From Indonesia to the world.  
> A closer relationship with Indonesia's natural beauty — selected with care for collectors and makers worldwide.

### 03 — Journal / education

Struktur: panel teks paper/ivory di kiri, crop foto batu di kanan, tiga chip informasi, label `THE JOURNAL`, footer minimal.

Contoh copy:

> THE JOURNAL  
> How to look at a stone.  
> Before the cut, before the setting, there is color, pattern, and place.

## Caption tone

Caption perlu terasa observasional, spesifik, dan tidak berlebihan. Selalu utamakan fakta batu dan pengalaman melihatnya; hindari klaim medis atau metafisik.

Contoh caption bilingual untuk post product spotlight:

**EN** — A closer look at Forest River Cabochon, a moss agate with deep botanical inclusions and a calm, river-like movement. Selected in West Java for collectors and makers who value natural character.

**ID** — Lebih dekat dengan Forest River Cabochon, moss agate dengan inklusi botani yang dalam dan pola tenang seperti aliran sungai. Dipilih di Jawa Barat untuk kolektor dan perajin yang menghargai karakter alami batu.

CTA yang aman dan konsisten: `Explore the collection at rendivirgo.com` / `Jelajahi koleksinya di rendivirgo.com`.

## Deliverables contoh

- `public/social/rendi-virgo-post-01-forest-river.png`
- `public/social/rendi-virgo-post-02-from-indonesia.png`
- `public/social/rendi-virgo-post-03-the-journal.png`
- `public/social/rendi-virgo-social-pack-preview.jpg`
- Template editable SVG:
  - `public/social/templates/instagram-product-template.svg`
  - `public/social/templates/instagram-story-template.svg`
  - `public/social/templates/instagram-journal-template.svg`
- Preview template: `public/social/templates/instagram-templates-preview.jpg`
- Generator artwork reusable: `scripts/create-instagram-posts.mjs`
- Generator template reusable: `scripts/create-instagram-templates.mjs`

Generator dapat dijalankan ulang dengan `node scripts/create-instagram-posts.mjs` setelah aset foto atau copy diperbarui.
Template dapat dibuat ulang dengan `node scripts/create-instagram-templates.mjs`; file SVG dapat dibuka dan diedit di Figma, Illustrator, atau browser-compatible design tools.
