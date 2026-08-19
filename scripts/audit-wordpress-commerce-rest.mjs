import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const reportRoot = process.env.BACKUP_ROOT || process.cwd();
const reportPath = join(reportRoot, 'wordpress-commerce-capabilities.json');

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

await mkdir(reportRoot, { recursive: true });

const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: authHeader,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Commerce-Capability-Audit/1.0'
};

async function probe(path) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${siteUrl}${path}`, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000)
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    return {
      path,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      contentType: response.headers.get('content-type') || '',
      responseShape: Array.isArray(body)
        ? `array:${body.length}`
        : body && typeof body === 'object'
          ? `object:${Object.keys(body).slice(0, 12).join(',')}`
          : typeof body,
      errorCode: body?.code || null,
      errorMessage: body?.message || null
    };
  } catch (error) {
    return {
      path,
      status: 0,
      ok: false,
      durationMs: Date.now() - startedAt,
      contentType: '',
      responseShape: null,
      errorCode: error?.cause?.code || null,
      errorMessage: error instanceof Error ? error.message : String(error)
    };
  }
}

const indexProbe = await probe('/wp-json/');
const typeProbe = await probe('/wp-json/wp/v2/types?context=edit');
const candidates = [
  '/wp-json/wp/v2/product?context=edit&per_page=1',
  '/wp-json/wp/v2/products?context=edit&per_page=1',
  '/wp-json/wc/v3/products?per_page=1',
  '/wp-json/wc/store/v1/products?per_page=1'
];

const endpointProbes = [];
for (const path of candidates) endpointProbes.push(await probe(path));

const editableCandidates = endpointProbes
  .filter((item) => item.ok && !item.path.includes('/wc/store/'))
  .map((item) => item.path);

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  mode: 'read-only',
  credentialsPresent: true,
  wordpressIndex: indexProbe,
  wordpressTypes: typeProbe,
  endpointProbes,
  editableProductApiCandidates: editableCandidates,
  writeAttempted: false,
  nextStep: editableCandidates.length
    ? 'Build a backup-first product mutation script against the confirmed authenticated endpoint; do not mutate products from this audit.'
    : 'Do not attempt product mutation with the current WordPress application-password path. Use WooCommerce credentials or Hostinger/WP-CLI after access is configured.'
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
