import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProductCsv, readProductTable, matchPhoto } from './product-import';
import { createXlsxBuffer } from '../settings/xlsx';
import { ProductImportService } from './product-import.service';

test('CSV supports BOM, escaped quotes, commas and multiline descriptions', () => {
  assert.deepEqual(parseProductCsv('\uFEFFsku,description\r\nRV1,"a, b\n""stone"""'), [['sku','description'],['RV1','a, b\n"stone"']]);
  assert.throws(() => parseProductCsv('sku\n"broken'));
});
test('Excel and CSV produce the same records and reject ambiguous headers', () => {
  const expected = [{ sku: 'RV1', price: '25' }];
  assert.deepEqual(readProductTable({ originalname: 'products.xlsx', buffer: createXlsxBuffer([{ name: 'Products', headers: ['sku','price'], rows: [['RV1',25]] }]) }), expected);
  assert.deepEqual(readProductTable({ originalname: 'products.csv', buffer: Buffer.from('sku,price\nRV1,25') }), expected);
  assert.throws(() => readProductTable({ originalname: 'x.csv', buffer: Buffer.from('sku,sku\na,b') }));
});
test('photo matching prioritizes exact and longest SKUs', () => {
  assert.equal(matchPhoto('RV-1.jpg', ['RV','RV-1']), 'RV-1');
  assert.equal(matchPhoto('RV-1-2.jpg', ['RV','RV-1']), 'RV-1');
  assert.equal(matchPhoto('other.jpg', ['RV']), undefined);
});
const prisma = { category: { findMany: async () => [{ id: 'cat', slug: 'agate' }] }, product: { findUnique: async ({where}: any) => where.sku === 'OLD' ? { id: 'old-id', name: 'Old stone' } : null } };
test('preview validates numeric values and duplicate SKUs without mutations', async () => {
  const service = new ProductImportService(prisma as any, {} as any);
  const result = await service.preview([{ sku: 'NEW', name: 'Stone', price: '-3', categorySlug: 'agate' }, { sku: 'NEW', name: 'Stone', price: 'abc', categorySlug: 'agate' }], 'create');
  assert.equal(result.valid, false);
  assert(result.rows[0].errors.length);
  assert(result.rows[1].errors.includes('Duplicate SKU in file'));
});
test('updates preserve blank values and creates default to Draft', async () => {
  const service = new ProductImportService(prisma as any, {} as any);
  const result = await service.preview([{ sku: 'OLD', price: '30', name: '' }, { sku: 'NEW', name: 'New stone', price: '20', categorySlug: 'agate' }], 'merge');
  assert.equal(result.valid, true);
  assert.equal(result.rows[0].data.name, undefined);
  assert.equal(result.rows[0].data.status, undefined);
  assert.equal(result.rows[1].data.status, 'Draft');
  const createOnly = await service.preview([{ sku: 'OLD', price: '30' }], 'create');
  assert.equal(createOnly.valid, false);
});

test('commit updates by SKU, preserves gallery without photos, and reports partial failures', async () => {
  const calls: unknown[][] = [];
  const products = {
    update: async (...args: unknown[]) => { calls.push(args); },
    create: async () => { throw new Error('stock conflict'); },
  };
  const service = new ProductImportService(prisma as any, products as any);
  const result = await service.execute([{ sku: 'OLD', price: '35' }, { sku: 'NEW', name: 'New stone', price: '20', categorySlug: 'agate' }], 'merge', {}, {} as any);
  assert.equal(result.updated, 1);
  assert.equal(result.created, 0);
  assert.match(result.errors[0], /NEW.*stock conflict/);
  assert.equal(calls[0][0], 'old-id');
  assert.equal((calls[0][1] as any).images, undefined);
});
test('invalid preview prevents all commit mutations', async () => {
  let writes = 0;
  const service = new ProductImportService(prisma as any, { create: async () => writes++ } as any);
  await assert.rejects(() => service.execute([{ sku: 'NEW', price: 'invalid' }], 'create', {}, {} as any));
  assert.equal(writes, 0);
});
