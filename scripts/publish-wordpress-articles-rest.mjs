import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || process.env.WORDPRESS_USERNAME || process.env.WP_USERNAME || '';
const password = process.env.WP_API_PASSWORD || process.env.WORDPRESS_APP_PASSWORD || process.env.WP_APPLICATION_PASSWORD || '';
const articleDir = resolve(process.env.ARTICLE_DIR || 'site/wordpress/articles');
const requestedFile = process.env.ARTICLE_FILE ? resolve(process.env.ARTICLE_FILE) : '';
const validateOnly = /^(1|true|yes)$/i.test(process.env.VALIDATE_ONLY || '');
const backupRoot = resolve(process.env.BACKUP_ROOT || process.cwd());
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const backupDir = join(backupRoot, `wordpress-article-backup-${timestamp}`);

const allowedStatuses = new Set(['draft', 'publish', 'pending', 'private']);
const allowedImageRoles = new Set(['hero', 'diagnostic', 'diagram', 'infographic', 'comparison', 'supporting']);
const forbiddenPhrases = [
  '[ARTICLE URL]',
  'TODO',
  'TBD',
  'lorem ipsum',
  'being rebuilt',
  'Needed from owner',
  'Tool-ready rebuild'
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function validateImage(image, articleLabel, seenIds) {
  assert(image && typeof image === 'object' && !Array.isArray(image), `${articleLabel}: every image must be an object`);
  assert(typeof image.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(image.id), `${articleLabel}: image id must be lowercase kebab-case`);
  assert(!seenIds.has(image.id), `${articleLabel}: duplicate image id '${image.id}'`);
  seenIds.add(image.id);
  assert(typeof image.url === 'string' && /^https:\/\//.test(image.url), `${articleLabel}: image '${image.id}' must use an HTTPS URL`);
  assert(typeof image.alt === 'string' && image.alt.trim().length >= 5, `${articleLabel}: image '${image.id}' requires descriptive alt text`);
  if (image.caption !== undefined) assert(typeof image.caption === 'string', `${articleLabel}: image '${image.id}' caption must be a string`);
  if (image.credit !== undefined) assert(typeof image.credit === 'string', `${articleLabel}: image '${image.id}' credit must be a string`);
  if (image.role !== undefined) assert(allowedImageRoles.has(image.role), `${articleLabel}: image '${image.id}' has unsupported role '${image.role}'`);

  return {
    id: image.id,
    url: image.url,
    alt: image.alt.trim(),
    caption: (image.caption || '').trim(),
    credit: (image.credit || '').trim(),
    role: image.role || 'supporting'
  };
}

function renderImageFigure(image) {
  const captionParts = [];
  if (image.caption) captionParts.push(escapeHtml(image.caption));
  if (image.credit) captionParts.push(`<span class="thc-image-credit">${escapeHtml(image.credit)}</span>`);
  const figcaption = captionParts.length ? `<figcaption>${captionParts.join(' ')}</figcaption>` : '';
  return `<figure class="thc-article-image thc-image-${escapeHtml(image.role)}"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async">${figcaption}</figure>`;
}

function renderArticleContent(content, images, label) {
  let rendered = content;
  for (const image of images) {
    const marker = `{{image:${image.id}}}`;
    const occurrences = rendered.split(marker).length - 1;
    assert(occurrences === 1, `${label}: image marker '${marker}' must appear exactly once in content; found ${occurrences}`);
    rendered = rendered.replace(marker, renderImageFigure(image));
  }

  const unresolved = rendered.match(/\{\{image:[a-z0-9-]+\}\}/g) || [];
  assert(unresolved.length === 0, `${label}: unresolved image marker(s): ${unresolved.join(', ')}`);
  return rendered;
}

function validateArticle(article, sourcePath) {
  const label = basename(sourcePath);
  assert(article && typeof article === 'object' && !Array.isArray(article), `${label}: article must be a JSON object`);
  assert(typeof article.title === 'string' && article.title.trim().length >= 10, `${label}: title is required`);
  assert(typeof article.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug), `${label}: slug must be lowercase kebab-case`);
  assert(typeof article.content === 'string' && article.content.trim().length >= 500, `${label}: content must contain at least 500 characters`);
  assert(typeof article.excerpt === 'string' && article.excerpt.trim().length >= 40, `${label}: excerpt is required`);
  assert(allowedStatuses.has(article.status || 'draft'), `${label}: unsupported status '${article.status}'`);
  assert(Array.isArray(article.categories) && article.categories.length > 0, `${label}: at least one category is required`);
  assert(article.categories.every((value) => typeof value === 'string' && value.trim()), `${label}: category names must be non-empty strings`);
  assert(!article.tags || (Array.isArray(article.tags) && article.tags.every((value) => typeof value === 'string' && value.trim())), `${label}: tags must be an array of non-empty strings`);

  const lowerContent = article.content.toLowerCase();
  for (const phrase of forbiddenPhrases) {
    assert(!lowerContent.includes(phrase.toLowerCase()), `${label}: forbidden placeholder/staging phrase found: ${phrase}`);
  }

  if (article.require_discord_cta !== false) {
    assert(article.content.includes('https://discord.gg/xJbUeHFPMt'), `${label}: canonical THC Discord CTA is required`);
  }

  if (article.references) {
    assert(Array.isArray(article.references), `${label}: references must be an array`);
    assert(article.references.every((ref) => typeof ref === 'string' && /^https:\/\//.test(ref)), `${label}: every reference must be an HTTPS URL`);
  }

  const seenImageIds = new Set();
  const images = (article.images || []).map((image) => validateImage(image, label, seenImageIds));
  const renderedContent = renderArticleContent(article.content.trim(), images, label);

  return {
    title: article.title.trim(),
    slug: article.slug,
    content: renderedContent,
    excerpt: article.excerpt.trim(),
    status: article.status || 'draft',
    categories: article.categories.map((value) => value.trim()),
    tags: (article.tags || []).map((value) => value.trim()),
    references: article.references || [],
    images
  };
}

async function discoverArticleFiles() {
  if (requestedFile) return [requestedFile];
  const names = await readdir(articleDir);
  return names.filter((name) => name.endsWith('.json') && name !== 'article.schema.json').sort().map((name) => join(articleDir, name));
}

async function loadArticles() {
  const files = await discoverArticleFiles();
  assert(files.length > 0, 'No WordPress article JSON files were found');
  const articles = [];
  const seenSlugs = new Set();
  for (const sourcePath of files) {
    const raw = await readFile(sourcePath, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${basename(sourcePath)}: invalid JSON: ${error.message}`);
    }
    const article = validateArticle(parsed, sourcePath);
    assert(!seenSlugs.has(article.slug), `Duplicate article slug in deployment set: ${article.slug}`);
    seenSlugs.add(article.slug);
    articles.push({ ...article, sourcePath });
  }
  return articles;
}

const articles = await loadArticles();
console.log(`Validated ${articles.length} WordPress article package(s).`);
for (const article of articles) console.log(`- ${article.slug}: ${article.status} (${article.images.length} image(s))`);

if (validateOnly) {
  console.log('Validation-only mode complete. No network requests were made.');
  process.exit(0);
}

assert(username && password, 'WP_API_USERNAME and WP_API_PASSWORD (WordPress Application Password) are required');
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: authHeader,
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'DTF-THC-Article-Publisher/1.1'
};

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000)
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 1500) };
    }
  }
  if (!response.ok) {
    const code = body?.code ? ` (${body.code})` : '';
    const message = body?.message ? `: ${body.message}` : '';
    throw new Error(`WordPress request ${path} returned HTTP ${response.status}${code}${message}`);
  }
  return body;
}

async function ensureTerm(endpoint, name) {
  const params = new URLSearchParams({ search: name, context: 'edit', per_page: '100' });
  const found = await request(`/wp-json/wp/v2/${endpoint}?${params}`);
  assert(Array.isArray(found), `Unexpected ${endpoint} search response for '${name}'`);
  const exact = found.filter((term) => String(term.name || '').toLowerCase() === name.toLowerCase());
  if (exact.length > 1) throw new Error(`Multiple ${endpoint} terms exactly match '${name}'`);
  if (exact.length === 1) return exact[0].id;
  const created = await request(`/wp-json/wp/v2/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify({ name })
  });
  assert(created?.id, `WordPress did not confirm creation of ${endpoint} '${name}'`);
  return created.id;
}

async function getPostBySlug(slug) {
  const params = new URLSearchParams({ slug, context: 'edit', per_page: '100', status: 'any' });
  const posts = await request(`/wp-json/wp/v2/posts?${params}`);
  assert(Array.isArray(posts), `Unexpected post response for '${slug}'`);
  if (posts.length > 1) throw new Error(`Expected at most one WordPress post for slug '${slug}'; found ${posts.length}`);
  return posts[0] || null;
}

await mkdir(join(backupDir, 'posts'), { recursive: true });
const currentUser = await request('/wp-json/wp/v2/users/me?context=edit');
await writeFile(
  join(backupDir, 'authenticated-user.json'),
  `${JSON.stringify({ id: currentUser?.id, name: currentUser?.name, slug: currentUser?.slug, roles: currentUser?.roles }, null, 2)}\n`,
  'utf8'
);

const results = [];
for (const article of articles) {
  const categoryIds = [];
  for (const name of article.categories) categoryIds.push(await ensureTerm('categories', name));
  const tagIds = [];
  for (const name of article.tags) tagIds.push(await ensureTerm('tags', name));

  const existing = await getPostBySlug(article.slug);
  if (existing) {
    await writeFile(join(backupDir, 'posts', `${article.slug}-${existing.id}.json`), `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
  }

  const payload = {
    title: article.title,
    slug: article.slug,
    content: article.content,
    excerpt: article.excerpt,
    status: article.status,
    categories: categoryIds,
    tags: tagIds
  };

  const endpoint = existing ? `/wp-json/wp/v2/posts/${existing.id}` : '/wp-json/wp/v2/posts';
  const saved = await request(endpoint, { method: 'POST', body: JSON.stringify(payload) });
  assert(saved?.id && saved?.slug === article.slug, `WordPress did not confirm '${article.slug}'`);

  const result = {
    action: existing ? 'updated' : 'created',
    id: saved.id,
    slug: saved.slug,
    status: saved.status,
    link: saved.link,
    modified_gmt: saved.modified_gmt,
    image_count: article.images.length
  };
  results.push(result);
  console.log(`${result.action.toUpperCase()}: ${article.slug} -> ${saved.link} (${result.image_count} image(s))`);
}

await writeFile(join(backupDir, 'deployment-results.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
await writeFile(join(backupRoot, 'wordpress-article-backup-path.txt'), `${backupDir}\n`, 'utf8');
console.log(`WordPress article deployment complete: ${results.length} article(s).`);
console.log(`Rollback metadata: ${backupDir}`);
