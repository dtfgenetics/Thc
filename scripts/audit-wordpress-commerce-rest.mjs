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
  'User-Agent': 'DTFSeeds-WordPress-Capability-Audit/1.1'
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
    old2025Copyright: text.includes('2025') && text.includes('dtf genetics')
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

const editableCandidates = endpointProbes
  .filter((item) => item.ok && !item.path.includes('/wc/store/'))
  .map((item) => item.path);

const presentationDefects = {
  widgetMatches: (widgetProbe.details || []).filter((item) => Object.values(item.markers || {}).some(Boolean)),
  navigationMatches: (navigationProbe.details || []).filter((item) => Object.values(item.markers || {}).some(Boolean))
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
    sidebars: sidebarProbe,
    widgets: widgetProbe,
    navigation: navigationProbe,
    defectMatches: presentationDefects
  },
  writeAttempted: false,
  nextStep: editableCandidates.length
    ? 'Use the backup-first product reconciler against the confirmed authenticated endpoint. Use the presentation probes to choose a REST-safe navigation/widget repair only if the defect source is positively identified.'
    : 'Do not attempt product mutation with the current WordPress application-password path. Use WooCommerce credentials or Hostinger/WP-CLI after access is configured.'
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
