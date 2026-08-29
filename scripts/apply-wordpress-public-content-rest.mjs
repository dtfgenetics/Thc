import dns from 'node:dns';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

dns.setDefaultResultOrder('ipv4first');

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
  'User-Agent': 'DTFSeeds-Content-Deployment/1.8'
};

// WordPress owns the editorial/root pages below. /seeds/ and /seeds/* are
// exclusively owned by the dedicated genetics publisher. /games/ and
// /games/high-iq/ are owned by the static public application suite.
const pageDefinitions = [
  ['home', 'DTF Genetics | Dream the Future'],
  ['learn', 'Teaching Healthy Cultivation'],
  ['community', 'Community'],
  ['shop', 'Shop'],
  ['gallery', 'Gallery'],
  ['about', 'About DTF Genetics'],
  ['contact', 'Contact DTF Genetics'],
  ['blog', 'DTF Field Notes & Updates']
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
  'staged for',
  'email@email.com',
  '+123456789'
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error) {
  const status = Number(error?.status || 0);
  if (status === 408 || status === 425 || status === 429 || status >= 500) return true;
  if (error instanceof TypeError || error?.name === 'TimeoutError' || error?.name === 'AbortError') return true;
  const codes = new Set([
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EAI_AGAIN',
    'ENETUNREACH',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET'
  ]);
  return codes.has(error?.code) ||
    codes.has(error?.cause?.code) ||
    (Array.isArray(error?.cause?.errors) && error.cause.errors.some((item) => codes.has(item?.code)));
}

async function request(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const retryTransient = options.retryTransient ?? (method === 'GET');
  const attempts = Math.max(1, Number(options.attempts || (retryTransient ? 8 : 1)));
  const fetchOptions = { ...options };
  delete fetchOptions.retryTransient;
  delete fetchOptions.attempts;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...fetchOptions,
        headers: { ...headers, ...(fetchOptions.headers || {}) },
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000)
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
        const error = new Error(`WordPress request ${path} returned HTTP ${response.status}${code}${message}`);
        error.status = response.status;
        throw error;
      }
      return { response, body };
    } catch (error) {
      lastError = error;
      if (!retryTransient || !isTransientError(error) || attempt >= attempts) throw error;
      const delay = Math.min(15_000, 1200 + attempt * 1400);
      console.warn(`Transient WordPress ${method} failure ${attempt}/${attempts} for ${path}: ${error?.message || error}; retrying in ${delay}ms.`);
      await sleep(delay);
    }
  }
  throw lastError || new Error(`WordPress request ${path} failed.`);
}

async function getPublishedPageBySlug(slug) {
  const params = new URLSearchParams({ slug, context: 'edit', per_page: '100' });
  const { body } = await request(`/wp-json/wp/v2/pages?${params}`);
  if (!Array.isArray(body)) throw new Error(`Unexpected page response for ${slug}`);
  if (body.length > 1) {
    throw new Error(`Expected at most one published WordPress page for slug '${slug}'; found ${body.length}`);
  }
  return body[0] || null;
}

async function createPage(slug, title, content) {
  const payload = JSON.stringify({ slug, title, content, status: 'publish' });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { body } = await request('/wp-json/wp/v2/pages', {
        method: 'POST',
        body: payload,
        retryTransient: false
      });
      if (!body?.id) throw new Error(`WordPress did not return an ID while creating /${slug}/`);
      if (body?.status !== 'publish') throw new Error(`WordPress did not publish newly created /${slug}/`);
      return body;
    } catch (error) {
      if (!isTransientError(error)) throw error;
      console.warn(`Create response for /${slug}/ was ambiguous: ${error.message}. Checking the canonical slug before any retry.`);
      const observed = await getPublishedPageBySlug(slug);
      if (observed) {
        if (
          editableTitle(observed) !== normalizeText(title) ||
          editableContent(observed) !== normalizeText(content) ||
          observed.status !== 'publish'
        ) {
          return updatePage(observed, title, content);
        }
        return observed;
      }
      if (attempt >= 3) throw error;
      await sleep(attempt * 2500);
    }
  }
  throw new Error(`Could not safely create /${slug}/`);
}

async function updatePage(page, title, content) {
  const { body } = await request(`/wp-json/wp/v2/pages/${page.id}`, {
    method: 'POST',
    body: JSON.stringify({ title, content, status: 'publish' }),
    retryTransient: true
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
    await request(`/wp-json/wp/v2/posts/${post.id}`, {
      method: 'POST',
      body: JSON.stringify({ status: 'draft' }),
      retryTransient: true
    });
    drafted += 1;
    console.log(`Drafted obsolete generated post: ${title} (post ID ${post.id})`);
  }
  return drafted;
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

// First validate every canonical source file and inspect all current page identities.
// No WordPress mutation occurs until the complete plan is known.
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
  const needsUpdate =
    !page ||
    editableTitle(page) !== normalizeText(title) ||
    editableContent(page) !== normalizeText(content) ||
    page?.status !== 'publish';

  if (page) {
    await writeFile(join(backupDir, 'pages', `${slug}.json`), `${JSON.stringify(page, null, 2)}\n`, 'utf8');
  }
  prepared.push({ slug, title, content, page, needsUpdate });
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
    results.push({
      slug: item.slug,
      pageId: created.id,
      status: created.status,
      modifiedGmt: created.modified_gmt,
      link: created.link,
      changed: true,
      created: true
    });
    console.log(`Created /${item.slug}/ (page ID ${created.id})`);
    continue;
  }

  if (!item.needsUpdate) {
    results.push({
      slug: item.slug,
      pageId: item.page.id,
      status: item.page.status,
      modifiedGmt: item.page.modified_gmt,
      link: item.page.link,
      changed: false,
      created: false
    });
    console.log(`Already synchronized /${item.slug}/ (page ID ${item.page.id})`);
    continue;
  }

  const updated = await updatePage(item.page, item.title, item.content);
  item.page = updated;
  changedPages += 1;
  results.push({
    slug: item.slug,
    pageId: updated.id,
    status: updated.status,
    modifiedGmt: updated.modified_gmt,
    link: updated.link,
    changed: true,
    created: false
  });
  console.log(`Updated /${item.slug}/ (page ID ${updated.id})`);
}

// The canonical `home` page must also be the page WordPress serves at `/`.
try {
  const homeItem = prepared.find((item) => item.slug === 'home');
  if (!homeItem?.page?.id) throw new Error('Canonical home page ID is unavailable');

  const settings = await request('/wp-json/wp/v2/settings');
  await writeFile(
    join(backupDir, 'front-page-settings-before.json'),
    `${JSON.stringify(settings.body, null, 2)}\n`,
    'utf8'
  );

  const expectedFrontPageId = Number(homeItem.page.id);
  const currentFrontPageId = Number(settings.body?.page_on_front || 0);
  const currentMode = String(settings.body?.show_on_front || '');

  if (currentMode !== 'page' || currentFrontPageId !== expectedFrontPageId) {
    const updatedSettings = await request('/wp-json/wp/v2/settings', {
      method: 'POST',
      body: JSON.stringify({
        show_on_front: 'page',
        page_on_front: expectedFrontPageId
      }),
      retryTransient: true
    });

    if (
      String(updatedSettings.body?.show_on_front || '') !== 'page' ||
      Number(updatedSettings.body?.page_on_front || 0) !== expectedFrontPageId
    ) {
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

// `/blog/` is a canonical editorial page. If WordPress is still treating that
// page as the posts index, detach page_for_posts while preserving the page as
// published canonical content.
try {
  const blogItem = prepared.find((item) => item.slug === 'blog');
  if (!blogItem?.page?.id) throw new Error('Canonical Blog page ID is unavailable');

  const settings = await request('/wp-json/wp/v2/settings');
  await writeFile(join(backupDir, 'settings-before.json'), `${JSON.stringify(settings.body, null, 2)}\n`, 'utf8');
  const postsPageId = Number(settings.body?.page_for_posts || 0);
  if (postsPageId > 0) {
    const postsPage = await request(`/wp-json/wp/v2/pages/${postsPageId}?context=edit`);
    if (postsPage.body?.slug === 'blog') {
      await writeFile(join(backupDir, 'pages', 'blog-posts-page-before.json'), `${JSON.stringify(postsPage.body, null, 2)}\n`, 'utf8');
      const updatedSettings = await request('/wp-json/wp/v2/settings', {
        method: 'POST',
        body: JSON.stringify({ page_for_posts: 0 }),
        retryTransient: true
      });
      if (Number(updatedSettings.body?.page_for_posts || 0) !== 0) {
        throw new Error('WordPress did not detach /blog/ from page_for_posts');
      }
      auxiliaryMutations += 1;
      console.log(`Detached canonical /blog/ page ID ${blogItem.page.id} from the WordPress posts index while preserving publication.`);
    }
  }
} catch (error) {
  throw new Error(`Canonical Blog ownership reconciliation failed: ${error.message}`);
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
  auxiliaryMutations,
  mutationCount: changedPages + auxiliaryMutations,
  backupDir
};

await writeFile(join(backupDir, 'deployment-results.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
await writeFile(join(backupDir, 'deployment-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await writeFile(join(backupRoot, 'wordpress-rest-backup-path.txt'), `${backupDir}\n`, 'utf8');

console.log(`REST content reconciliation checked ${results.length} pages; changed ${changedPages}; created ${createdPages}; auxiliary mutations ${auxiliaryMutations}.`);
console.log(`Page-level rollback data: ${backupDir}`);
