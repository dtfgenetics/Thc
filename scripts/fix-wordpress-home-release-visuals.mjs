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
for (const card of cards) {
  const hrefNeedle = `/product/${card.productSlug}/`;
  const count = original.split(hrefNeedle).length - 1;
  if (count !== 1) throw new Error(`Expected one homepage product route for ${card.productSlug}, found ${count}`);
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

function replaceNearestImageBeforeRoute(content, card, imageUrl) {
  const hrefNeedle = `/product/${card.productSlug}/`;
  const hrefIndex = content.indexOf(hrefNeedle);
  if (hrefIndex < 0) throw new Error(`Homepage product route missing for ${card.productSlug}`);

  const imageStart = content.lastIndexOf('<img', hrefIndex);
  if (imageStart < 0) throw new Error(`No image found before homepage product route ${card.productSlug}`);
  const imageEnd = content.indexOf('>', imageStart);
  if (imageEnd < 0 || imageEnd >= hrefIndex) throw new Error(`Could not isolate image tag for homepage product route ${card.productSlug}`);

  const distance = hrefIndex - imageEnd;
  if (distance > 7000) throw new Error(`Nearest image is too far from ${card.productSlug} (${distance} chars); refusing ambiguous replacement`);

  const previousProduct = content.lastIndexOf('/product/', hrefIndex - 1);
  if (previousProduct > imageStart) throw new Error(`Another product route appears between the candidate image and ${card.productSlug}; refusing ambiguous replacement`);

  return {
    content: `${content.slice(0, imageStart)}${releaseImage(imageUrl, card)}${content.slice(imageEnd + 1)}`,
    distance
  };
}

let next = original;
const changes = [];
const ordered = [...resolved].sort((a, b) => original.indexOf(`/product/${b.card.productSlug}/`) - original.indexOf(`/product/${a.card.productSlug}/`));
for (const { card, media, imageUrl, source } of ordered) {
  const result = replaceNearestImageBeforeRoute(next, card, imageUrl);
  next = result.content;
  changes.push({
    productSlug: card.productSlug,
    wordpressSlug: card.wordpressSlug,
    mediaId: media?.id || null,
    imageUrl,
    source,
    expectedWidth: card.expectedWidth,
    expectedHeight: card.expectedHeight,
    distanceToRoute: result.distance
  });
}

for (const { card, imageUrl } of resolved) {
  if (!next.includes(`/product/${card.productSlug}/`)) throw new Error(`Product route disappeared for ${card.productSlug}`);
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
