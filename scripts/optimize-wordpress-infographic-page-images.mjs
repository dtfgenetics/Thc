import dns from 'node:dns';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

dns.setDefaultResultOrder('ipv4first');

const SELF_TEST = process.argv.includes('--self-test');
const TARGET_WIDTH = 768;
const MAX_SRCSET_WIDTH = 1280;
const RESPONSIVE_SIZES = '(max-width: 700px) 92vw, (max-width: 1100px) 46vw, 360px';

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

function sourceUrl(media) {
  return media?.source_url || media?.guid?.rendered || '';
}

function candidateMime(candidate = {}) {
  return String(candidate.mime_type || candidate.mime || '').toLowerCase();
}

function formatRank(candidate = {}) {
  const mime = candidateMime(candidate);
  const url = String(candidate.source_url || '').toLowerCase();
  if (mime.includes('avif') || url.endsWith('.avif')) return 3;
  if (mime.includes('webp') || url.endsWith('.webp')) return 2;
  return 1;
}

function responsiveCandidates(media) {
  const full = sourceUrl(media);
  const details = media?.media_details || {};
  const candidates = [];
  for (const size of Object.values(details.sizes || {})) {
    if (!size?.source_url || !(Number(size.width) > 0) || !(Number(size.height) > 0)) continue;
    candidates.push({
      url: String(size.source_url),
      width: Number(size.width),
      height: Number(size.height),
      mime_type: size.mime_type || ''
    });
  }
  const fullWidth = Number(details.width || 0);
  const fullHeight = Number(details.height || 0);
  if (full && fullWidth > 0 && fullHeight > 0 && fullWidth <= MAX_SRCSET_WIDTH) {
    candidates.push({ url: full, width: fullWidth, height: fullHeight, mime_type: media?.mime_type || '' });
  }
  if (!candidates.length && full) {
    return [{ url: full, width: fullWidth || 0, height: fullHeight || 0, mime_type: media?.mime_type || '' }];
  }

  const withinLimit = candidates.filter((candidate) => candidate.width <= MAX_SRCSET_WIDTH);
  const pool = withinLimit.length ? withinLimit : candidates;
  const byWidth = new Map();
  for (const candidate of pool) {
    const current = byWidth.get(candidate.width);
    if (!current || formatRank(candidate) > formatRank(current)) byWidth.set(candidate.width, candidate);
  }
  return [...byWidth.values()].sort((a, b) => a.width - b.width);
}

function responsiveSpec(media) {
  const candidates = responsiveCandidates(media);
  if (!candidates.length) return null;
  const chosen = candidates.find((candidate) => candidate.width >= TARGET_WIDTH) || candidates.at(-1);
  const useful = candidates.filter((candidate) => candidate.width > 0);
  return {
    src: chosen.url,
    width: chosen.width,
    height: chosen.height,
    srcset: useful.length > 1 ? useful.map((candidate) => `${candidate.url} ${candidate.width}w`).join(', ') : '',
    sizes: useful.length > 1 ? RESPONSIVE_SIZES : '',
    full: sourceUrl(media),
    responsive: useful.length > 1 || (chosen.url && chosen.url !== sourceUrl(media))
  };
}

function readAttr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

function setAttr(tag, name, value) {
  const pattern = new RegExp(`\\s${name}="[^"]*"`, 'i');
  const serialized = ` ${name}="${esc(value)}"`;
  if (pattern.test(tag)) return tag.replace(pattern, serialized);
  return tag.replace(/\s*\/?>(\s*)$/, `${serialized}>$1`);
}

function removeAttr(tag, name) {
  return tag.replace(new RegExp(`\\s${name}="[^"]*"`, 'ig'), '');
}

function mergeClass(tag, className) {
  const current = readAttr(tag, 'class').split(/\s+/).filter(Boolean);
  const merged = [...new Set([...current, ...className.split(/\s+/).filter(Boolean)])];
  return setAttr(tag, 'class', merged.join(' '));
}

function optimizeImgTag(tag, media) {
  const spec = responsiveSpec(media);
  if (!spec?.src) return { tag, responsive: false, changed: false };
  let next = tag;
  next = setAttr(next, 'src', spec.src);
  if (spec.srcset) {
    next = setAttr(next, 'srcset', spec.srcset);
    next = setAttr(next, 'sizes', spec.sizes);
  } else {
    next = removeAttr(next, 'srcset');
    next = removeAttr(next, 'sizes');
  }
  if (spec.width > 0 && spec.height > 0) {
    next = setAttr(next, 'width', String(spec.width));
    next = setAttr(next, 'height', String(spec.height));
  }
  next = setAttr(next, 'loading', 'lazy');
  next = setAttr(next, 'decoding', 'async');
  next = mergeClass(next, `wp-image-${media.id} dtf-responsive-education`);
  return { tag: next, responsive: spec.responsive, changed: next !== tag };
}

function buildMediaLookup(mediaItems) {
  const lookup = new Map();
  for (const media of mediaItems) {
    const urls = [sourceUrl(media)];
    for (const size of Object.values(media?.media_details?.sizes || {})) if (size?.source_url) urls.push(String(size.source_url));
    for (const url of urls.filter(Boolean)) lookup.set(url.replaceAll('&amp;', '&'), media);
  }
  return lookup;
}

function optimizeContent(html, mediaItems) {
  const lookup = buildMediaLookup(mediaItems);
  let changedTags = 0;
  let responsiveTags = 0;
  let matchedTags = 0;
  const content = String(html).replace(/<img\b[^>]*>/gi, (tag) => {
    const currentSrc = readAttr(tag, 'src').replaceAll('&amp;', '&');
    const media = lookup.get(currentSrc);
    if (!media) return tag;
    matchedTags += 1;
    const result = optimizeImgTag(tag, media);
    if (result.changed) changedTags += 1;
    if (result.responsive) responsiveTags += 1;
    return result.tag;
  });
  return { content, changedTags, responsiveTags, matchedTags };
}

function runSelfTest() {
  const media = [{
    id: 42,
    source_url: 'https://example.test/wp-content/uploads/2026/08/example.png',
    mime_type: 'image/png',
    media_details: {
      width: 2000,
      height: 2500,
      sizes: {
        medium: { source_url: 'https://example.test/wp-content/uploads/2026/08/example-240x300.png', width: 240, height: 300, mime_type: 'image/png' },
        medium_large: { source_url: 'https://example.test/wp-content/uploads/2026/08/example-614x768.png', width: 614, height: 768, mime_type: 'image/png' },
        large: { source_url: 'https://example.test/wp-content/uploads/2026/08/example-819x1024.png', width: 819, height: 1024, mime_type: 'image/png' }
      }
    }
  }];
  const full = media[0].source_url;
  const input = `<article><a href="${full}"><img src="${full}" alt="Example"></a></article>`;
  const first = optimizeContent(input, media);
  if (!first.content.includes(`href="${full}"`)) throw new Error('Self-test changed the full-size anchor');
  if (!first.content.includes('src="https://example.test/wp-content/uploads/2026/08/example-819x1024.png"')) throw new Error('Self-test did not select a responsive display source');
  if (!first.content.includes('srcset="')) throw new Error('Self-test did not add srcset');
  if (!first.content.includes('sizes="')) throw new Error('Self-test did not add sizes');
  if (!first.content.includes('wp-image-42')) throw new Error('Self-test did not associate attachment class');
  if (first.responsiveTags !== 1) throw new Error('Self-test did not count responsive image');
  const second = optimizeContent(first.content, media);
  if (second.content !== first.content) throw new Error('Responsive optimization is not idempotent');
  if (second.changedTags !== 0 || second.matchedTags !== 1 || second.responsiveTags !== 1) {
    throw new Error('Self-test persistence/idempotence counters are inconsistent');
  }
  console.log(JSON.stringify({ selfTest: 'passed', responsiveTags: first.responsiveTags, persistedMutationCandidates: second.changedTags }, null, 2));
}

if (SELF_TEST) {
  runSelfTest();
  process.exit(0);
}

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/wordpress-infographic-backups';
const literaturePath = process.env.TOPIC_LITERATURE_CONFIG || join(process.cwd(), 'site/wordpress/education/topic-literature.json');
if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'DTFSeeds-Responsive-Education-Images/1.1'
};
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `responsive-images-${stamp}`);
await mkdir(backupDir, { recursive: true });
const literature = JSON.parse(await readFile(literaturePath, 'utf8'));

const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
const transientCodes = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function errorCode(error) {
  return error?.code || error?.cause?.code || error?.cause?.errors?.find?.((entry) => entry?.code)?.code || '';
}

function isTransientError(error) {
  const status = Number(error?.status || 0);
  return transientStatuses.has(status)
    || error instanceof TypeError
    || error?.name === 'TimeoutError'
    || error?.name === 'AbortError'
    || transientCodes.has(errorCode(error));
}

function retryDelay(attempt) {
  return Math.min(12_000, 1200 + attempt * 1800);
}

async function request(path, options = {}, attempts = 8) {
  const method = String(options.method || 'GET').toUpperCase();
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000)
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if (!response.ok) {
        const error = new Error(`${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
        error.status = response.status;
        throw error;
      }
      return body;
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt >= attempts) throw error;
      const delay = retryDelay(attempt);
      console.warn(`[responsive-education-retry] ${method} ${path} failed with ${errorCode(error) || error?.name || error?.status || 'transient error'}; retrying ${attempt}/${attempts} in ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastError || new Error(`${method} ${path} failed after ${attempts} attempts`);
}

async function getLearn() {
  const rows = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`Expected exactly one Learn page; found ${Array.isArray(rows) ? rows.length : 'invalid response'}`);
  return rows[0];
}

async function getChild(parentId, route) {
  const slug = String(route).split('/').filter(Boolean).at(-1);
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&parent=${parentId}&context=edit&per_page=10`);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`Expected exactly one WordPress page for ${route}; found ${Array.isArray(rows) ? rows.length : 'invalid response'}`);
  return rows[0];
}

async function getPageById(pageId) {
  return request(`/wp-json/wp/v2/pages/${pageId}?context=edit`);
}

async function allEducationMedia() {
  const out = [];
  for (let page = 1; page <= 12; page += 1) {
    try {
      const rows = await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);
      if (!Array.isArray(rows) || !rows.length) break;
      out.push(...rows);
      if (rows.length < 100) break;
    } catch (error) {
      if (/invalid_page|400/i.test(error.message)) break;
      throw error;
    }
  }
  return out.filter((media) => String(media.slug || '').startsWith('dtf-edu-') && sourceUrl(media));
}

const learn = await getLearn();
const routes = [...new Set([...(literature.topics || []).map((topic) => topic.route), '/learn/infographics/'])];
const mediaItems = await allEducationMedia();
if (mediaItems.length < 20) throw new Error(`Only ${mediaItems.length} DTF education media items were found`);

const pageReports = [];
let totalMatched = 0;
let totalResponsive = 0;
let totalChanged = 0;
let totalPersistedMatched = 0;
let totalPersistedResponsive = 0;
let totalPersistedMutationCandidates = 0;
for (const route of routes) {
  const page = await getChild(learn.id, route);
  const raw = page?.content?.raw || page?.content?.rendered || '';
  const optimized = optimizeContent(raw, mediaItems);
  totalMatched += optimized.matchedTags;
  totalResponsive += optimized.responsiveTags;
  totalChanged += optimized.changedTags;
  const slug = String(route).split('/').filter(Boolean).at(-1);
  if (optimized.changedTags > 0) {
    await writeFile(join(backupDir, `before-${slug}.json`), `${JSON.stringify(page, null, 2)}\n`);
    const updated = await request(`/wp-json/wp/v2/pages/${page.id}`, {
      method: 'POST',
      body: JSON.stringify({ content: optimized.content, status: 'publish' })
    });
    if (!updated?.id || updated?.status !== 'publish') throw new Error(`WordPress did not confirm responsive image update for ${route}`);
  }

  // Re-read edit context after the write. This separates WordPress persistence
  // from public-page cache/render behavior: a second optimization pass must be
  // a no-op if src/srcset/sizes/classes were actually retained by WordPress.
  const persistedPage = optimized.changedTags > 0 ? await getPageById(page.id) : page;
  const persistedRaw = persistedPage?.content?.raw || persistedPage?.content?.rendered || '';
  const persisted = optimizeContent(persistedRaw, mediaItems);
  totalPersistedMatched += persisted.matchedTags;
  totalPersistedResponsive += persisted.responsiveTags;
  totalPersistedMutationCandidates += persisted.changedTags;
  await writeFile(join(backupDir, `persisted-${slug}.html`), String(persistedRaw), 'utf8');

  if (persisted.matchedTags !== optimized.matchedTags) {
    throw new Error(`${route}: WordPress edit-context retained ${persisted.matchedTags}/${optimized.matchedTags} matched education images`);
  }
  if (persisted.responsiveTags !== optimized.responsiveTags) {
    throw new Error(`${route}: WordPress edit-context retained ${persisted.responsiveTags}/${optimized.responsiveTags} responsive image candidates`);
  }
  if (persisted.changedTags !== 0) {
    throw new Error(`${route}: WordPress edit-context still needs ${persisted.changedTags} responsive-image mutations after save; attributes did not persist exactly`);
  }

  pageReports.push({
    route,
    pageId: page.id,
    matchedTags: optimized.matchedTags,
    responsiveTags: optimized.responsiveTags,
    changedTags: optimized.changedTags,
    persistedMatchedTags: persisted.matchedTags,
    persistedResponsiveTags: persisted.responsiveTags,
    persistedMutationCandidates: persisted.changedTags
  });
}

if (totalMatched < 20) throw new Error(`Only ${totalMatched} education image tags matched WordPress media`);
if (totalResponsive < 20) throw new Error(`Only ${totalResponsive} education image tags have responsive attachment sizes`);
if (totalPersistedMatched !== totalMatched) throw new Error(`WordPress edit-context retained ${totalPersistedMatched}/${totalMatched} matched education images`);
if (totalPersistedResponsive !== totalResponsive) throw new Error(`WordPress edit-context retained ${totalPersistedResponsive}/${totalResponsive} responsive education images`);
if (totalPersistedMutationCandidates !== 0) throw new Error(`WordPress edit-context still needs ${totalPersistedMutationCandidates} responsive-image mutations after save`);

const report = {
  generatedAt: new Date().toISOString(),
  mediaItems: mediaItems.length,
  pagesInspected: routes.length,
  matchedImageTags: totalMatched,
  responsiveImageTags: totalResponsive,
  changedImageTags: totalChanged,
  persistedMatchedImageTags: totalPersistedMatched,
  persistedResponsiveImageTags: totalPersistedResponsive,
  persistedMutationCandidates: totalPersistedMutationCandidates,
  pages: pageReports
};
await writeFile(join(backupDir, 'responsive-image-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'responsive-image-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
