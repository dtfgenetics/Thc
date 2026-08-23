import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_AIOSEO_SHOP_META || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-aioseo-shop-meta';

const intended = {
  title: 'DTF Genetics Shop | Current Seed Releases',
  description: 'Shop current DTF Genetics seed releases with documented lineage, generation details, and direct links to verified product listings.'
};

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
if (intended.title.length > 60) throw new Error('Intended Shop title is longer than 60 characters');
if (intended.description.length < 80 || intended.description.length > 160) throw new Error('Intended Shop description must be 80–160 characters');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-AIOSEO-Shop-Meta/1.0' };
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, stamp);
await mkdir(backupDir, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        headers: {
          ...headers,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000)
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if ((response.status >= 500 || response.status === 429) && attempt < 5) {
        await sleep(attempt * 2000);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body).slice(0, 600)}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 5) await sleep(attempt * 2000);
    }
  }
  throw lastError || new Error(`Request failed: ${path}`);
}

async function getShopPage() {
  const rows = await request('/wp-json/wp/v2/pages?slug=shop&context=edit&per_page=10');
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`Expected exactly one Shop page; saw ${Array.isArray(rows) ? rows.length : 'invalid response'}`);
  return rows[0];
}

async function getAioseo(postId) {
  const body = await request(`/wp-json/aioseo/v1/post?postId=${postId}`);
  if (!body?.success || !body?.data?.currentPost) throw new Error(`AIOSEO Shop response did not include currentPost for post ${postId}`);
  return body.data.currentPost;
}

function extractMetaDescription(html) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const name = tag.match(/name=["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';
    if (name !== 'description') continue;
    return tag.match(/content=["']([^"']*)["']/i)?.[1] || '';
  }
  return '';
}

function extractTitle(html) {
  return (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
}

const shop = await getShopPage();
const shopId = Number(shop.id || 0);
if (!shopId) throw new Error('Shop page ID was not resolved');
const before = await getAioseo(shopId);
await writeFile(join(backupDir, 'aioseo-shop-before.json'), `${JSON.stringify(before, null, 2)}\n`);

let after = before;
let rollbackAttempted = false;
let publicVerification = { verified: false };

if (apply) {
  const payload = { ...before, id: shopId, ...intended };
  await request('/wp-json/aioseo/v1/post', { method: 'POST', body: JSON.stringify(payload) });
  after = await getAioseo(shopId);

  const criticalKeys = [
    'canonicalUrl', 'default', 'noindex', 'nofollow', 'noarchive', 'notranslate', 'noimageindex', 'nosnippet', 'noodp',
    'maxSnippet', 'maxVideoPreview', 'maxImagePreview', 'pillar_content', 'frequency', 'priority', 'limit_modified_date',
    'og_object_type', 'og_title', 'og_description', 'og_image_type', 'og_image_custom_url', 'og_image_custom_fields',
    'twitter_use_og', 'twitter_card', 'twitter_title', 'twitter_description', 'twitter_image_type', 'twitter_image_custom_url'
  ];
  const changedCritical = criticalKeys.filter((key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null));
  const metadataOk = after.title === intended.title && after.description === intended.description;

  if (!metadataOk || changedCritical.length) {
    rollbackAttempted = true;
    try { await request('/wp-json/aioseo/v1/post', { method: 'POST', body: JSON.stringify({ ...before, id: shopId }) }); } catch {}
    throw new Error(`Shop SEO reconciliation failed. metadataOk=${metadataOk}; changedCritical=${changedCritical.join(',') || 'none'}; rollbackAttempted=true`);
  }

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}/shop/?dtf_shop_meta=${Date.now()}-${attempt}`, {
        headers: { Accept: 'text/html', 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'User-Agent': 'DTFSeeds-Shop-Meta-Verify/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000)
      });
      const html = await response.text();
      const title = extractTitle(html);
      const description = extractMetaDescription(html);
      publicVerification = {
        status: response.status,
        title,
        description,
        verified: response.ok && title.includes('DTF Genetics Shop') && description === intended.description
      };
      if (publicVerification.verified) break;
    } catch (error) {
      publicVerification = { verified: false, error: error instanceof Error ? error.message : String(error) };
    }
    await sleep(4000);
  }

  if (!publicVerification.verified) {
    throw new Error(`AIOSEO Shop state saved but public metadata did not verify: ${JSON.stringify(publicVerification)}`);
  }
}

await writeFile(join(backupDir, 'aioseo-shop-after.json'), `${JSON.stringify(after, null, 2)}\n`);
const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  apply,
  shopId,
  backupDir,
  before: { title: before.title ?? null, description: before.description ?? null },
  intended,
  after: { title: after.title ?? null, description: after.description ?? null },
  publicVerification,
  rollbackAttempted
};
await writeFile(join(backupDir, 'aioseo-shop-meta-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
