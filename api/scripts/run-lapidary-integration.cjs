const { createRequire } = require('node:module');
const requireApi = createRequire(process.cwd() + '/package.json');
requireApi('dotenv').config({ quiet: true });
const { Client } = requireApi('pg');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
(async () => {
  const original = new URL(process.env.DATABASE_URL);
  if (!['localhost','127.0.0.1'].includes(original.hostname) || original.pathname !== '/rendi_virgo_dev') throw new Error('Expected local dev database connection');
  const database = 'rv_lapidary_test_' + Date.now() + '_' + require('node:crypto').randomBytes(4).toString('hex');
  const testUrl = new URL(original); testUrl.pathname = '/' + database;
  const admin = new Client({ connectionString: original.toString(), connectionTimeoutMillis: 4000 });
  await admin.connect();
  let created = false;
  try {
    await admin.query('CREATE DATABASE "' + database + '"'); created = true;
    const env = { ...process.env, DATABASE_URL: testUrl.toString(), LAPIDARY_TEST_DATABASE_URL: testUrl.toString() };
    const migration = spawnSync('npm', ['run', 'prisma:deploy'], { env, encoding: 'utf8' });
    if (migration.status !== 0) throw new Error('Test schema migration failed: ' + (migration.stderr || migration.stdout).replaceAll(testUrl.toString(), '<REDACTED>'));
    console.log('Applied migrations to isolated test database');
    const test = spawnSync(process.execPath, ['--import','tsx','--test','src/lapidary/lapidary.integration.spec.ts'], { env, encoding: 'utf8' });
    const output = (test.stdout || '') + (test.stderr || '');
    console.log(output.replaceAll(testUrl.toString(), '<REDACTED>'));
    fs.writeFileSync('../docs/audits/LR-20261025-0001-integration-results.txt', output.replaceAll(testUrl.toString(), '<REDACTED>'));
    if (test.error) throw test.error;
    process.exitCode = test.status === 0 ? 0 : test.status || 1;
  } finally {
    if (created) { await admin.query('DROP DATABASE "' + database + '" WITH (FORCE)'); console.log('Removed isolated test database'); }
    await admin.end();
  }
})().catch(error => { console.error(error.message.replace(/postgres(?:ql)?:\/\/\S+/g,'<REDACTED>')); process.exitCode = 1; });
