import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const plan = JSON.parse(await readFile('site/wordpress/products/woocommerce-reconciliation.json', 'utf8'));
const backupRoot = process.env.BACKUP_ROOT || process.cwd();
const pointerPath = join(backupRoot, 'woocommerce-backup-path.txt');
const backupDir = process.env.WC_BACKUP_DIR || (await readFile(pointerPath, 'utf8')).trim();
const siteUrl = (process.env.WP_SITE_URL || plan.siteUrl || 'https://dtfseeds.com').replace(/\/$/, '');
const applyRollback = String(process.env.APPLY_WOOCOMMERCE_ROLLBACK || '').toLowerCase() === 'true';

const consumerKey = process.env.WC_CONSUMER_KEY || '';
const consumerSecret = process.env.WC_CONSUMER_SECRET || '';
const wpUsername = process.env.WP_API_USERNAME || '';
const wpPassword = process.env.WP_API_PASSWORD || '';
const authHeader = consumerKey && consumerSecret
  ? `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
  : wpUsername && wpPassword
    ? `Basic ${Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64')}`
    : '';

if (!applyRollback) throw new Error('Rollback is disabled. Set APPLY_WOOCOMMERCE_ROLLBACK=true to restore reviewed fields from backup snapshots.');
if (!authHeader) throw new Error('Rollback requires WooCommerce consumer credentials or WordPress application credentials.');
if (!backupDir) throw new Error('WooCommerce rollback backup directory is unavailable.');

const manifest = JSON.parse(await readFile(join(backupDir, 'backup-manifest.json'), 'utf8'));
const planById = new Map((plan.products || []).map((spec) => [spec.registryId, spec]));
const allowedRestoreFields = new Set(['name', 'description', 'short_description', 'categories']);

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'DTFSeeds-WooCommerce-Rollback/1.0',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 1500) };
    }
  }
  if (!response.ok) {
    const code = body?.code ? ` (${body.code})` : '';
    const message = body?.message ? `: ${body.message}` : '';
    throw new Error(`WooCommerce rollback request ${path} returned HTTP ${response.status}${code}${message}`);
  }
  return body;
}

function restorePayload(snapshot) {
  const payload = {
    name: snapshot.name,
    description: snapshot.description,
    short_description: snapshot.short_description,
    categories: (snapshot.categories || []).map((category) => ({ id: category.id }))
  };
  for (const key of Object.keys(payload)) {
    if (!allowedRestoreFields.has(key)) throw new Error(`Refusing unexpected rollback field: ${key}`);
  }
  return payload;
}

const files = new Set(await readdir(backupDir));
const results = [];
for (const item of manifest.products || []) {
  const spec = planById.get(item.registryId);
  if (!spec) throw new Error(`${item.registryId}: current reconciliation plan no longer contains this product`);
  if (Number(item.productId) !== Number(spec.expectedProductId)) {
    throw new Error(`${item.registryId}: backup manifest product ID ${item.productId} does not match pinned ID ${spec.expectedProductId}`);
  }

  const snapshotName = `${item.registryId}-before.json`;
  if (!files.has(snapshotName)) throw new Error(`${item.registryId}: required rollback snapshot is missing: ${snapshotName}`);
  const snapshot = JSON.parse(await readFile(join(backupDir, snapshotName), 'utf8'));
  if (Number(snapshot.id) !== Number(spec.expectedProductId)) {
    throw new Error(`${item.registryId}: snapshot ID ${snapshot.id} does not match pinned ID ${spec.expectedProductId}`);
  }
  if (String(snapshot.slug || '') !== spec.slug) {
    throw new Error(`${item.registryId}: snapshot slug ${snapshot.slug} does not match pinned slug ${spec.slug}`);
  }

  const liveBefore = await request(`/wp-json/wc/v3/products/${spec.expectedProductId}`);
  if (Number(liveBefore?.id) !== Number(spec.expectedProductId) || String(liveBefore?.slug || '') !== spec.slug) {
    throw new Error(`${item.registryId}: live product identity changed; refusing rollback`);
  }

  const payload = restorePayload(snapshot);
  const restored = await request(`/wp-json/wc/v3/products/${spec.expectedProductId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  if (Number(restored?.id) !== Number(spec.expectedProductId)) {
    throw new Error(`${item.registryId}: WooCommerce did not confirm rollback`);
  }

  const verified = await request(`/wp-json/wc/v3/products/${spec.expectedProductId}`);
  const expectedCategoryIds = (snapshot.categories || []).map((category) => Number(category.id)).sort((a, b) => a - b);
  const actualCategoryIds = (verified.categories || []).map((category) => Number(category.id)).sort((a, b) => a - b);
  const failures = [];
  if (verified.name !== snapshot.name) failures.push('name');
  if (String(verified.description || '').trim() !== String(snapshot.description || '').trim()) failures.push('description');
  if (String(verified.short_description || '').trim() !== String(snapshot.short_description || '').trim()) failures.push('short_description');
  if (JSON.stringify(actualCategoryIds) !== JSON.stringify(expectedCategoryIds)) failures.push('categories');
  if (failures.length) throw new Error(`${item.registryId}: rollback verification failed for ${failures.join(', ')}`);

  results.push({ registryId: item.registryId, productId: spec.expectedProductId, restored: true, verified: true });
}

const reportPath = join(backupDir, 'rollback-report.json');
await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), siteUrl, backupDir, results }, null, 2)}\n`, 'utf8');
console.log(`Rolled back and verified ${results.length} WooCommerce products from ${backupDir}.`);
