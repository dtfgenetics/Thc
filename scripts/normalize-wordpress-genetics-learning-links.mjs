import { readFile } from 'node:fs/promises';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_GENETICS_LIBRARY || '').toLowerCase() === 'true';
const catalogPath = process.env.SEED_LINE_CATALOG || 'site/wordpress/products/seed-line-catalog.json';
const staleRoute = '/learn/subjects/genetics-breeding/';
const canonicalRoute = '/learn/genetics-breeding/';

if (!username || !password) throw new Error('WordPress credentials are required.');

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog?.lines) || catalog.lines.length === 0) {
  throw new Error('Seed line catalog is missing or empty.');
}

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'DTFSeeds-Genetics-Link-Normalizer/1.0'
};

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000)
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { body = { raw: text.slice(0, 700) }; }
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path}: HTTP ${response.status}${body?.message ? `: ${body.message}` : ''}`);
  }
  return body;
}

async function getPage(slug, parentId = null) {
  const params = new URLSearchParams({ slug, context: 'edit', per_page: '20' });
  if (parentId !== null) params.set('parent', String(parentId));
  const rows = await request(`/wp-json/wp/v2/pages?${params}`);
  if (!Array.isArray(rows)) throw new Error(`Unexpected WordPress page response for ${slug}`);
  if (rows.length > 1) throw new Error(`Multiple WordPress pages found for slug ${slug}`);
  return rows[0] || null;
}

function rawContent(page) {
  return String(page?.content?.raw ?? page?.content?.rendered ?? '');
}

async function normalizePage(page, label) {
  if (!page?.id) throw new Error(`WordPress page missing for ${label}`);
  const before = rawContent(page);
  const staleCount = before.split(staleRoute).length - 1;
  const after = before.split(staleRoute).join(canonicalRoute);
  const changed = before !== after;

  if (changed && apply) {
    const saved = await request(`/wp-json/wp/v2/pages/${page.id}`, {
      method: 'POST',
      body: JSON.stringify({ content: after, status: 'publish' })
    });
    const savedContent = rawContent(saved);
    if (savedContent.includes(staleRoute) || !savedContent.includes(canonicalRoute)) {
      throw new Error(`${label}: WordPress did not persist the canonical genetics learning route.`);
    }
  }

  return { id: page.id, label, changed, staleCount };
}

const seedsPage = await getPage('seeds');
if (!seedsPage?.id) throw new Error('Canonical /seeds/ page was not found.');

const rows = [await normalizePage(seedsPage, '/seeds/')];
for (const line of catalog.lines) {
  const page = await getPage(line.slug, seedsPage.id);
  if (!page?.id) throw new Error(`Missing genetics line page: /seeds/${line.slug}/`);
  rows.push(await normalizePage(page, `/seeds/${line.slug}/`));
}

const staleFound = rows.reduce((sum, row) => sum + row.staleCount, 0);
const changed = rows.filter((row) => row.changed).length;
console.log(JSON.stringify({
  ok: true,
  apply,
  staleRoute,
  canonicalRoute,
  pagesChecked: rows.length,
  staleLinksFound: staleFound,
  pagesChanged: changed,
  rows
}, null, 2));
