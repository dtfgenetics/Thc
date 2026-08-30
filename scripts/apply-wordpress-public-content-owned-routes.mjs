import { cp, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const sourceDir = process.env.CONTENT_DIR || '';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
if (!sourceDir) throw new Error('CONTENT_DIR is required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Ownership-Preserving-Reconcile/1.0'
};

async function getPage(slug) {
  const response = await fetch(`${siteUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Could not read WordPress /${slug}/ before reconciliation (${response.status})`);
  const pages = JSON.parse(text);
  if (!Array.isArray(pages) || pages.length !== 1) {
    throw new Error(`Expected exactly one published WordPress owner for /${slug}/; found ${Array.isArray(pages) ? pages.length : 'invalid response'}`);
  }
  return pages[0];
}

function rawContent(page) {
  const content = page?.content;
  if (content && typeof content === 'object' && typeof content.raw === 'string') return content.raw;
  if (content && typeof content === 'object' && typeof content.rendered === 'string') return content.rendered;
  if (typeof content === 'string') return content;
  throw new Error(`WordPress page ${page?.id || 'unknown'} did not expose editable content`);
}

const ownedDir = await mkdtemp(join(tmpdir(), 'dtf-wordpress-owned-routes-'));
await cp(sourceDir, ownedDir, { recursive: true });

// Learning Experience V3 is the automatic owner of both Home and Learn.
// Preserve the exact currently stored content while the broad WordPress lane
// reconciles community, shop, gallery, about, contact, blog and front-page state.
for (const slug of ['home', 'learn']) {
  const page = await getPage(slug);
  const content = rawContent(page);
  if (!content.trim()) throw new Error(`Refusing to preserve empty /${slug}/ content`);
  await writeFile(join(ownedDir, `${slug}.html`), `${content.trim()}\n`, 'utf8');
  console.log(`Preserved Learning-owned /${slug}/ content from WordPress page ${page.id}.`);
}

process.env.CONTENT_DIR = ownedDir;
await import('./apply-wordpress-public-content-rest.mjs');
