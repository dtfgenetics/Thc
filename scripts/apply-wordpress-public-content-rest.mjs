import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const contentDir = process.env.CONTENT_DIR || '';
const backupRoot = process.env.BACKUP_ROOT || process.cwd();
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const backupDir = join(backupRoot, `wordpress-rest-content-${timestamp}`);
const catalogCardRegistryPath = new URL('../site/wordpress/products/catalog-strain-cards.json', import.meta.url);
const repoRoot = process.cwd();

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
if (!contentDir) throw new Error('CONTENT_DIR is required');

const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: authHeader,
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Content-Deployment/1.8'
};

// WordPress owns the editorial/root pages below. /games/ and /games/high-iq/
// are owned by the static public application suite and must never be required
// to exist as WordPress pages.
const pageDefinitions = [
  ['home', 'DTF Genetics | Dream the Future'],
  ['seeds', 'Seeds / Genetics'],
  ['blue-mango', 'Blue Mango | DTF Genetics'],
  ['blue-frequency', 'Blue Frequency | DTF Genetics'],
  ['mystery-line', 'Mystery Line | DTF Genetics'],
  ['rainbow-bubblegum', 'Rainbow Bubblegum | DTF Genetics'],
  ['learn', 'Teaching Healthy Cultivation'],
  ['community', 'Community'],
  ['shop', 'Shop'],
  ['gallery', 'Gallery'],
  ['about', 'About DTF Genetics'],
  ['contact', 'Contact DTF Genetics']
];

const legacyPostTitles = [
  'Exploring DTF Genetics: A Hub for Cannabis Art and Gardening Tools',
  'Explore DTF Genetics: Your Destination for Cannabis-themed Apparel and Art'
];

const forbiddenPhrases = [
  'being rebuilt',
  'Reserved strain card',
  'Add verified',
  'Needed from owner',
  'Tool-ready rebuild',
  'Use this page for',
  'staged for'
];

function normalizeText(value = '') {
  return String(value).replace(/\r\n/g, '\n').trim();
}

function editableTitle(page) {
  return normalizeText(page?.title?.raw || page?.title?.rendered || '');
}

function editableContent(page) {
  return normalizeText(page?.content?.raw || page?.content?.rendered || '');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000)
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 1000) };
    }
  }
  if (!response.ok) {
    const code = body?.code ? ` (${body.code})` : '';
    const message = body?.message ? `: ${body.message}` : '';
    throw new Error(`WordPress request ${path} returned HTTP ${response.status}${code}${message}`);
  }
  return { response, body };
}

async function fetchBinary(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
        headers: { 'User-Agent': 'DTFSeeds-Catalog-Card-Publisher/1.1' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { response, bytes: Buffer.from(await response.arrayBuffer()) };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 1800);
    }
  }
  throw lastError;
}

async function loadReviewedWebCard(card) {
  const permanentPath = join(repoRoot, card.webAssetPath);
  try {
    const bytes = await readFile(permanentPath);
    return verifyReviewedWebCard(card, bytes, card.webAssetPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const stagingDir = join(repoRoot, '.tmp', 'strain-card-b64', card.webStagingKey);
  let names;
  try {
    names = (await readdir(stagingDir)).filter((name) => name.endsWith('.txt')).sort();
  } catch {
    throw new Error(`${card.registryId}: reviewed web asset is missing from both ${card.webAssetPath} and staging key ${card.webStagingKey}`);
  }
  if (!names.length) throw new Error(`${card.registryId}: no base64 staging chunks found`);

  const parts = [];
  for (const name of names) parts.push(await readFile(join(stagingDir, name), 'utf8'));
  const encoded = parts.join('').replace(/\s+/g, '');
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error(`${card.registryId}: invalid base64 staging content`);
  }
  const bytes = Buffer.from(encoded, 'base64');
  return verifyReviewedWebCard(card, bytes, `.tmp/strain-card-b64/${card.webStagingKey}`);
}

function verifyReviewedWebCard(card, bytes, source) {
  const hash = sha256(bytes);
  if (bytes.length !== Number(card.webByteLength)) {
    throw new Error(`${card.registryId}: web byte length ${bytes.length} != ${card.webByteLength}`);
  }
  if (hash !== card.webSha256) {
    throw new Error(`${card.registryId}: web SHA-256 ${hash} != ${card.webSha256}`);
  }
  if (bytes.subarray(0, 3).toString('hex') !== 'ffd8ff' || bytes.subarray(-2).toString('hex') !== 'ffd9') {
    throw new Error(`${card.registryId}: reviewed web asset is not a complete JPEG`);
  }
  return { card, bytes, hash, source };
}

async function mediaBySlug(slug) {
  const params = new URLSearchParams({ slug, context: 'edit', per_page: '10' });
  const { body } = await request(`/wp-json/wp/v2/media?${params}`);
  if (!Array.isArray(body)) throw new Error(`Unexpected media response for ${slug}`);
  return body;
}

async function verifyMediaBytes(item, card) {
  if (!item?.source_url) return false;
  try {
    const { bytes } = await fetchBinary(item.source_url, 3);
    return bytes.length === Number(card.webByteLength) && sha256(bytes) === card.webSha256;
  } catch {
    return false;
  }
}

async function ensureCatalogMedia(reviewed) {
  const { card, bytes } = reviewed;
  const existing = await mediaBySlug(card.wordpressSlug);
  if (existing.length > 1) throw new Error(`${card.registryId}: multiple WordPress media items use slug ${card.wordpressSlug}`);

  if (existing.length === 1) {
    if (!(await verifyMediaBytes(existing[0], card))) {
      throw new Error(`${card.registryId}: existing WordPress media slug does not match exact reviewed web bytes`);
    }
    const { body: updated } = await request(`/wp-json/wp/v2/media/${existing[0].id}`, {
      method: 'POST',
      body: JSON.stringify({
        title: `${card.canonicalName} ${card.generation} ${card.seedType}`,
        slug: card.wordpressSlug,
        alt_text: card.altText,
        caption: 'DTF Genetics catalog strain card'
      })
    });
    return { ...updated, reused: true };
  }

  const upload = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
      'User-Agent': 'DTFSeeds-Catalog-Card-Publisher/1.1',
      'Content-Type': card.webMimeType,
      'Content-Disposition': `attachment; filename="${card.webFileName}"`
    },
    body: bytes,
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000)
  });
  const text = await upload.text();
  let created = null;
  try { created = text ? JSON.parse(text) : null; } catch { created = { raw: text.slice(0, 1000) }; }
  if (!upload.ok || !created?.id) {
    throw new Error(`${card.registryId}: WordPress media upload failed (${upload.status}): ${created?.message || created?.raw || 'unknown error'}`);
  }

  const { body: updated } = await request(`/wp-json/wp/v2/media/${created.id}`, {
    method: 'POST',
    body: JSON.stringify({
      title: `${card.canonicalName} ${card.generation} ${card.seedType}`,
      slug: card.wordpressSlug,
      alt_text: card.altText,
      caption: 'DTF Genetics catalog strain card'
    })
  });
  if (!(await verifyMediaBytes(updated, card))) throw new Error(`${card.registryId}: uploaded WordPress media failed exact web hash verification`);
  return { ...updated, reused: false };
}

function resolveMediaPlaceholders(content, mediaByPlaceholder) {
  let resolved = String(content);
  for (const [placeholder, url] of mediaByPlaceholder) resolved = resolved.split(placeholder).join(url);
  const leftovers = resolved.match(/__DTF_MEDIA_[A-Z0-9_]+__/g) || [];
  if (leftovers.length) throw new Error(`Unresolved media placeholder(s): ${[...new Set(leftovers)].join(', ')}`);
  return resolved;
}

async function getPublishedPageBySlug(slug) {
  const params = new URLSearchParams({ slug, context: 'edit', per_page: '100' });
  const { body } = await request(`/wp-json/wp/v2/pages?${params}`);
  if (!Array.isArray(body)) throw new Error(`Unexpected page response for ${slug}`);
  if (body.length > 1) throw new Error(`Expected at most one published WordPress page for slug '${slug}'; found ${body.length}`);
  return body[0] || null;
}

async function createPage(slug, title, content) {
  const { body } = await request('/wp-json/wp/v2/pages', {
    method: 'POST',
    body: JSON.stringify({ slug, title, content, status: 'publish' })
  });
  if (!body?.id) throw new Error(`WordPress did not return an ID while creating /${slug}/`);
  if (body?.status !== 'publish') throw new Error(`WordPress did not publish newly created /${slug}/`);
  return body;
}

async function updatePage(page, title, content) {
  const { body } = await request(`/wp-json/wp/v2/pages/${page.id}`, {
    method: 'POST',
    body: JSON.stringify({ title, content, status: 'publish' })
  });
  if (!body?.id || body.id !== page.id) throw new Error(`WordPress did not confirm page ${page.id}`);
  return body;
}

async function draftExactLegacyPost(title) {
  const params = new URLSearchParams({ search: title, context: 'edit', per_page: '100' });
  const { body } = await request(`/wp-json/wp/v2/posts?${params}`);
  if (!Array.isArray(body)) throw new Error(`Unexpected post response while searching for '${title}'`);

  let drafted = 0;
  for (const post of body) {
    const renderedTitle = post?.title?.raw || post?.title?.rendered || '';
    if (renderedTitle !== title || post?.status === 'draft') continue;
    await writeFile(join(backupDir, `legacy-post-${post.id}.json`), `${JSON.stringify(post, null, 2)}\n`, 'utf8');
    await request(`/wp-json/wp/v2/posts/${post.id}`, { method: 'POST', body: JSON.stringify({ status: 'draft' }) });
    drafted += 1;
    console.log(`Drafted obsolete generated post: ${title} (post ID ${post.id})`);
  }
  return drafted;
}

await mkdir(join(backupDir, 'pages'), { recursive: true });
await mkdir(join(backupDir, 'media'), { recursive: true });

const siteInfo = await request('/wp-json/');
await writeFile(join(backupDir, 'site-index.json'), `${JSON.stringify(siteInfo.body, null, 2)}\n`, 'utf8');

const currentUser = await request('/wp-json/wp/v2/users/me?context=edit');
await writeFile(
  join(backupDir, 'authenticated-user.json'),
  `${JSON.stringify({
    id: currentUser.body?.id,
    name: currentUser.body?.name,
    slug: currentUser.body?.slug,
    roles: currentUser.body?.roles,
    capabilities: currentUser.body?.capabilities
  }, null, 2)}\n`,
  'utf8'
);

// Validate every source page and page identity before media or page writes.
const sourceRows = [];
for (const [slug, title] of pageDefinitions) {
  const sourcePath = join(contentDir, `${slug}.html`);
  const sourceContent = await readFile(sourcePath, 'utf8');
  if (!sourceContent.trim()) throw new Error(`Missing or empty content file: ${sourcePath}`);
  for (const phrase of forbiddenPhrases) {
    if (sourceContent.toLowerCase().includes(phrase.toLowerCase())) {
      throw new Error(`Forbidden staging phrase found in ${slug}.html: ${phrase}`);
    }
  }
  const page = await getPublishedPageBySlug(slug);
  if (page) await writeFile(join(backupDir, 'pages', `${slug}.json`), `${JSON.stringify(page, null, 2)}\n`, 'utf8');
  sourceRows.push({ slug, title, sourceContent, page });
}

// Preflight every cryptographically pinned reviewed web derivative before any media/page mutation.
// The full-resolution Drive IDs remain provenance records; public deployment does not depend on anonymous Drive access.
const cardRegistry = JSON.parse(await readFile(catalogCardRegistryPath, 'utf8'));
if (cardRegistry?.schemaVersion !== 1 || !Array.isArray(cardRegistry?.cards)) throw new Error('Invalid catalog strain-card registry');
if (cardRegistry.policy?.requireExactWebDerivativeHash !== true) throw new Error('Catalog strain-card registry must require exact web derivative hashes');

const placeholders = new Set();
const reviewedCards = [];
for (const card of cardRegistry.cards) {
  if (!card.registryId || !card.driveFileId || !card.masterSha256 || !card.webAssetPath || !card.webStagingKey || !card.webFileName || !card.webMimeType || !card.webSha256 || !card.wordpressSlug || !card.placeholder) {
    throw new Error(`${card.registryId || 'unknown'}: catalog strain-card registry entry is missing required fields`);
  }
  if (placeholders.has(card.placeholder)) throw new Error(`Duplicate strain-card placeholder ${card.placeholder}`);
  placeholders.add(card.placeholder);
  const reviewed = await loadReviewedWebCard(card);
  reviewedCards.push(reviewed);
  await writeFile(
    join(backupDir, 'media', `${card.registryId}-source-proof.json`),
    `${JSON.stringify({
      registryId: card.registryId,
      controlledMaster: { driveFileId: card.driveFileId, byteLength: card.masterByteLength, sha256: card.masterSha256 },
      reviewedWebDerivative: { source: reviewed.source, byteLength: reviewed.bytes.length, sha256: reviewed.hash, width: card.webWidth, height: card.webHeight }
    }, null, 2)}\n`,
    'utf8'
  );
}

// Upload/reuse exact reviewed web media and resolve placeholders to stable WordPress URLs.
const mediaByPlaceholder = new Map();
const mediaResults = [];
for (const reviewed of reviewedCards) {
  const media = await ensureCatalogMedia(reviewed);
  mediaByPlaceholder.set(reviewed.card.placeholder, media.source_url);
  mediaResults.push({
    registryId: reviewed.card.registryId,
    mediaId: media.id,
    sourceUrl: media.source_url,
    reviewedSource: reviewed.source,
    reused: Boolean(media.reused)
  });
}
await writeFile(join(backupDir, 'catalog-media-results.json'), `${JSON.stringify(mediaResults, null, 2)}\n`, 'utf8');

const prepared = [];
for (const row of sourceRows) {
  const content = resolveMediaPlaceholders(row.sourceContent, mediaByPlaceholder);
  const needsUpdate = !row.page || editableTitle(row.page) !== normalizeText(row.title) || editableContent(row.page) !== normalizeText(content) || row.page?.status !== 'publish';
  prepared.push({ ...row, content, needsUpdate });
}

await writeFile(
  join(backupDir, 'deployment-plan.json'),
  `${JSON.stringify(prepared.map(({ slug, title, page, needsUpdate }) => ({
    slug,
    title,
    pageId: page?.id || null,
    previousStatus: page?.status || null,
    action: !page ? 'create' : needsUpdate ? 'update' : 'none',
    needsUpdate
  })), null, 2)}\n`,
  'utf8'
);

const results = [];
let changedPages = 0;
let createdPages = 0;
let auxiliaryMutations = 0;
for (const item of prepared) {
  if (!item.page) {
    const created = await createPage(item.slug, item.title, item.content);
    item.page = created;
    item.needsUpdate = false;
    createdPages += 1;
    changedPages += 1;
    await writeFile(join(backupDir, 'pages', `${item.slug}-created.json`), `${JSON.stringify(created, null, 2)}\n`, 'utf8');
    results.push({ slug: item.slug, pageId: created.id, status: created.status, modifiedGmt: created.modified_gmt, link: created.link, changed: true, created: true });
    console.log(`Created /${item.slug}/ (page ID ${created.id})`);
    continue;
  }

  if (!item.needsUpdate) {
    results.push({ slug: item.slug, pageId: item.page.id, status: item.page.status, modifiedGmt: item.page.modified_gmt, link: item.page.link, changed: false, created: false });
    console.log(`Already synchronized /${item.slug}/ (page ID ${item.page.id})`);
    continue;
  }

  const updated = await updatePage(item.page, item.title, item.content);
  item.page = updated;
  changedPages += 1;
  results.push({ slug: item.slug, pageId: updated.id, status: updated.status, modifiedGmt: updated.modified_gmt, link: updated.link, changed: true, created: false });
  console.log(`Updated /${item.slug}/ (page ID ${updated.id})`);
}

// The canonical `home` page must also be the page WordPress serves at `/`.
try {
  const homeItem = prepared.find((item) => item.slug === 'home');
  if (!homeItem?.page?.id) throw new Error('Canonical home page ID is unavailable');
  const settings = await request('/wp-json/wp/v2/settings');
  await writeFile(join(backupDir, 'front-page-settings-before.json'), `${JSON.stringify(settings.body, null, 2)}\n`, 'utf8');

  const expectedFrontPageId = Number(homeItem.page.id);
  const currentFrontPageId = Number(settings.body?.page_on_front || 0);
  const currentMode = String(settings.body?.show_on_front || '');
  if (currentMode !== 'page' || currentFrontPageId !== expectedFrontPageId) {
    const updatedSettings = await request('/wp-json/wp/v2/settings', {
      method: 'POST',
      body: JSON.stringify({ show_on_front: 'page', page_on_front: expectedFrontPageId })
    });
    if (String(updatedSettings.body?.show_on_front || '') !== 'page' || Number(updatedSettings.body?.page_on_front || 0) !== expectedFrontPageId) {
      throw new Error('WordPress did not confirm the canonical home page as the front page');
    }
    auxiliaryMutations += 1;
    console.log(`Set canonical /home/ page ID ${expectedFrontPageId} as the WordPress front page.`);
  } else {
    console.log(`WordPress front page already points to canonical /home/ page ID ${expectedFrontPageId}.`);
  }
} catch (error) {
  throw new Error(`Front-page reconciliation failed: ${error.message}`);
}

// Remove the obsolete posts page only when WordPress confirms that it is the configured posts page and its slug is exactly "blog".
try {
  const settings = await request('/wp-json/wp/v2/settings');
  await writeFile(join(backupDir, 'settings-before.json'), `${JSON.stringify(settings.body, null, 2)}\n`, 'utf8');
  const postsPageId = Number(settings.body?.page_for_posts || 0);
  if (postsPageId > 0) {
    const postsPage = await request(`/wp-json/wp/v2/pages/${postsPageId}?context=edit`);
    if (postsPage.body?.slug === 'blog') {
      await writeFile(join(backupDir, 'pages', 'blog.json'), `${JSON.stringify(postsPage.body, null, 2)}\n`, 'utf8');
      await request('/wp-json/wp/v2/settings', { method: 'POST', body: JSON.stringify({ page_for_posts: 0 }) });
      await request(`/wp-json/wp/v2/pages/${postsPageId}`, { method: 'POST', body: JSON.stringify({ status: 'draft' }) });
      auxiliaryMutations += 1;
      console.log(`Disabled obsolete /blog/ posts page (page ID ${postsPageId})`);
    }
  }
} catch (error) {
  console.warn(`Legacy blog-page cleanup skipped safely: ${error.message}`);
}

for (const title of legacyPostTitles) {
  try {
    auxiliaryMutations += await draftExactLegacyPost(title);
  } catch (error) {
    console.warn(`Legacy post cleanup skipped safely for '${title}': ${error.message}`);
  }
}

const summary = {
  checkedPages: results.length,
  changedPages,
  createdPages,
  catalogMediaCount: mediaResults.length,
  catalogMediaUploaded: mediaResults.filter((item) => !item.reused).length,
  auxiliaryMutations,
  mutationCount: changedPages + auxiliaryMutations + mediaResults.filter((item) => !item.reused).length,
  backupDir
};

await writeFile(join(backupDir, 'deployment-results.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
await writeFile(join(backupDir, 'deployment-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await writeFile(join(backupRoot, 'wordpress-rest-backup-path.txt'), `${backupDir}\n`, 'utf8');

console.log(`REST content reconciliation checked ${results.length} pages; changed ${changedPages}; created ${createdPages}; catalog media ${mediaResults.length}; auxiliary mutations ${auxiliaryMutations}.`);
console.log(`Page-level rollback data: ${backupDir}`);
