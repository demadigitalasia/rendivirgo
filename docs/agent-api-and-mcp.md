# Agent Access: API Keys & MCP Server

Eksternal agent (mis. Hermes di VPS) bisa mengelola admin RENDIVIRGO lewat dua jalur yang memakai **kunci yang sama**:

1. **REST API langsung** — `https://rendivirgo.com/api/...` dengan `Authorization: Bearer rvk_...`
2. **MCP server** — `https://rendivirgo.com/api/mcp` (streamable HTTP, mode JSON stateless)

## 1. Membuat API key

1. Login ke `/admin/settings` → tab **API keys**.
2. Isi nama (mis. `Hermes agent`), pilih scope per domain (Read only / Read & write), atau centang **Full access (*)** untuk akses penuh.
3. Klik **Create API key**. Plaintext key (`rvk_...`) **hanya ditampilkan sekali** — copy dan simpan di secret Hermes.
4. Key tersimpan sebagai hash SHA-256 di tabel `AdminApiKey`, dengan `lastUsedAt` dan audit log. Revoke kapan saja dari UI yang sama.

### Scope

| Scope | Mencakup |
|---|---|
| `catalog:read` / `catalog:write` | `/api/admin/products`, `categories`, `conditions` |
| `content:read` / `content:write` | `/api/admin/blog`, `pages`, `banners`, `hero-slides`, `navigation`, `site-content`, `testimonials`, `content`, `newsletter`, `reviews` |
| `orders:read` / `orders:write` | `/api/admin/orders`, `wholesale`, `lapidary` |
| `uploads:write` | `/api/admin/uploads` |
| `settings:read` / `settings:write` | `/api/admin/settings`, `shipping`, `audit`, dan route admin lain |
| `*` | Semua di atas |

Aturan: GET butuh `:read`, mutasi (POST/PUT/PATCH/DELETE) butuh `:write` (`:write` otomatis mencakup read). **API key tidak bisa mengelola API key lain** (route `admin/api-keys` hanya untuk session login admin).

## 2. Pakai REST langsung

```bash
curl -H "Authorization: Bearer rvk_..." https://rendivirgo.com/api/admin/products?status=Draft
```

Upload gambar (multipart, maks 8 MB, folder: `products|blog|banners|pages|rough-materials|lapidary|brand|misc`):

```bash
curl -H "Authorization: Bearer rvk_..." \
  -F "file=@product.jpg" \
  "https://rendivirgo.com/api/admin/uploads?folder=products"
```

Respons `url`-nya langsung dipakai untuk `ProductImage.url`, `BlogPost.coverImage`, `Banner.imageUrl`, dst. Semua mutasi tercatat di audit log admin. Rate limit global: 300 request/menit.

## 3. Pakai MCP (untuk Hermes)

Konfigurasi Hermes:

```json
{
  "mcpServers": {
    "rendivirgo": {
      "type": "http",
      "url": "https://rendivirgo.com/api/mcp",
      "headers": { "Authorization": "Bearer rvk_..." }
    }
  }
}
```

Tools yang tersedia (`tools/list`):

- **Produk**: `rv_list_products`, `rv_get_product`, `rv_create_product`, `rv_update_product`, `rv_bulk_products`, `rv_list_categories`, `rv_create_category`
- **Konten**: `rv_list_blog_posts`, `rv_create_blog_post`, `rv_update_blog_post`, `rv_list_pages`, `rv_create_page`, `rv_update_page`, `rv_list_banners`, `rv_update_banner`, `rv_get_hero_slides` (read-only)
- **Media**: `rv_upload_image` (base64 → multipart), `rv_list_uploads`
- **Pesanan**: `rv_list_orders`, `rv_get_order`, `rv_update_order`, `rv_add_order_event`
- **Escape hatch**: `rv_api` — panggil endpoint `admin/*` apa pun (untuk fitur yang belum dibungkus)

## 4. Arsitektur singkat

- `AdminGuard` (`api/src/auth/admin.guard.ts`) menerima session cookie **atau** Bearer API key; scope dicek di guard, sehingga REST dan MCP punya aturan yang sama.
- MCP endpoint (`app/api/mcp/route.ts` + `lib/mcp/tools.ts`) berjalan di Next.js, memanggil Nest API internal (`API_ORIGIN`) dengan key pemanggil — tidak ada logika auth baru di luar Nest.
- CORS/origin check di Nest hanya memblokir request mutasi yang mengirim header `Origin` non-allowlist; agent non-browser tidak terpengaruh.

## 5. Uji cepat (lokal)

```bash
# tools/list
curl -s http://localhost:3000/api/mcp \
  -H "Authorization: Bearer rvk_..." \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools[].name'

# tools/call
curl -s http://localhost:3000/api/mcp \
  -H "Authorization: Bearer rvk_..." \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"rv_list_products","arguments":{}}}'
```
