const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const dotenv = require('../../api/node_modules/dotenv');

const directory = __dirname;
const api = 'http://127.0.0.1:4000/api';
const site = 'http://127.0.0.1:3000';
const plan = JSON.parse(fs.readFileSync(path.join(directory, 'generation-plan.json')));
const env = dotenv.parse(fs.readFileSync(path.join(directory, '../../api/.env')));
let cookie;

async function request(endpoint, options = {}) {
  const response = await fetch(api + endpoint, {
    ...options,
    headers: { ...(cookie ? { cookie } : {}), ...options.headers },
  });
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
  return response;
}

function unchangedFields(product) {
  const { images, imageUrls, updatedAt, ...rest } = product;
  return rest;
}

async function main() {
  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
  });
  cookie = login.headers.get('set-cookie').split(';')[0];
  const listing = await (await request('/admin/products?pageSize=100')).json();
  const products = listing.items ?? listing.data ?? listing;
  assert(Array.isArray(products), 'Unexpected product listing');
  const snapshot = path.join(directory, 'products-before-install.json');
  if (!fs.existsSync(snapshot)) fs.writeFileSync(snapshot, JSON.stringify(products, null, 2));
  const media = await (await request('/admin/uploads?folder=products')).json();
  const installedPath = path.join(directory, 'installed-photos.json');
  const installed = fs.existsSync(installedPath) ? JSON.parse(fs.readFileSync(installedPath)) : [];

  // Validate every mapping before changing any product.
  for (const entry of plan) {
    const product = products.find(item => item.id === entry.id && item.slug === entry.slug);
    assert(product, `Product mismatch: ${entry.slug}`);
    assert(fs.existsSync(path.join(directory, 'web', `${entry.slug}.webp`)), `Missing image: ${entry.slug}`);
    const previous = installed.find(item => item.id === entry.id);
    assert(product.images.every(image => /\/images\/products\/stone-[\w-]+\.svg(?:\?.*)?$/.test(image.url) || image.url === previous?.url), `Non-dummy image on ${entry.slug}; refusing to replace it`);
  }

  for (const entry of plan) {
    const product = products.find(item => item.id === entry.id);
    let record = installed.find(item => item.id === entry.id);
    if (record && product.imageUrls?.[0] === record.url) continue;
    const filename = `${entry.slug}.webp`;
    let asset = media.find(item => item.originalName === filename && item.mimeType === 'image/webp');
    if (!asset) {
      const form = new FormData();
      form.set('file', new Blob([fs.readFileSync(path.join(directory, 'web', filename))], { type: 'image/webp' }), filename);
      asset = await (await request('/admin/uploads?folder=products', { method: 'POST', body: form })).json();
    }
    record = { id: entry.id, slug: entry.slug, name: entry.name, assetId: asset.id, url: asset.url, bytes: asset.size };
    const existingIndex = installed.findIndex(item => item.id === entry.id);
    if (existingIndex >= 0) installed[existingIndex] = record;
    else installed.push(record);
    // Save the mapping before patching so an interrupted run can safely resume.
    fs.writeFileSync(installedPath, JSON.stringify(installed, null, 2));
    const updated = await (await request(`/admin/products/${entry.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ images: [{ url: asset.url, alt: `${entry.name} — AI-generated catalog illustration`, sortOrder: 0 }] }),
    })).json();
    assert.deepEqual(unchangedFields(updated), unchangedFields(product), `Other product fields changed: ${entry.slug}`);
    console.log(`Installed: ${entry.name}`);
  }

  const afterListing = await (await request('/admin/products?pageSize=100')).json();
  const after = afterListing.items ?? afterListing.data ?? afterListing;
  const verification = { checkedAt: new Date().toISOString(), installed: [], untouchedProducts: [], pages: [] };
  for (const before of products) {
    const current = after.find(item => item.id === before.id);
    assert(current, `Missing product: ${before.slug}`);
    if (!plan.some(entry => entry.id === before.id)) {
      assert.deepEqual(current, before, `Unexpected change: ${before.slug}`);
      verification.untouchedProducts.push(before.slug);
      continue;
    }
    assert.deepEqual(unchangedFields(current), unchangedFields(before), `Other fields changed: ${before.slug}`);
    const record = installed.find(item => item.id === before.id);
    assert.equal(current.imageUrls[0], record.url);
    assert(!current.images.some(image => image.url.endsWith('.svg')));
    const image = await fetch(site + new URL(record.url).pathname);
    assert.equal(image.status, 200, `Image unavailable: ${before.slug}`);
    assert(image.headers.get('content-type')?.includes('image/webp'));
    assert.equal((await image.arrayBuffer()).byteLength, record.bytes);
    const publicResponse = await fetch(`${api}/products/${before.slug}`);
    if (publicResponse.ok) {
      const publicProduct = await publicResponse.json();
      assert.equal(publicProduct.imageUrls[0], record.url);
    }
    verification.installed.push({ slug: before.slug, imageStatus: image.status, publicStatus: publicResponse.status, bytes: record.bytes, status: current.status });
  }
  for (const route of ['/', '/shop', '/shop/cabochons/emerald-garden-cabochon']) {
    const response = await fetch(site + route);
    assert.equal(response.status, 200, `Page unavailable: ${route}`);
    verification.pages.push({ route, status: response.status });
  }
  fs.writeFileSync(path.join(directory, 'installation-verification.json'), JSON.stringify(verification, null, 2));
  console.log(JSON.stringify({ installed: verification.installed.length, untouched: verification.untouchedProducts, pages: verification.pages }));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
