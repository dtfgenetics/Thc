import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_PRESENTATION_CHANGES || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || process.cwd();

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const baseHeaders = {
  Authorization: auth,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-WordPress-Presentation-Reconciler/1.2'
};

const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `wordpress-presentation-${stamp}`);
await mkdir(backupDir, { recursive: true });

function raw(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.raw || value.rendered || '';
  return '';
}

function hasAny(text, needles) {
  const value = String(text || '').toLowerCase();
  return needles.some((needle) => value.includes(needle));
}

function hasAll(text, needles) {
  const value = String(text || '').toLowerCase();
  return needles.every((needle) => value.includes(String(needle).toLowerCase()));
}

function headerCompliant(text) {
  return hasAll(text, ['/seeds/', '/learn/', '/tools/', '/games/', '/community/', '/shop/']) &&
    !hasAny(text, ['email@email.com', '+123456789']);
}

function footerCompliant(text) {
  const value = String(text || '');
  const lower = value.toLowerCase();
  const hasCurrentCopyright = lower.includes('2026 dtf genetics') || lower.includes('© 2026 dtf genetics') || lower.includes('&copy; 2026 dtf genetics');
  return lower.includes('dtf genetics') &&
    lower.includes('dream the future') &&
    lower.includes('discord.gg/xjbuehfpmt') &&
    hasCurrentCopyright &&
    !hasAny(value, ['email@email.com', '+123456789', '2025 dtf genetics']);
}

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: {
      ...baseHeaders,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000)
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

async function updateResource(collection, id, content) {
  return request(`/wp-json/wp/v2/${collection}/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({ content, status: 'publish' })
  });
}

async function createTemplate({ slug, theme, content, title }) {
  return request('/wp-json/wp/v2/templates', {
    method: 'POST',
    body: JSON.stringify({
      slug,
      theme,
      type: 'wp_template',
      content,
      title,
      status: 'publish'
    })
  });
}

const [themes, templates, parts, navigation] = await Promise.all([
  request('/wp-json/wp/v2/themes?status=active&context=edit'),
  request('/wp-json/wp/v2/templates?context=edit&per_page=100'),
  request('/wp-json/wp/v2/template-parts?context=edit&per_page=100'),
  request('/wp-json/wp/v2/navigation?context=edit&per_page=100&status=publish')
]);

const activeTheme = Array.isArray(themes) ? themes[0] : null;
const themeSlug = activeTheme?.stylesheet || activeTheme?.template || 'hostinger-ai-theme';
if (themeSlug !== 'hostinger-ai-theme') {
  throw new Error(`Refusing presentation rewrite: expected hostinger-ai-theme, found ${themeSlug || 'unknown theme'}`);
}

await writeFile(join(backupDir, 'themes.json'), `${JSON.stringify(themes, null, 2)}\n`);
await writeFile(join(backupDir, 'templates.json'), `${JSON.stringify(templates, null, 2)}\n`);
await writeFile(join(backupDir, 'template-parts.json'), `${JSON.stringify(parts, null, 2)}\n`);
await writeFile(join(backupDir, 'navigation.json'), `${JSON.stringify(navigation, null, 2)}\n`);

const canonicalHeader = `<!-- wp:group {"tagName":"header","style":{"spacing":{"padding":{"top":"18px","bottom":"18px","left":"24px","right":"24px"}}},"layout":{"type":"constrained"}} -->
<header class="wp-block-group" style="padding-top:18px;padding-right:24px;padding-bottom:18px;padding-left:24px"><!-- wp:group {"layout":{"type":"flex","flexWrap":"wrap","justifyContent":"space-between"}} -->
<div class="wp-block-group"><!-- wp:site-title {"level":0} /-->
<!-- wp:navigation {"overlayMenu":"mobile","layout":{"type":"flex","justifyContent":"right"}} -->
<!-- wp:navigation-link {"label":"Home","url":"/","kind":"custom","isTopLevelLink":true} /-->
<!-- wp:navigation-link {"label":"Seeds","url":"/seeds/","kind":"custom","isTopLevelLink":true} /-->
<!-- wp:navigation-link {"label":"Learn","url":"/learn/","kind":"custom","isTopLevelLink":true} /-->
<!-- wp:navigation-link {"label":"Tools","url":"/tools/","kind":"custom","isTopLevelLink":true} /-->
<!-- wp:navigation-link {"label":"Games","url":"/games/","kind":"custom","isTopLevelLink":true} /-->
<!-- wp:navigation-link {"label":"Community","url":"/community/","kind":"custom","isTopLevelLink":true} /-->
<!-- wp:navigation-link {"label":"Shop","url":"/shop/","kind":"custom","isTopLevelLink":true} /-->
<!-- /wp:navigation --></div>
<!-- /wp:group --></header>
<!-- /wp:group -->`;

const canonicalFooter = `<!-- wp:group {"tagName":"footer","style":{"spacing":{"padding":{"top":"32px","bottom":"32px","left":"24px","right":"24px"}}},"layout":{"type":"constrained"}} -->
<footer class="wp-block-group" style="padding-top:32px;padding-right:24px;padding-bottom:32px;padding-left:24px"><!-- wp:paragraph -->
<p><strong>DTF Genetics</strong> — Dream the Future.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p><a href="/seeds/">Seeds</a> · <a href="/learn/">Learn</a> · <a href="/tools/">Tools</a> · <a href="/games/">Games</a> · <a href="/community/">Community</a> · <a href="/shop/">Shop</a></p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p><a href="https://discord.gg/xJbUeHFPMt" target="_blank" rel="noopener noreferrer">Join Teaching Healthy Cultivation on Discord</a></p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>© 2026 DTF Genetics. All rights reserved.</p>
<!-- /wp:paragraph --></footer>
<!-- /wp:group -->`;

const canonicalPageTemplate = `<!-- wp:template-part {"slug":"header","theme":"hostinger-ai-theme","tagName":"header"} /-->
<!-- wp:group {"tagName":"main","style":{"spacing":{"padding":{"top":"32px","bottom":"48px","left":"24px","right":"24px"}}},"layout":{"type":"constrained"}} -->
<main class="wp-block-group" style="padding-top:32px;padding-right:24px;padding-bottom:48px;padding-left:24px"><!-- wp:post-content {"layout":{"type":"constrained"}} /--></main>
<!-- /wp:group -->
<!-- wp:template-part {"slug":"footer","theme":"hostinger-ai-theme","tagName":"footer"} /-->`;

// The configured static Home page contains its own responsive/full-width visual shell.
// Keep the front-page template deliberately thin so the page content is not constrained twice.
const canonicalFrontPageTemplate = `<!-- wp:template-part {"slug":"header","theme":"hostinger-ai-theme","tagName":"header"} /-->
<!-- wp:group {"tagName":"main","layout":{"type":"default"}} -->
<main class="wp-block-group"><!-- wp:post-content {"layout":{"type":"default"}} /--></main>
<!-- /wp:group -->
<!-- wp:template-part {"slug":"footer","theme":"hostinger-ai-theme","tagName":"footer"} /-->`;

const staleTemplateMarkers = [
  'seeds, cultivation education, and thc games in one home',
  'thc grow doc, genetics, cultivation education, and games in one home',
  'dtf genetics is being rebuilt',
  'reserved strain card',
  'tool-ready rebuild',
  'grow education belongs in a clean, readable library',
  'mops, cultivation notes, thc basics, and practical grow education',
  'needed from owner',
  'staged for verified'
];

const header = (Array.isArray(parts) ? parts : []).find((item) => item.theme === themeSlug && item.slug === 'header');
const footer = (Array.isArray(parts) ? parts : []).find((item) => item.theme === themeSlug && item.slug === 'footer');
if (!header?.id) throw new Error('Active Hostinger header template part was not found');
if (!footer?.id) throw new Error('Active Hostinger footer template part was not found');

const mutations = [];
const planned = [];

if (!headerCompliant(raw(header.content))) planned.push({ action: 'update', type: 'template-part', id: header.id, slug: 'header', content: canonicalHeader });
if (!footerCompliant(raw(footer.content))) planned.push({ action: 'update', type: 'template-part', id: footer.id, slug: 'footer', content: canonicalFooter });

const activeTemplates = (Array.isArray(templates) ? templates : []).filter((template) => template.theme === themeSlug && template.id);
const frontPageTemplate = activeTemplates.find((template) => String(template.slug || '') === 'front-page');

if (!frontPageTemplate) {
  planned.push({
    action: 'create',
    type: 'template',
    id: null,
    slug: 'front-page',
    content: canonicalFrontPageTemplate,
    title: 'Front Page',
    reason: 'missing-static-front-page-template'
  });
}

for (const template of activeTemplates) {
  const content = raw(template.content);
  const slug = String(template.slug || '');
  const stale = hasAny(content, staleTemplateMarkers);
  const pageShellWithoutContent = template.source === 'custom' && ['front-page', 'page'].includes(slug) && !content.includes('wp:post-content');
  if (stale || pageShellWithoutContent) {
    planned.push({
      action: 'update',
      type: 'template',
      id: template.id,
      slug,
      content: slug === 'front-page' ? canonicalFrontPageTemplate : canonicalPageTemplate,
      reason: stale ? 'stale-hardcoded-content' : 'custom-page-shell-without-post-content'
    });
  }
}

if (apply) {
  for (const change of planned) {
    let result;
    if (change.action === 'create' && change.type === 'template') {
      result = await createTemplate({
        slug: change.slug,
        theme: themeSlug,
        content: change.content,
        title: change.title || 'Front Page'
      });
      console.log(`Created template ${result?.id || `${themeSlug}//${change.slug}`}`);
    } else {
      const collection = change.type === 'template' ? 'templates' : 'template-parts';
      result = await updateResource(collection, change.id, change.content);
      console.log(`Updated ${change.type} ${change.id}`);
    }
    mutations.push({
      action: change.action,
      type: change.type,
      id: result?.id || change.id || null,
      slug: change.slug,
      wpId: result?.wp_id || null,
      reason: change.reason || 'canonical-shell'
    });
  }
} else {
  console.log(`Dry run: ${planned.length} presentation mutations planned.`);
}

const [afterTemplates, afterParts] = await Promise.all([
  request('/wp-json/wp/v2/templates?context=edit&per_page=100'),
  request('/wp-json/wp/v2/template-parts?context=edit&per_page=100')
]);

const afterHeader = (afterParts || []).find((item) => item.theme === themeSlug && item.slug === 'header');
const afterFooter = (afterParts || []).find((item) => item.theme === themeSlug && item.slug === 'footer');
const afterFrontPage = (afterTemplates || []).find((item) => item.theme === themeSlug && item.slug === 'front-page');
if (apply && !afterHeader?.id) throw new Error('Header verification failed: active header template part disappeared after update');
if (apply && !afterFooter?.id) throw new Error('Footer verification failed: active footer template part disappeared after update');
if (apply && !headerCompliant(raw(afterHeader?.content))) throw new Error('Header verification failed after update: canonical navigation is not present');
if (apply && !footerCompliant(raw(afterFooter?.content))) throw new Error('Footer verification failed after update: canonical DTF footer markers are not present');
if (apply && !afterFrontPage?.id) throw new Error('Front-page template verification failed: template was not created');
if (apply && !raw(afterFrontPage?.content).includes('wp:post-content')) throw new Error('Front-page template verification failed: wp:post-content is missing');

const remainingStaleTemplates = (afterTemplates || []).filter((template) => template.theme === themeSlug && hasAny(raw(template.content), staleTemplateMarkers));
if (apply && remainingStaleTemplates.length) {
  throw new Error(`Stale Hostinger templates remain after repair: ${remainingStaleTemplates.map((item) => item.id).join(', ')}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  activeTheme: themeSlug,
  apply,
  backupDir,
  plannedCount: planned.length,
  mutationCount: mutations.length,
  planned: planned.map(({ content, ...item }) => item),
  mutations,
  verification: {
    headerCompliant: headerCompliant(raw(afterHeader?.content)),
    footerCompliant: footerCompliant(raw(afterFooter?.content)),
    frontPageTemplatePresent: Boolean(afterFrontPage?.id),
    frontPageRendersPostContent: raw(afterFrontPage?.content).includes('wp:post-content')
  },
  remainingStaleTemplates: remainingStaleTemplates.map((item) => ({ id: item.id, slug: item.slug, source: item.source }))
};

await writeFile(join(backupDir, 'presentation-reconciliation.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'wordpress-presentation-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
