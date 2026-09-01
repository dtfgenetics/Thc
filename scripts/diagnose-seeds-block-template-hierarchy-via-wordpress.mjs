import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function wpGet(path, { attempts = 3, timeoutMs = 35_000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if (!response.ok) {
        throw new Error(`WordPress GET ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
      }
      return { status: response.status, body };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(900 + attempt * 700);
    }
  }
  throw lastError || new Error(`GET ${path} failed after retries.`);
}

function contentText(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if (typeof value.raw === 'string') return value.raw;
    if (typeof value.rendered === 'string') return value.rendered;
  }
  return '';
}

const markers = {
  stale_catalog: 'DTF Genetics catalog pages built around strain identity and grow context.',
  genetics_library: 'DTF Genetics library',
  blue_mango: 'Blue Mango',
  mango_bubbles: 'Mango Bubbles',
  grow_notes: 'Grow Notes',
};

function summarize(rawValue) {
  const raw = contentText(rawValue);
  return {
    present: raw.length > 0,
    bytes: Buffer.byteLength(raw),
    sha256: raw ? crypto.createHash('sha256').update(raw).digest('hex') : null,
    markers: Object.fromEntries(Object.entries(markers).map(([key, needle]) => [key, raw.includes(needle)])),
  };
}

function blockInventory(rawValue) {
  const raw = contentText(rawValue);
  const names = new Set();
  for (const match of raw.matchAll(/<!--\s+wp:([a-z0-9-]+(?:\/[a-z0-9-]+)?)(?:\s|\/|-->)/gi)) {
    const serialized = String(match[1] || '').toLowerCase();
    if (serialized) names.add(serialized.includes('/') ? serialized : `core/${serialized}`);
  }

  const templateParts = new Set();
  for (const match of raw.matchAll(/<!--\s+wp:template-part\s+(\{[^>]*?\})\s*\/?>/gi)) {
    try {
      const attrs = JSON.parse(match[1]);
      if (attrs?.slug) templateParts.add(String(attrs.slug));
    } catch {}
  }

  const patterns = new Set();
  for (const match of raw.matchAll(/<!--\s+wp:pattern\s+(\{[^>]*?\})\s*\/?>/gi)) {
    try {
      const attrs = JSON.parse(match[1]);
      if (attrs?.slug) patterns.add(String(attrs.slug));
    } catch {}
  }

  return {
    block_names: [...names].sort(),
    has_post_content: names.has('core/post-content'),
    template_parts: [...templateParts].sort(),
    patterns: [...patterns].sort(),
  };
}

function templateSummary(template) {
  if (!template || typeof template !== 'object') return null;
  return {
    id: template.id ?? null,
    wp_id: template.wp_id ?? null,
    slug: template.slug ?? null,
    theme: template.theme ?? null,
    type: template.type ?? null,
    source: template.source ?? null,
    origin: template.origin ?? null,
    status: template.status ?? null,
    is_custom: template.is_custom ?? null,
    has_theme_file: template.has_theme_file ?? null,
    modified: template.modified ?? null,
    content: summarize(template.content),
    blocks: blockInventory(template.content),
  };
}

function hasRelevantMarker(summary) {
  return Boolean(summary?.content?.markers?.stale_catalog ||
    summary?.content?.markers?.genetics_library ||
    summary?.content?.markers?.blue_mango ||
    summary?.content?.markers?.mango_bubbles);
}

async function probePublicSeeds() {
  const nonce = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const response = await fetch(`${siteUrl}/seeds/?dtf_block_template_probe=${nonce}`, {
    redirect: 'follow',
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
      'User-Agent': 'DTFSeeds-Block-Template-Diagnostic/2.0',
    },
    signal: AbortSignal.timeout(35_000),
  });
  const text = await response.text();
  return {
    status: response.status,
    content_type: response.headers.get('content-type'),
    lite_speed_cache: response.headers.get('x-litespeed-cache'),
    ...summarize(text),
  };
}

const pagesResult = await wpGet('/wp-json/wp/v2/pages?slug=seeds&context=edit&per_page=10&_fields=id,slug,status,modified_gmt,template,link,content');
const pages = Array.isArray(pagesResult.body) ? pagesResult.body : [];
const page = pages.find((item) => item?.slug === 'seeds') || pages[0];
if (!page?.id) throw new Error('Published Seeds page could not be resolved through WordPress REST.');

const pageId = Number(page.id);
const candidateSlugs = ['page-seeds', `page-${pageId}`, 'page', 'singular', 'index'];

const [templatesResult, partsResult, publicState] = await Promise.all([
  wpGet('/wp-json/wp/v2/templates?context=edit'),
  wpGet('/wp-json/wp/v2/template-parts?context=edit'),
  probePublicSeeds(),
]);

const templates = Array.isArray(templatesResult.body) ? templatesResult.body : [];
const parts = Array.isArray(partsResult.body) ? partsResult.body : [];

const summarizedTemplates = templates.map(templateSummary).filter(Boolean);
const summarizedParts = parts.map(templateSummary).filter(Boolean);
const candidates = Object.fromEntries(candidateSlugs.map((slug) => [
  slug,
  summarizedTemplates.find((template) => template.slug === slug) || null,
]));
const selectedCandidateSlug = candidateSlugs.find((slug) => candidates[slug]) || null;
const selectedCandidate = selectedCandidateSlug ? candidates[selectedCandidateSlug] : null;

const referencedPartSlugs = new Set();
for (const candidate of Object.values(candidates)) {
  for (const slug of candidate?.blocks?.template_parts || []) referencedPartSlugs.add(slug);
}

const matchingTemplates = summarizedTemplates.filter((template) =>
  candidateSlugs.includes(String(template.slug || '')) || hasRelevantMarker(template));
const matchingParts = summarizedParts.filter((part) =>
  referencedPartSlugs.has(String(part.slug || '')) || hasRelevantMarker(part));

console.log(JSON.stringify({
  ok: true,
  generated_at: new Date().toISOString(),
  transport: 'native-wordpress-rest',
  page: {
    id: pageId,
    slug: page.slug || null,
    status: page.status || null,
    modified_gmt: page.modified_gmt || null,
    template: page.template ?? null,
    link: page.link || null,
    content: summarize(page.content),
  },
  hierarchy_order: candidateSlugs,
  candidate_hierarchy: candidates,
  inferred_selected_candidate_slug: selectedCandidateSlug,
  inferred_selected_candidate: selectedCandidate,
  matching_templates: matchingTemplates,
  matching_template_parts: matchingParts,
  template_counts: {
    templates: summarizedTemplates.length,
    template_parts: summarizedParts.length,
  },
  public_state: publicState,
}, null, 2));
