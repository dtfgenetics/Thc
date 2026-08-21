import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative, sep } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const assetRoot = process.env.INFOGRAPHIC_DIR || join(process.cwd(), 'site/wordpress/assets/infographics');
const placementConfigPath = process.env.INFOGRAPHIC_PLACEMENT_CONFIG || join(assetRoot, 'placement-rules.json');
const backupRoot = process.env.BACKUP_ROOT || process.cwd();
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const backupDir = join(backupRoot, `wordpress-infographics-${timestamp}`);
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const userAgent = 'DTFSeeds-Education-Media-Publisher/2.0';
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const mimeByExt = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function posixRelative(file) {
  return relative(assetRoot, file).split(sep).join('/');
}

function cleanLabel(path) {
  return basename(path, extname(path))
    .replace(/^RECOVERED QA REQUIRED\s*[—_-]?\s*/i, '')
    .replace(/^THC[-_]/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 145);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeForMatch(value = '') {
  return String(value).toLowerCase().replaceAll('\\', '/');
}

function containsAny(value, fragments = []) {
  return fragments.some((fragment) => value.includes(String(fragment).toLowerCase()));
}

function routeSlug(route) {
  return String(route).split('/').filter(Boolean).at(-1) || 'reference';
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
      ...(options.headers || {})
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000)
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 1600) }; }
  }
  if (!response.ok) {
    throw new Error(`WordPress ${path} returned HTTP ${response.status}${body?.message ? `: ${body.message}` : ''}`);
  }
  return body;
}

async function loadPlacementConfig() {
  const raw = await readFile(placementConfigPath, 'utf8');
  const config = JSON.parse(raw);
  if (!Array.isArray(config.categories) || !config.categories.length) throw new Error('Placement config must contain categories');
  if (!config.masterLibraryRoute) throw new Error('Placement config must define masterLibraryRoute');
  const ids = new Set();
  for (const category of config.categories) {
    if (!category.id || !category.title || !category.route) throw new Error('Every placement category requires id, title, and route');
    if (ids.has(category.id)) throw new Error(`Duplicate placement category id: ${category.id}`);
    ids.add(category.id);
  }
  return config;
}

async function collectImages(directory) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await collectImages(full));
    else if (entry.isFile() && imageExtensions.has(extname(entry.name).toLowerCase())) output.push(full);
  }
  return output.sort((a, b) => posixRelative(a).localeCompare(posixRelative(b)));
}

function classifyPlacement(rel, config) {
  const value = normalizeForMatch(rel);
  const fallback = config.categories.find((category) => category.id === 'general-reference') || config.categories.at(-1);
  const primary = config.categories.find((category) => category.id !== fallback.id && containsAny(value, category.primaryMatch || [])) || fallback;
  const placementIds = new Set([primary.id]);
  for (const rule of config.relatedPlacementRules || []) {
    if (containsAny(value, rule.match || [])) {
      for (const id of rule.categoryIds || []) placementIds.add(id);
    }
  }
  return {
    primaryCategoryId: primary.id,
    placementCategoryIds: [...placementIds].filter((id) => config.categories.some((category) => category.id === id))
  };
}

function shouldExclude(rel, config) {
  const value = normalizeForMatch(rel);
  return containsAny(value, config.policy?.excludeNameFragments || []);
}

async function fileRecord(file, config) {
  const bytes = await readFile(file);
  const rel = posixRelative(file);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const ext = extname(file).toLowerCase();
  const baseSlug = slugify(rel.replace(ext, '')) || 'visual';
  const wpSlug = `dtf-edu-${baseSlug}-${hash.slice(0, 10)}`.slice(0, 190);
  const placement = classifyPlacement(rel, config);
  return {
    file,
    bytes,
    rel,
    hash,
    ext,
    mime: mimeByExt[ext],
    label: cleanLabel(rel),
    wpSlug,
    ...placement
  };
}

async function findMediaBySlug(slug) {
  const params = new URLSearchParams({ slug, context: 'edit', per_page: '10' });
  const rows = await jsonRequest(`/wp-json/wp/v2/media?${params}`);
  if (!Array.isArray(rows)) throw new Error(`Unexpected media lookup response for ${slug}`);
  if (rows.length > 1) console.warn(`Multiple WordPress media items share slug ${slug}; reusing ID ${rows[0].id}`);
  return rows[0] || null;
}

async function uploadMedia(record, config) {
  const safeFilename = basename(record.rel).replace(/[^A-Za-z0-9._-]+/g, '-');
  const primary = config.categories.find((category) => category.id === record.primaryCategoryId);
  const response = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
      'Content-Type': record.mime,
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'User-Agent': userAgent
    },
    body: record.bytes,
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000)
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 1600) }; }
  if (!response.ok || !body?.id) {
    throw new Error(`Media upload failed for ${record.rel}: HTTP ${response.status}${body?.message ? `: ${body.message}` : ''}`);
  }

  const updated = await jsonRequest(`/wp-json/wp/v2/media/${body.id}`, {
    method: 'POST',
    body: JSON.stringify({
      slug: record.wpSlug,
      title: record.label,
      alt_text: `Teaching Healthy Cultivation — ${record.label}`,
      caption: `Teaching Healthy Cultivation educational visual: ${record.label}`,
      description: `Source-controlled DTF/THC educational asset. Primary section: ${primary?.title || record.primaryCategoryId}. Repository path: ${record.rel}. SHA-256: ${record.hash}.`
    })
  });
  return updated;
}

async function ensureMedia(record, config) {
  const existing = await findMediaBySlug(record.wpSlug);
  if (existing?.id && existing?.source_url) return { ...record, media: existing, changed: false };
  const uploaded = await uploadMedia(record, config);
  return { ...record, media: uploaded, changed: true };
}

async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          results[index] = await fn(items[index], index);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          console.warn(`Attempt ${attempt}/3 failed for ${items[index].rel}: ${error.message}`);
          if (attempt < 3) await sleep(attempt * 2000);
        }
      }
      if (lastError) throw lastError;
    }
  });
  await Promise.all(workers);
  return results;
}

async function getLearnPage() {
  const params = new URLSearchParams({ slug: 'learn', context: 'edit', per_page: '10' });
  const rows = await jsonRequest(`/wp-json/wp/v2/pages?${params}`);
  if (!Array.isArray(rows)) throw new Error('Unexpected WordPress Learn page response');
  if (rows.length > 1) throw new Error(`Expected at most one WordPress Learn page; found ${rows.length}`);
  if (rows.length === 1) return rows[0];

  const canonicalLearnPath = join(process.cwd(), 'site/wordpress/pages/learn.html');
  const canonicalLearnContent = await readFile(canonicalLearnPath, 'utf8');
  if (!canonicalLearnContent.trim()) throw new Error(`Canonical Learn source is empty: ${canonicalLearnPath}`);

  const created = await jsonRequest('/wp-json/wp/v2/pages', {
    method: 'POST',
    body: JSON.stringify({
      slug: 'learn',
      title: 'Teaching Healthy Cultivation',
      content: canonicalLearnContent,
      status: 'publish'
    })
  });
  if (!created?.id || created?.status !== 'publish') throw new Error('WordPress did not confirm creation of the Learn parent page');
  return created;
}

async function findChildPage(parentId, slug) {
  const params = new URLSearchParams({ slug, parent: String(parentId), context: 'edit', per_page: '10' });
  const rows = await jsonRequest(`/wp-json/wp/v2/pages?${params}`);
  if (!Array.isArray(rows)) throw new Error(`Unexpected page response for ${slug}`);
  if (rows.length > 1) throw new Error(`Expected at most one child page ${slug}; found ${rows.length}`);
  return rows[0] || null;
}

async function upsertChildPage(parentId, { title, route, content }) {
  const slug = routeSlug(route);
  const existing = await findChildPage(parentId, slug);
  if (existing) await writeFile(join(backupDir, `page-before-${slug}.json`), `${JSON.stringify(existing, null, 2)}\n`);
  const payload = { title, slug, parent: parentId, content, status: 'publish' };
  const page = existing
    ? await jsonRequest(`/wp-json/wp/v2/pages/${existing.id}`, { method: 'POST', body: JSON.stringify(payload) })
    : await jsonRequest('/wp-json/wp/v2/pages', { method: 'POST', body: JSON.stringify(payload) });
  if (!page?.id || !page?.link) throw new Error(`WordPress did not confirm publication of ${route}`);
  return page;
}

function figureHtml(item) {
  const url = escapeHtml(item.media.source_url || item.media.guid?.rendered || '');
  const label = escapeHtml(item.label);
  return `<figure style="margin:0 0 28px"><a href="${url}" target="_blank" rel="noopener"><img src="${url}" loading="lazy" decoding="async" alt="Teaching Healthy Cultivation — ${label}" style="max-width:100%;height:auto;border-radius:12px"></a><figcaption><strong>${label}</strong><br><small>Open the image for the full-size WordPress media asset.</small></figcaption></figure>`;
}

function buildMasterLibraryContent(records, config) {
  const grouped = new Map(config.categories.map((category) => [category.id, []]));
  for (const item of records) grouped.get(item.primaryCategoryId)?.push(item);

  const nav = config.categories
    .filter((category) => (grouped.get(category.id) || []).length)
    .map((category) => `<a href="#${escapeHtml(category.id)}">${escapeHtml(category.title)}</a>`)
    .join(' · ');

  const sections = config.categories
    .filter((category) => (grouped.get(category.id) || []).length)
    .map((category) => {
      const items = grouped.get(category.id);
      const topicLink = `<p><a href="${escapeHtml(category.route)}"><strong>Open ${escapeHtml(category.title)}</strong></a></p>`;
      return `<section aria-labelledby="${escapeHtml(category.id)}"><h2 id="${escapeHtml(category.id)}">${escapeHtml(category.title)}</h2><p>${escapeHtml(category.description)}</p>${topicLink}${items.map(figureHtml).join('\n')}</section>`;
    })
    .join('\n');

  return `<section aria-labelledby="thc-infographic-library"><p><strong>Teaching Healthy Cultivation</strong></p><h1 id="thc-infographic-library">THC Infographic Library</h1><p>Browse the source-controlled Teaching Healthy Cultivation visual library. Each visual is stored once in the DTFSeeds WordPress Media Library, then reused in the most relevant education sections.</p><p>${nav}</p><p><a href="/learn/"><strong>Back to Teaching Healthy Cultivation</strong></a> &nbsp; <a href="/tools/"><strong>Open cultivation tools</strong></a></p></section>${sections}<hr><p><small>Educational information only. Canonical source-controlled visuals are published; draft, quarantined, and superseded source material remains outside the public library. A visual symptom alone is not proof of a nutrient, pest, or disease diagnosis.</small></p>`;
}

function buildTopicPageContent(category, records, config) {
  const matched = records.filter((item) => item.placementCategoryIds.includes(category.id));
  const primary = matched.filter((item) => item.primaryCategoryId === category.id);
  const related = matched.filter((item) => item.primaryCategoryId !== category.id);
  const primaryHtml = primary.length ? primary.map(figureHtml).join('\n') : '<p>No primary visuals are currently assigned to this section.</p>';
  const relatedHtml = related.length
    ? `<section aria-labelledby="${escapeHtml(category.id)}-related"><h2 id="${escapeHtml(category.id)}-related">Related visuals</h2><p>These visuals also apply to this topic but have a different primary home.</p>${related.map(figureHtml).join('\n')}</section>`
    : '';
  return `<section aria-labelledby="${escapeHtml(category.id)}-title"><p><strong>Teaching Healthy Cultivation</strong></p><h1 id="${escapeHtml(category.id)}-title">${escapeHtml(category.title)}</h1><p>${escapeHtml(category.description)}</p><p><a href="/learn/"><strong>Education home</strong></a> &nbsp; <a href="${escapeHtml(config.masterLibraryRoute)}"><strong>Full infographic library</strong></a></p></section><section aria-labelledby="${escapeHtml(category.id)}-visuals"><h2 id="${escapeHtml(category.id)}-visuals">Core visuals</h2>${primaryHtml}</section>${relatedHtml}<hr><p><small>Educational information only. Use measurements, plant context, and multiple observations before diagnosing or changing a crop-management practice.</small></p>`;
}

await mkdir(backupDir, { recursive: true });
const rootStats = await stat(assetRoot);
if (!rootStats.isDirectory()) throw new Error(`Infographic directory is not a directory: ${assetRoot}`);

const config = await loadPlacementConfig();
await writeFile(join(backupDir, 'placement-rules.json'), `${JSON.stringify(config, null, 2)}\n`);

const user = await jsonRequest('/wp-json/wp/v2/users/me?context=edit');
await writeFile(join(backupDir, 'authenticated-user.json'), `${JSON.stringify({ id: user.id, slug: user.slug, roles: user.roles }, null, 2)}\n`);

const discoveredFiles = await collectImages(assetRoot);
if (!discoveredFiles.length) throw new Error(`No image files found in ${assetRoot}`);
const excludedFiles = discoveredFiles.filter((file) => shouldExclude(posixRelative(file), config));
const files = discoveredFiles.filter((file) => !shouldExclude(posixRelative(file), config));
if (!files.length) throw new Error('All discovered images were excluded by placement policy');
console.log(`Found ${discoveredFiles.length} images: ${files.length} publication-ready, ${excludedFiles.length} excluded by policy.`);

const sourceRecords = [];
for (const file of files) sourceRecords.push(await fileRecord(file, config));
await writeFile(join(backupDir, 'source-assets.json'), `${JSON.stringify(sourceRecords.map(({ bytes, ...item }) => item), null, 2)}\n`);
await writeFile(join(backupDir, 'excluded-assets.json'), `${JSON.stringify(excludedFiles.map((file) => posixRelative(file)), null, 2)}\n`);

const mediaRecords = await mapConcurrent(sourceRecords, 4, async (record, index) => {
  const result = await ensureMedia(record, config);
  console.log(`${index + 1}/${sourceRecords.length} ${result.changed ? 'uploaded' : 'reused'}: ${record.rel} -> media ${result.media.id}`);
  return result;
});

const learnPage = await getLearnPage();
const masterPage = await upsertChildPage(learnPage.id, {
  title: 'THC Infographic Library',
  route: config.masterLibraryRoute,
  content: buildMasterLibraryContent(mediaRecords, config)
});

const topicPages = [];
for (const category of config.categories) {
  const count = mediaRecords.filter((item) => item.placementCategoryIds.includes(category.id)).length;
  if (!count) continue;
  const page = await upsertChildPage(learnPage.id, {
    title: category.title,
    route: category.route,
    content: buildTopicPageContent(category, mediaRecords, config)
  });
  topicPages.push({ categoryId: category.id, title: category.title, route: category.route, pageId: page.id, link: page.link, imageCount: count });
}

const placementSummary = config.categories.map((category) => ({
  categoryId: category.id,
  title: category.title,
  route: category.route,
  primaryCount: mediaRecords.filter((item) => item.primaryCategoryId === category.id).length,
  totalPlacementCount: mediaRecords.filter((item) => item.placementCategoryIds.includes(category.id)).length
}));
await writeFile(join(backupDir, 'placement-summary.json'), `${JSON.stringify(placementSummary, null, 2)}\n`);

const result = {
  generatedAt: new Date().toISOString(),
  discoveredSourceImageCount: discoveredFiles.length,
  sourceImageCount: sourceRecords.length,
  excludedImageCount: excludedFiles.length,
  uploadedMediaCount: mediaRecords.filter((item) => item.changed).length,
  reusedMediaCount: mediaRecords.filter((item) => !item.changed).length,
  pageId: masterPage.id,
  pageLink: masterPage.link,
  learnPageId: learnPage.id,
  topicPages,
  placementSummary,
  media: mediaRecords.map((item) => ({
    path: item.rel,
    sha256: item.hash,
    mediaId: item.media.id,
    sourceUrl: item.media.source_url,
    primaryCategoryId: item.primaryCategoryId,
    placementCategoryIds: item.placementCategoryIds,
    changed: item.changed
  }))
};

await writeFile(join(backupDir, 'deployment-result.json'), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(join(backupRoot, 'wordpress-infographic-backup-path.txt'), `${backupDir}\n`);
console.log(`Published ${result.sourceImageCount} educational images to WordPress: ${result.uploadedMediaCount} uploaded, ${result.reusedMediaCount} reused.`);
console.log(`Master infographic library: ${result.pageLink}`);
console.log(`Topic pages published/updated: ${result.topicPages.length}`);
console.log(`Rollback/audit package: ${backupDir}`);
