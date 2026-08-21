import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const reportRoot = process.env.BACKUP_ROOT || process.cwd();
const reportPath = join(reportRoot, 'wordpress-commerce-capabilities.json');

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

await mkdir(reportRoot, { recursive: true });

const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: authHeader,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-WordPress-Capability-Audit/1.4'
};

function textValue(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.rendered || value.raw || '';
  return '';
}

function compactText(value = '', max = 300) {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function defectMarkers(value) {
  const text = JSON.stringify(value || {}).toLowerCase();
  return {
    fakeEmail: text.includes('email@email.com'),
    fakePhone: text.includes('+123456789'),
    legacyBlogNavigation: text.includes('blog'),
    legacyGalleryNavigation: text.includes('gallery'),
    old2025Copyright: text.includes('2025') && text.includes('dtf genetics'),
    staleHomeCopy: text.includes('thc grow doc, genetics, cultivation education, and games in one home'),
    staleLearnCopy: text.includes('grow education belongs in a clean, readable library'),
    staleLearnBody: text.includes('mops, cultivation notes, thc basics, and practical grow education')
  };
}

async function probe(path, summarize = null) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${siteUrl}${path}`, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000)
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    return {
      path,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      contentType: response.headers.get('content-type') || '',
      responseShape: Array.isArray(body)
        ? `array:${body.length}`
        : body && typeof body === 'object'
          ? `object:${Object.keys(body).slice(0, 12).join(',')}`
          : typeof body,
      errorCode: body?.code || null,
      errorMessage: body?.message || null,
      details: response.ok && summarize ? summarize(body) : null
    };
  } catch (error) {
    return {
      path,
      status: 0,
      ok: false,
      durationMs: Date.now() - startedAt,
      contentType: '',
      responseShape: null,
      errorCode: error?.cause?.code || null,
      errorMessage: error instanceof Error ? error.message : String(error),
      details: null
    };
  }
}

const indexProbe = await probe('/wp-json/');
const typeProbe = await probe('/wp-json/wp/v2/types?context=edit');
const candidates = [
  '/wp-json/wp/v2/product?context=edit&per_page=1',
  '/wp-json/wp/v2/products?context=edit&per_page=1',
  '/wp-json/wc/v3/products?per_page=1',
  '/wp-json/wc/store/v1/products?per_page=1'
];

const endpointProbes = [];
for (const path of candidates) endpointProbes.push(await probe(path));

const themeProbe = await probe('/wp-json/wp/v2/themes?status=active', (body) =>
  (Array.isArray(body) ? body : []).map((theme) => ({
    stylesheet: theme?.stylesheet || null,
    template: theme?.template || null,
    name: compactText(textValue(theme?.name), 120),
    version: theme?.version || null,
    status: theme?.status || null,
    isBlockTheme: Boolean(theme?.is_block_theme)
  }))
);

const pluginProbe = await probe('/wp-json/wp/v2/plugins?context=edit', (body) =>
  (Array.isArray(body) ? body : []).map((plugin) => ({
    plugin: plugin?.plugin || null,
    status: plugin?.status || null,
    name: compactText(textValue(plugin?.name), 140),
    version: plugin?.version || null,
    author: compactText(textValue(plugin?.author), 140)
  }))
);

const templateProbe = await probe('/wp-json/wp/v2/templates?context=edit&per_page=100', (body) =>
  (Array.isArray(body) ? body : []).map((template) => ({
    id: template?.id || null,
    wpId: Number(template?.wp_id || 0) || null,
    slug: template?.slug || null,
    theme: template?.theme || null,
    source: template?.source || null,
    origin: template?.origin || null,
    status: template?.status || null,
    title: compactText(textValue(template?.title), 120),
    contentExcerpt: compactText(textValue(template?.content), 700),
    markers: defectMarkers(template)
  }))
);

const templatePartProbe = await probe('/wp-json/wp/v2/template-parts?context=edit&per_page=100', (body) =>
  (Array.isArray(body) ? body : []).map((part) => ({
    id: part?.id || null,
    wpId: Number(part?.wp_id || 0) || null,
    slug: part?.slug || null,
    theme: part?.theme || null,
    area: part?.area || null,
    source: part?.source || null,
    origin: part?.origin || null,
    status: part?.status || null,
    title: compactText(textValue(part?.title), 120),
    contentExcerpt: compactText(textValue(part?.content), 500),
    markers: defectMarkers(part)
  }))
);

const sidebarProbe = await probe('/wp-json/wp/v2/sidebars?context=edit', (body) =>
  (Array.isArray(body) ? body : []).map((sidebar) => ({
    id: sidebar?.id || null,
    name: sidebar?.name || null,
    status: sidebar?.status || null,
    widgetIds: Array.isArray(sidebar?.widgets) ? sidebar.widgets : []
  }))
);

const widgetProbe = await probe('/wp-json/wp/v2/widgets?context=edit', (body) =>
  (Array.isArray(body) ? body : []).map((widget) => ({
    id: widget?.id || null,
    idBase: widget?.id_base || null,
    sidebar: widget?.sidebar || null,
    renderedExcerpt: compactText(widget?.rendered || '', 220),
    markers: defectMarkers(widget)
  }))
);

const navigationProbe = await probe('/wp-json/wp/v2/navigation?context=edit&per_page=100&status=publish', (body) =>
  (Array.isArray(body) ? body : []).map((navigation) => ({
    id: navigation?.id || null,
    slug: navigation?.slug || null,
    status: navigation?.status || null,
    title: compactText(textValue(navigation?.title), 120),
    contentExcerpt: compactText(textValue(navigation?.content), 300),
    markers: defectMarkers(navigation)
  }))
);

const menuLocationProbe = await probe('/wp-json/wp/v2/menu-locations?context=edit', (body) =>
  (Array.isArray(body) ? body : []).map((location) => ({
    name: location?.name || null,
    description: compactText(location?.description || '', 160),
    menuId: Number(location?.menu || 0) || null
  }))
);

const menuProbe = await probe('/wp-json/wp/v2/menus?context=edit', (body) =>
  (Array.isArray(body) ? body : []).map((menu) => ({
    id: menu?.id || null,
    name: menu?.name || null,
    slug: menu?.slug || null,
    locations: Array.isArray(menu?.locations) ? menu.locations : [],
    autoAdd: Boolean(menu?.auto_add)
  }))
);

const menuItemProbe = await probe('/wp-json/wp/v2/menu-items?context=edit&per_page=100&status=publish', (body) =>
  (Array.isArray(body) ? body : []).map((item) => ({
    id: item?.id || null,
    title: compactText(textValue(item?.title), 120),
    url: item?.url || null,
    parent: Number(item?.parent || 0),
    menuOrder: Number(item?.menu_order || 0),
    menus: Array.isArray(item?.menus) ? item.menus : [],
    status: item?.status || null,
    markers: defectMarkers(item)
  }))
);

const editableCandidates = endpointProbes
  .filter((item) => item.ok && !item.path.includes('/wc/store/'))
  .map((item) => item.path);

const presentationDefects = {
  templateMatches: (templateProbe.details || []).filter((item) => Object.values(item.markers || {}).some(Boolean)),
  templatePartMatches: (templatePartProbe.details || []).filter((item) => Object.values(item.markers || {}).some(Boolean)),
  widgetMatches: (widgetProbe.details || []).filter((item) => Object.values(item.markers || {}).some(Boolean)),
  blockNavigationMatches: (navigationProbe.details || []).filter((item) => Object.values(item.markers || {}).some(Boolean)),
  classicMenuItemMatches: (menuItemProbe.details || []).filter((item) => Object.values(item.markers || {}).some(Boolean))
};

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  mode: 'read-only',
  credentialsPresent: true,
  wordpressIndex: indexProbe,
  wordpressTypes: typeProbe,
  endpointProbes,
  editableProductApiCandidates: editableCandidates,
  presentation: {
    activeTheme: themeProbe,
    installedPlugins: pluginProbe,
    templates: templateProbe,
    templateParts: templatePartProbe,
    sidebars: sidebarProbe,
    widgets: widgetProbe,
    blockNavigation: navigationProbe,
    classicMenuLocations: menuLocationProbe,
    classicMenus: menuProbe,
    classicMenuItems: menuItemProbe,
    defectMatches: presentationDefects
  },
  writeAttempted: false,
  nextStep: 'Repair only positively identified block-template, template-part, and navigation records after backup. Page-body synchronization is already handled separately.'
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
