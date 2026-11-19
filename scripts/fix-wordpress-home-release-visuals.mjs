import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_HOME_RELEASE_VISUALS || '').toLowerCase() === 'true';
const registryPath = process.env.STRAIN_CARD_REGISTRY || join(process.cwd(), 'site/wordpress/products/strain-card-images.json');
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-home-release-visuals';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, stamp);
await mkdir(backupDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rendered = (value) => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');
const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000)
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if ((response.status >= 500 || response.status === 429) && attempt < 5) {
        await sleep(attempt * 1500);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 5) await sleep(attempt * 1500);
    }
  }
  throw lastError;
}

const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const cards = Array.isArray(registry?.cards) ? registry.cards : [];
if (cards.length !== 3) throw new Error(`Expected exactly 3 current release-card records, found ${cards.length}`);

for (const card of cards) {
  for (const field of ['productSlug', 'wordpressSlug', 'sourceUrl', 'altText', 'expectedWidth', 'expectedHeight']) {
    if (!card[field]) throw new Error(`Release-card registry entry ${card.registryId || '(unknown)'} is missing ${field}`);
  }
  if (!/^https:\/\//i.test(card.sourceUrl)) throw new Error(`Reviewed source URL is not HTTPS for ${card.registryId}`);
}

const pages = await request('/wp-json/wp/v2/pages?slug=home&context=edit&per_page=10');
if (!Array.isArray(pages) || pages.length !== 1) throw new Error(`Expected one Home page, found ${Array.isArray(pages) ? pages.length : 'invalid response'}`);
const home = pages[0];
const original = rendered(home.content);
if (!original) throw new Error('Home page content is empty');
// Genetics release cards are informational while seed sales are suspended.
const releaseLinks = cards.map((card) => card.canonicalName === 'Blue Bubblegum'
  ? '/seeds/blue-bubblegum/' : '/seeds/blue-mango/');
const releaseGridMatch = original.match(/<div\s+class=["']release-grid["'][^>]*>([\s\S]*?)<\/div>/i);
if (!releaseGridMatch) throw new Error('Homepage release grid not found');
const releaseArticles = [...releaseGridMatch[1].matchAll(/<article\b[^>]*class=["'][^"']*\brelease\b[^"']*["'][^>]*>[\s\S]*?<\/article>/gi)];
if (releaseArticles.length !== cards.length) throw new Error('Expected exactly three release articles');
for (const [index, article] of releaseArticles.entries()) {
  if (!article[0].includes(`href="${releaseLinks[index]}"`) && !article[0].includes(`href='${releaseLinks[index]}'`)) {
    throw new Error(`Release card ${index + 1} does not link to the approved genetics page`);
  }
}
await writeFile(join(backupDir, 'home-before.json'), `${JSON.stringify(home, null, 2)}\n`);

const resolved = [];
for (const card of cards) {
  const exactRows = await request(`/wp-json/wp/v2/media?slug=${encodeURIComponent(card.wordpressSlug)}&context=edit&per_page=10`);
  let media = Array.isArray(exactRows) && exactRows.length ? [...exactRows].sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0] : null;

  if (!media?.source_url) {
    const searchRows = await request(`/wp-json/wp/v2/media?search=${encodeURIComponent(card.canonicalName || card.wordpressSlug)}&context=edit&per_page=100`);
    const candidates = (Array.isArray(searchRows) ? searchRows : [])
      .filter((item) => String(item?.slug || '').startsWith(card.wordpressSlug) && item?.source_url)
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    media = candidates[0] || null;
  }

  resolved.push({
    card,
    media,
    imageUrl: media?.source_url || card.sourceUrl,
    source: media?.source_url ? 'wordpress-media' : 'reviewed-registry-source'
  });
}

function releaseImage(imageUrl, card) {
  const width = Number(card.expectedWidth) || 1024;
  const height = Number(card.expectedHeight) || 1536;
  return `<img class="dtf-img dtf-release-card-image" src="${esc(imageUrl)}" alt="${esc(card.altText)}" loading="lazy" decoding="async" width="${width}" height="${height}" style="aspect-ratio:2/3;object-fit:contain;background:#f3efe5">`;
}

function replaceReleaseImage(content, card, imageUrl, index) {
  const grid = content.match(/<div\s+class=["']release-grid["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!grid) throw new Error('Release grid missing');
  const articles = [...grid[1].matchAll(/<article\b[^>]*class=["'][^"']*\brelease\b[^"']*["'][^>]*>[\s\S]*?<\/article>/gi)];
  const article = articles[index]?.[0];
  if (!article) throw new Error(`Release article ${index + 1} missing`);
  const img = article.match(/<img\b[^>]*>/i)?.[0];
  if (!img) throw new Error(`Release article ${index + 1} missing artwork`);
  const updatedArticle = article.replace(img, releaseImage(imageUrl, card));
  // Preserve every other part of the card, especially the nontransactional link.
  return content.replace(article, updatedArticle);
}

let next = original;
const changes = [];
for (const [index, { card, media, imageUrl, source }] of resolved.entries()) {
  next = replaceReleaseImage(next, card, imageUrl, index);
  changes.push({
    productSlug: card.productSlug,
    wordpressSlug: card.wordpressSlug,
    mediaId: media?.id || null,
    imageUrl, source,
    expectedWidth: card.expectedWidth,
    expectedHeight: card.expectedHeight,
    geneticsRoute: releaseLinks[index]
  });
}

for (const { card, imageUrl } of resolved) {
  if (next.includes(`/product/${card.productSlug}/`)) throw new Error(`Suspended product link returned for ${card.productSlug}`);
  if (!next.includes(imageUrl)) throw new Error(`Resolved strain-card source is missing from updated Home content for ${card.productSlug}`);
  if (!next.includes(card.altText)) throw new Error(`Release-card alt text is missing for ${card.productSlug}`);
}
const markerCount = (next.match(/dtf-release-card-image/g) || []).length;
if (markerCount !== cards.length) throw new Error(`Expected ${cards.length} homepage release-card image markers after replacement, found ${markerCount}`);

if (apply && next !== original) {
  await request(`/wp-json/wp/v2/pages/${home.id}`, {
    method: 'POST',
    body: JSON.stringify({ content: next, status: 'publish' })
  });
}

const afterRows = await request('/wp-json/wp/v2/pages?slug=home&context=edit&per_page=10');
const after = Array.isArray(afterRows) ? afterRows[0] : null;
const afterContent = rendered(after?.content);
if (apply) {
  for (const { card, imageUrl } of resolved) {
    if (!afterContent.includes(imageUrl) || !afterContent.includes(card.altText)) {
      throw new Error(`Post-write verification failed for ${card.productSlug}`);
    }
  }
  const afterMarkerCount = (afterContent.match(/dtf-release-card-image/g) || []).length;
  if (afterMarkerCount !== cards.length) throw new Error(`Post-write release-card marker count is ${afterMarkerCount}, expected ${cards.length}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  apply,
  pageId: home.id,
  changed: next !== original,
  backupDir,
  changes
};
await writeFile(join(backupDir, 'home-release-visuals-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'latest.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
