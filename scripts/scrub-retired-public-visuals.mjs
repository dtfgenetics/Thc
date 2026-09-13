import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_RETIRED_VISUAL_SCRUB || '').toLowerCase() === 'true';
const deleteRetiredMedia = String(process.env.DELETE_RETIRED_VISUAL_MEDIA || '').toLowerCase() === 'true';
const rulesPath = process.env.RETIRED_VISUAL_RULES || join(process.cwd(), 'site/wordpress/visual-quality/retired-public-visuals.json');
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-retired-visual-scrub';
const timestamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `retired-visual-scrub-${timestamp}`);

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
await mkdir(backupDir, { recursive: true });

const rules = JSON.parse(await readFile(rulesPath, 'utf8'));
const approvalMarker = String(rules.approvalMarker || 'DTF_APPROVED_PUBLIC_VISUAL').toLowerCase();
const retireContains = (rules.retireTextContains || []).map((value) => String(value).toLowerCase());
const retireRegex = (rules.retireRegex || []).map((value) => new RegExp(value, 'i'));
const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const baseHeaders = {
  Authorization: auth,
  Accept: 'application/json',
  'Cache-Control': 'no-cache',
  'User-Agent': 'DTFSeeds-Retired-Visual-Guard/1.0'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        headers: {
          ...baseHeaders,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000)
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if ((response.status === 429 || response.status >= 500) && attempt < 5) {
        await sleep(attempt * 1600);
        continue;
      }
      if (!response.ok) {
        throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
      }
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 5) {
        await sleep(attempt * 1600);
        continue;
      }
    }
  }
  throw lastError;
}

function rendered(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.raw || value.rendered || '';
  return '';
}

function mediaText(item) {
  return [
    item?.slug,
    rendered(item?.title),
    item?.alt_text,
    rendered(item?.caption),
    rendered(item?.description),
    item?.source_url
  ].filter(Boolean).join(' ');
}

function isRetiredMedia(item) {
  const text = mediaText(item);
  const lower = text.toLowerCase();
  if (!text || lower.includes(approvalMarker)) return false;
  if (retireContains.some((needle) => lower.includes(needle))) return true;
  return retireRegex.some((regex) => regex.test(text));
}

async function fetchAll(path, { limitPages = 100 } = {}) {
  const rows = [];
  for (let page = 1; page <= limitPages; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    try {
      const batch = await request(`${path}${separator}per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      rows.push(...batch);
      if (batch.length < 100) break;
    } catch (error) {
      if (/rest_post_invalid_page_number|invalid page|\(400\)/i.test(error.message)) break;
      throw error;
    }
  }
  return rows;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createFingerprints(retired) {
  const urls = retired.map((item) => item.source_url).filter(Boolean);
  const filenames = urls.map((url) => {
    try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || ''); } catch { return ''; }
  }).filter(Boolean);
  const ids = retired.map((item) => Number(item.id)).filter(Number.isFinite);
  return { urls, filenames, ids };
}

function blockContainsRetired(block, fingerprints) {
  const lower = String(block || '').toLowerCase();
  if (fingerprints.urls.some((url) => lower.includes(String(url).toLowerCase()))) return true;
  if (fingerprints.filenames.some((name) => lower.includes(String(name).toLowerCase()))) return true;
  return fingerprints.ids.some((id) =>
    lower.includes(`wp-image-${id}`) ||
    lower.includes(`"id":${id}`) ||
    lower.includes(`"id": ${id}`) ||
    lower.includes(`data-id="${id}"`) ||
    lower.includes(`data-id='${id}'`)
  );
}

function scrubHtml(html, fingerprints) {
  let next = String(html || '');
  let removed = 0;
  const removeMatchingBlocks = (regex) => {
    next = next.replace(regex, (block) => {
      if (!blockContainsRetired(block, fingerprints)) return block;
      removed += 1;
      return '';
    });
  };

  removeMatchingBlocks(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi);
  removeMatchingBlocks(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi);
  removeMatchingBlocks(/<a\b[^>]*>[\s\S]*?<img\b[^>]*>[\s\S]*?<\/a>/gi);
  removeMatchingBlocks(/<img\b[^>]*>/gi);
  removeMatchingBlocks(/<source\b[^>]*>/gi);
  removeMatchingBlocks(/<!--\s*wp:image\s+\{[\s\S]*?\}\s*-->/gi);

  for (const url of fingerprints.urls) {
    const encoded = escapeRegExp(url);
    next = next.replace(new RegExp(`background(?:-image)?\\s*:\\s*url\\((['"]?)${encoded}\\1\\)\\s*;?`, 'gi'), () => {
      removed += 1;
      return '';
    });
  }

  next = next
    .replace(/<figure\b[^>]*>\s*<\/figure>/gi, '')
    .replace(/<picture\b[^>]*>\s*<\/picture>/gi, '')
    .replace(/\n{3,}/g, '\n\n');

  return { html: next, removed };
}

function itemDescriptor(typeName, item) {
  return {
    type: typeName,
    id: item.id,
    slug: item.slug || '',
    title: rendered(item.title || '')
  };
}

async function discoverPublicTypes() {
  const types = await request('/wp-json/wp/v2/types?context=edit');
  return Object.entries(types || {})
    .filter(([name, type]) => {
      if (!type?.rest_base || type?.viewable === false) return false;
      if (['attachment', 'wp_block', 'wp_template', 'wp_template_part', 'wp_navigation', 'nav_menu_item'].includes(name)) return false;
      return true;
    })
    .map(([name, type]) => ({ name, restBase: type.rest_base }));
}

const media = await fetchAll('/wp-json/wp/v2/media?context=edit');
const retired = media.filter(isRetiredMedia);
const fingerprints = createFingerprints(retired);
await writeFile(join(backupDir, 'retired-media-index.json'), `${JSON.stringify(retired.map((item) => ({
  id: item.id,
  slug: item.slug,
  title: rendered(item.title),
  alt_text: item.alt_text || '',
  source_url: item.source_url || ''
})), null, 2)}\n`);

const publicTypes = await discoverPublicTypes();
const changed = [];
const inspected = [];

for (const type of publicTypes) {
  let items;
  try {
    items = await fetchAll(`/wp-json/wp/v2/${type.restBase}?context=edit`);
  } catch (error) {
    if (/401|403|404|rest_no_route/i.test(error.message)) continue;
    throw error;
  }

  for (const item of items) {
    const content = rendered(item.content);
    const { html, removed } = scrubHtml(content, fingerprints);
    const featuredRetired = fingerprints.ids.includes(Number(item.featured_media || 0));
    inspected.push(itemDescriptor(type.name, item));
    if (!removed && !featuredRetired) continue;

    const beforePath = join(backupDir, 'content', type.name, `${item.id}-${item.slug || 'item'}.json`);
    await mkdir(dirname(beforePath), { recursive: true });
    await writeFile(beforePath, `${JSON.stringify(item, null, 2)}\n`);

    const payload = {};
    if (html !== content) payload.content = html;
    if (featuredRetired) payload.featured_media = 0;

    if (apply) {
      await request(`/wp-json/wp/v2/${type.restBase}/${item.id}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    changed.push({ ...itemDescriptor(type.name, item), removedBlocks: removed, clearedFeaturedMedia: featuredRetired });
  }
}

const deletedMedia = [];
if (apply && deleteRetiredMedia) {
  for (const item of retired) {
    try {
      await request(`/wp-json/wp/v2/media/${item.id}?force=true`, { method: 'DELETE' });
      deletedMedia.push({ id: item.id, slug: item.slug, source_url: item.source_url || '' });
    } catch (error) {
      throw new Error(`Failed deleting retired media ${item.id} (${item.slug || 'no-slug'}): ${error.message}`);
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  apply,
  deleteRetiredMedia,
  policySchemaVersion: rules.schemaVersion || null,
  approvalMarker: rules.approvalMarker || null,
  mediaInspected: media.length,
  retiredMediaMatched: retired.length,
  publicTypesInspected: publicTypes,
  contentItemsInspected: inspected.length,
  contentItemsChanged: changed.length,
  changed,
  deletedMediaCount: deletedMedia.length,
  deletedMedia
};

await writeFile(join(backupDir, 'scrub-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'retired-visual-scrub-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
