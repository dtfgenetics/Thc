import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative, sep } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const assetRoot = process.env.INFOGRAPHIC_DIR || join(process.cwd(), 'site/wordpress/assets/infographics');
const backupRoot = process.env.BACKUP_ROOT || process.cwd();
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const backupDir = join(backupRoot, `wordpress-infographics-${timestamp}`);
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const userAgent = 'DTFSeeds-Education-Media-Publisher/1.1';
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

async function fileRecord(file) {
  const bytes = await readFile(file);
  const rel = posixRelative(file);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const ext = extname(file).toLowerCase();
  const baseSlug = slugify(rel.replace(ext, '')) || 'visual';
  const wpSlug = `dtf-edu-${baseSlug}-${hash.slice(0, 10)}`.slice(0, 190);
  return {
    file,
    bytes,
    rel,
    hash,
    ext,
    mime: mimeByExt[ext],
    label: cleanLabel(rel),
    wpSlug
  };
}

async function findMediaBySlug(slug) {
  const params = new URLSearchParams({ slug, context: 'edit', per_page: '10' });
  const rows = await jsonRequest(`/wp-json/wp/v2/media?${params}`);
  if (!Array.isArray(rows)) throw new Error(`Unexpected media lookup response for ${slug}`);
  if (rows.length > 1) console.warn(`Multiple WordPress media items share slug ${slug}; reusing ID ${rows[0].id}`);
  return rows[0] || null;
}

async function uploadMedia(record) {
  const safeFilename = basename(record.rel).replace(/[^A-Za-z0-9._-]+/g, '-');
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
      description: `Source-controlled DTF/THC educational asset. Repository path: ${record.rel}. SHA-256: ${record.hash}.`
    })
  });
  return updated;
}

async function ensureMedia(record) {
  const existing = await findMediaBySlug(record.wpSlug);
  if (existing?.id && existing?.source_url) {
    return { ...record, media: existing, changed: false };
  }
  const uploaded = await uploadMedia(record);
  return { ...record, media: uploaded, changed: true };
}

async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
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
  console.log(`Created missing /learn/ parent page (page ID ${created.id}).`);
  return created;
}

async function findInfographicPage(parentId) {
  const params = new URLSearchParams({ slug: 'infographics', parent: String(parentId), context: 'edit', per_page: '10' });
  const rows = await jsonRequest(`/wp-json/wp/v2/pages?${params}`);
  if (!Array.isArray(rows)) throw new Error('Unexpected infographic page response');
  if (rows.length > 1) throw new Error(`Expected at most one /learn/infographics/ page; found ${rows.length}`);
  return rows[0] || null;
}

function categoryFor(rel) {
  const value = rel.toLowerCase();
  if (value.includes('root') || value.includes('nutri') || value.includes('macro') || value.includes('micro') || value.includes('soil') || value.includes('media')) return 'Nutrition & Root Zone';
  if (value.includes('pest') || value.includes('mite') || value.includes('insect') || value.includes('biosecurity') || value.includes('deficien') || value.includes('toxicity')) return 'Plant Health & IPM';
  if (value.includes('seed') || value.includes('clone') || value.includes('life_cycle') || value.includes('life-cycle') || value.includes('training') || value.includes('vegetative') || value.includes('flowering')) return 'Lifecycle, Propagation & Training';
  if (value.includes('breed') || value.includes('genetic') || value.includes('sex_expression') || value.includes('chromosome') || value.includes('mops')) return 'Genetics & Breeding';
  if (value.includes('vpd') || value.includes('light') || value.includes('ppfd') || value.includes('dli') || value.includes('temperature') || value.includes('humidity')) return 'Environment & Light';
  if (value.includes('harvest') || value.includes('dry') || value.includes('curing') || value.includes('trichome')) return 'Harvest & Postharvest';
  if (value.includes('pdf-pages/')) return 'Imported Reference Pages';
  return 'Plant Structure, Physiology & Evidence';
}

function buildGalleryContent(records) {
  const groups = new Map();
  for (const item of records) {
    const category = categoryFor(item.rel);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  }

  const preferredOrder = [
    'Plant Structure, Physiology & Evidence',
    'Lifecycle, Propagation & Training',
    'Environment & Light',
    'Nutrition & Root Zone',
    'Plant Health & IPM',
    'Harvest & Postharvest',
    'Genetics & Breeding',
    'Imported Reference Pages'
  ];

  const sections = preferredOrder
    .filter((name) => groups.has(name))
    .map((name) => {
      const figures = groups.get(name).map((item) => {
        const url = escapeHtml(item.media.source_url || item.media.guid?.rendered || '');
        const label = escapeHtml(item.label);
        return `<figure style="margin:0 0 28px"><a href="${url}" target="_blank" rel="noopener"><img src="${url}" loading="lazy" decoding="async" alt="Teaching Healthy Cultivation — ${label}" style="max-width:100%;height:auto;border-radius:12px"></a><figcaption><strong>${label}</strong><br><small>Open the image for the full-size WordPress media asset.</small></figcaption></figure>`;
      }).join('\n');
      return `<section aria-labelledby="${slugify(name)}"><h2 id="${slugify(name)}">${escapeHtml(name)}</h2>${figures}</section>`;
    }).join('\n');

  return `<section aria-labelledby="thc-infographic-library"><p><strong>Teaching Healthy Cultivation</strong></p><h1 id="thc-infographic-library">THC Infographic Library</h1><p>Browse the current source-controlled Teaching Healthy Cultivation visual library. These images are hosted in the DTFSeeds WordPress Media Library so the education pages no longer depend on GitHub's raw-file CDN.</p><p><a href="/learn/"><strong>Back to Teaching Healthy Cultivation</strong></a> &nbsp; <a href="/tools/"><strong>Open cultivation tools</strong></a></p></section>${sections}<hr><p><small>Educational information only. Draft, quarantined, and unresolved Drive QA-intake artwork is not promoted by this page. A visual symptom alone is not proof of a nutrient, pest, or disease diagnosis.</small></p>`;
}

await mkdir(backupDir, { recursive: true });
const rootStats = await stat(assetRoot);
if (!rootStats.isDirectory()) throw new Error(`Infographic directory is not a directory: ${assetRoot}`);

const user = await jsonRequest('/wp-json/wp/v2/users/me?context=edit');
await writeFile(join(backupDir, 'authenticated-user.json'), `${JSON.stringify({ id: user.id, slug: user.slug, roles: user.roles }, null, 2)}\n`);

const files = await collectImages(assetRoot);
if (!files.length) throw new Error(`No image files found in ${assetRoot}`);
console.log(`Found ${files.length} source-controlled infographic images.`);

const sourceRecords = [];
for (const file of files) sourceRecords.push(await fileRecord(file));
await writeFile(join(backupDir, 'source-assets.json'), `${JSON.stringify(sourceRecords.map(({ bytes, ...item }) => item), null, 2)}\n`);

const mediaRecords = await mapConcurrent(sourceRecords, 4, async (record, index) => {
  const result = await ensureMedia(record);
  console.log(`${index + 1}/${sourceRecords.length} ${result.changed ? 'uploaded' : 'reused'}: ${record.rel} -> media ${result.media.id}`);
  return result;
});

const learnPage = await getLearnPage();
const existingPage = await findInfographicPage(learnPage.id);
if (existingPage) await writeFile(join(backupDir, 'infographic-page-before.json'), `${JSON.stringify(existingPage, null, 2)}\n`);

const content = buildGalleryContent(mediaRecords);
const payload = {
  title: 'THC Infographic Library',
  slug: 'infographics',
  parent: learnPage.id,
  content,
  status: 'publish'
};

let page;
if (existingPage) {
  page = await jsonRequest(`/wp-json/wp/v2/pages/${existingPage.id}`, { method: 'POST', body: JSON.stringify(payload) });
} else {
  page = await jsonRequest('/wp-json/wp/v2/pages', { method: 'POST', body: JSON.stringify(payload) });
}
if (!page?.id || !page?.link) throw new Error('WordPress did not confirm infographic library page publication');

const result = {
  generatedAt: new Date().toISOString(),
  sourceImageCount: sourceRecords.length,
  uploadedMediaCount: mediaRecords.filter((item) => item.changed).length,
  reusedMediaCount: mediaRecords.filter((item) => !item.changed).length,
  pageId: page.id,
  pageLink: page.link,
  learnPageId: learnPage.id,
  media: mediaRecords.map((item) => ({
    path: item.rel,
    sha256: item.hash,
    mediaId: item.media.id,
    sourceUrl: item.media.source_url,
    changed: item.changed
  }))
};

await writeFile(join(backupDir, 'deployment-result.json'), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(join(backupRoot, 'wordpress-infographic-backup-path.txt'), `${backupDir}\n`);
console.log(`Published ${result.sourceImageCount} infographic assets to WordPress: ${result.uploadedMediaCount} uploaded, ${result.reusedMediaCount} reused.`);
console.log(`Infographic library: ${result.pageLink}`);
console.log(`Rollback/audit package: ${backupDir}`);
