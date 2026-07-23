import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const contentDir = process.env.CONTENT_DIR || '';
const backupRoot = process.env.BACKUP_ROOT || process.cwd();
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const backupDir = join(backupRoot, `wordpress-rest-content-${timestamp}`);

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
if (!contentDir) throw new Error('CONTENT_DIR is required');

const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: authHeader,
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Content-Deployment/1.0'
};

const pageDefinitions = [
  ['home', 'DTF Genetics | Dream the Future'],
  ['games', 'DTF Game Hub | Original Cannabis Games'],
  ['high-iq', 'High IQ | Cannabis Knowledge Challenge'],
  ['seeds', 'Seeds / Genetics'],
  ['learn', 'Teaching Healthy Cultivation'],
  ['community', 'Community'],
  ['shop', 'Shop'],
  ['gallery', 'Gallery'],
  ['about', 'About DTF Genetics'],
  ['contact', 'Contact DTF Genetics']
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

async function getPublishedPageBySlug(slug) {
  const params = new URLSearchParams({
    slug,
    context: 'edit',
    per_page: '100'
  });
  const { body } = await request(`/wp-json/wp/v2/pages?${params}`);
  if (!Array.isArray(body)) throw new Error(`Unexpected page response for ${slug}`);
  if (body.length !== 1) {
    throw new Error(`Expected exactly one published WordPress page for slug '${slug}'; found ${body.length}`);
  }
  return body[0];
}

async function updatePage(page, title, content) {
  const { body } = await request(`/wp-json/wp/v2/pages/${page.id}`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      content,
      status: 'publish'
    })
  });
  if (!body?.id || body.id !== page.id) throw new Error(`WordPress did not confirm page ${page.id}`);
  return body;
}

await mkdir(join(backupDir, 'pages'), { recursive: true });

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

const prepared = [];
for (const [slug, title] of pageDefinitions) {
  const sourcePath = join(contentDir, `${slug}.html`);
  const content = await readFile(sourcePath, 'utf8');
  if (!content.trim()) throw new Error(`Missing or empty content file: ${sourcePath}`);
  for (const phrase of forbiddenPhrases) {
    if (content.toLowerCase().includes(phrase.toLowerCase())) {
      throw new Error(`Forbidden staging phrase found in ${slug}.html: ${phrase}`);
    }
  }
  const page = await getPublishedPageBySlug(slug);
  await writeFile(join(backupDir, 'pages', `${slug}.json`), `${JSON.stringify(page, null, 2)}\n`, 'utf8');
  prepared.push({ slug, title, content, page });
}

await writeFile(
  join(backupDir, 'deployment-plan.json'),
  `${JSON.stringify(prepared.map(({ slug, title, page }) => ({ slug, title, pageId: page.id, previousStatus: page.status })), null, 2)}\n`,
  'utf8'
);

const results = [];
for (const item of prepared) {
  const updated = await updatePage(item.page, item.title, item.content);
  results.push({
    slug: item.slug,
    pageId: updated.id,
    status: updated.status,
    modifiedGmt: updated.modified_gmt,
    link: updated.link
  });
  console.log(`Updated /${item.slug}/ (page ID ${updated.id})`);
}

// Handle the obsolete blog only when the settings endpoint confirms it is the
// configured posts page and the matching page slug is exactly "blog".
try {
  const settings = await request('/wp-json/wp/v2/settings');
  await writeFile(join(backupDir, 'settings-before.json'), `${JSON.stringify(settings.body, null, 2)}\n`, 'utf8');
  const postsPageId = Number(settings.body?.page_for_posts || 0);
  if (postsPageId > 0) {
    const postsPage = await request(`/wp-json/wp/v2/pages/${postsPageId}?context=edit`);
    if (postsPage.body?.slug === 'blog') {
      await writeFile(join(backupDir, 'pages', 'blog.json'), `${JSON.stringify(postsPage.body, null, 2)}\n`, 'utf8');
      await request('/wp-json/wp/v2/settings', {
        method: 'POST',
        body: JSON.stringify({ page_for_posts: 0 })
      });
      await request(`/wp-json/wp/v2/pages/${postsPageId}`, {
        method: 'POST',
        body: JSON.stringify({ status: 'draft' })
      });
      console.log(`Disabled obsolete /blog/ posts page (page ID ${postsPageId})`);
    }
  }
} catch (error) {
  console.warn(`Legacy blog cleanup skipped safely: ${error.message}`);
}

await writeFile(join(backupDir, 'deployment-results.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
await writeFile(join(backupRoot, 'wordpress-rest-backup-path.txt'), `${backupDir}\n`, 'utf8');

console.log(`REST content deployment completed for ${results.length} pages.`);
console.log(`Page-level rollback data: ${backupDir}`);
