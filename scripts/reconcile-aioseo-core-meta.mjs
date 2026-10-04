import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const metadataPath = process.env.CORE_META_PATH || join(repoRoot, 'site/wordpress/seo/core-page-meta.json');
const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_AIOSEO_CORE_META || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-aioseo-core-meta';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const manifest = JSON.parse(await readFile(metadataPath, 'utf8'));
if (!Array.isArray(manifest.pages) || !manifest.pages.length) throw new Error('Core SEO metadata manifest has no pages');

const seen = new Set();
for (const page of manifest.pages) {
  if (!page?.slug || !page?.route || !page?.title || !page?.description) throw new Error('Every metadata record requires slug, route, title, and description');
  if (seen.has(page.slug)) throw new Error(`Duplicate metadata slug: ${page.slug}`);
  seen.add(page.slug);
  if (page.title.length > 60) throw new Error(`${page.slug} title is longer than 60 characters (${page.title.length})`);
  if (page.description.length < 80 || page.description.length > 160) throw new Error(`${page.slug} description must be 80–160 characters; saw ${page.description.length}`);
}

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-AIOSEO-Core-Meta/1.0' };
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
        headers: { ...headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
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

async function getPage(slug) {
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`Expected exactly one page for slug ${slug}; saw ${Array.isArray(rows) ? rows.length : 'invalid response'}`);
  return rows[0];
}

async function getAioseo(postId) {
  const body = await request(`/wp-json/aioseo/v1/post?postId=${postId}`);
  if (!body?.success || !body?.data?.currentPost) throw new Error(`AIOSEO response did not include currentPost for post ${postId}`);
  return body.data.currentPost;
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))?.[1] || '';
}
function extractMeta(html) {
  const out = { title: '', description: '', ogDescription: '', twitterDescription: '' };
  out.title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const name = attr(tag, 'name').toLowerCase();
    const property = attr(tag, 'property').toLowerCase();
    const content = attr(tag, 'content');
    if (name === 'description') out.description = content;
    if (property === 'og:description') out.ogDescription = content;
    if (name === 'twitter:description') out.twitterDescription = content;
  }
  return out;
}

const preserveKeys = [
  'canonicalUrl','default','noindex','nofollow','noarchive','notranslate','noimageindex','nosnippet','noodp',
  'maxSnippet','maxVideoPreview','maxImagePreview','pillar_content','frequency','priority','limit_modified_date',
  'og_object_type','og_image_type','og_image_custom_url','og_image_custom_fields',
  'twitter_use_og','twitter_card','twitter_image_type','twitter_image_custom_url','twitter_image_custom_fields'
];

const reports = [];
for (const intended of manifest.pages) {
  const page = await getPage(intended.slug);
  const postId = Number(page.id || 0);
  const before = await getAioseo(postId);
  await writeFile(join(backupDir, `${intended.slug}-before.json`), `${JSON.stringify(before, null, 2)}\n`);

  let after = before;
  let rollbackAttempted = false;
  let publicVerification = { verified: false };

  if (apply) {
    const payload = {
      ...before,
      id: postId,
      title: intended.title,
      description: intended.description,
      og_title: intended.title,
      og_description: intended.description,
      twitter_title: intended.title,
      twitter_description: intended.description
    };
    await request('/wp-json/aioseo/v1/post', { method: 'POST', body: JSON.stringify(payload) });
    after = await getAioseo(postId);

    const changedUnexpected = preserveKeys.filter((key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null));
    const metadataOk = after.title === intended.title &&
      after.description === intended.description &&
      after.og_title === intended.title &&
      after.og_description === intended.description &&
      after.twitter_title === intended.title &&
      after.twitter_description === intended.description;

    if (!metadataOk || changedUnexpected.length) {
      rollbackAttempted = true;
      try { await request('/wp-json/aioseo/v1/post', { method: 'POST', body: JSON.stringify({ ...before, id: postId }) }); } catch {}
      throw new Error(`${intended.slug} SEO reconciliation failed. metadataOk=${metadataOk}; changedUnexpected=${changedUnexpected.join(',') || 'none'}; rollbackAttempted=true`);
    }

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      try {
        const response = await fetch(`${siteUrl}${intended.route}?dtf_core_meta=${Date.now()}-${attempt}`, {
          headers: { Accept: 'text/html', 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'User-Agent': 'DTFSeeds-Core-Meta-Verify/1.0' },
          redirect: 'follow',
          signal: AbortSignal.timeout(30_000)
        });
        const observed = extractMeta(await response.text());
        publicVerification = {
          status: response.status,
          ...observed,
          verified: response.ok &&
            observed.description === intended.description &&
            observed.ogDescription === intended.description &&
            observed.twitterDescription === intended.description
        };
        if (publicVerification.verified) break;
      } catch (error) {
        publicVerification = { verified: false, error: error instanceof Error ? error.message : String(error) };
      }
      await sleep(4000);
    }
  }

  await writeFile(join(backupDir, `${intended.slug}-after.json`), `${JSON.stringify(after, null, 2)}\n`);
  reports.push({
    slug: intended.slug,
    route: intended.route,
    postId,
    intended,
    before: { title: before.title ?? null, description: before.description ?? null, og_title: before.og_title ?? null, og_description: before.og_description ?? null, twitter_title: before.twitter_title ?? null, twitter_description: before.twitter_description ?? null },
    after: { title: after.title ?? null, description: after.description ?? null, og_title: after.og_title ?? null, og_description: after.og_description ?? null, twitter_title: after.twitter_title ?? null, twitter_description: after.twitter_description ?? null },
    publicVerification,
    rollbackAttempted
  });
}

const report = { generatedAt: new Date().toISOString(), siteUrl, apply, backupDir, metadataPath, pages: reports };
await writeFile(join(backupDir, 'core-page-meta-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (apply) {
  const failed = reports.filter((item) => !item.publicVerification?.verified);
  if (failed.length) throw new Error(`AIOSEO state saved but public metadata did not fully verify for: ${failed.map((item) => item.slug).join(', ')}`);
}
