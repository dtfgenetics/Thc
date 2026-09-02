import { createHash } from 'node:crypto';
import dns from 'node:dns';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';

dns.setDefaultResultOrder('ipv4first');

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const sourceDir = process.env.CONTENT_DIR || '';
const visualCssPath = process.env.DTF_VISUAL_CSS || join(process.cwd(), 'site/design-system/dtf-visual-v1.css');
const preservationReport = process.env.OWNED_ROUTE_PRESERVATION_REPORT || join(
  process.env.BACKUP_ROOT || tmpdir(),
  'owned-route-preservation.json'
);

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
if (!sourceDir) throw new Error('CONTENT_DIR is required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Ownership-Preserving-Reconcile/1.1'
};

const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504, 520, 522, 523, 524]);
const transientCodes = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENETDOWN',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET'
]);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectErrorCodes(error, target = new Set()) {
  if (!error || typeof error !== 'object') return target;
  if (typeof error.code === 'string') target.add(error.code);
  if (error.cause && error.cause !== error) collectErrorCodes(error.cause, target);
  if (Array.isArray(error.errors)) {
    for (const nested of error.errors) collectErrorCodes(nested, target);
  }
  return target;
}

function isTransientError(error) {
  if (!error || typeof error !== 'object') return false;
  if (Number.isInteger(error.status) && transientStatuses.has(error.status)) return true;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
  return [...collectErrorCodes(error)].some((code) => transientCodes.has(code));
}

async function requestJson(url, label) {
  let lastError;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000)
      });
      const text = await response.text();

      if (!response.ok) {
        const error = new Error(`${label} (${response.status})`);
        error.status = response.status;
        error.responseBody = text.slice(0, 500);
        if (!transientStatuses.has(response.status)) throw error;
        lastError = error;
      } else {
        try {
          return JSON.parse(text);
        } catch (cause) {
          const error = new Error(`${label} returned invalid JSON`);
          error.cause = cause;
          error.responseBody = text.slice(0, 500);
          lastError = error;
        }
      }
    } catch (error) {
      if (!isTransientError(error)) throw error;
      lastError = error;
    }

    if (attempt < 8) {
      const delayMs = Math.min(1_500 * (2 ** (attempt - 1)), 12_000);
      const codes = [...collectErrorCodes(lastError)].join(',') || 'HTTP/parse';
      console.warn(`${label} transient failure on attempt ${attempt}/8 (${codes}); retrying in ${delayMs}ms.`);
      await wait(delayMs);
    }
  }

  throw lastError || new Error(`${label} failed after 8 attempts`);
}

async function getPage(slug) {
  const pages = await requestJson(
    `${siteUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`,
    `Could not read WordPress /${slug}/ before reconciliation`
  );
  if (!Array.isArray(pages) || pages.length !== 1) {
    throw new Error(`Expected exactly one published WordPress owner for /${slug}/; found ${Array.isArray(pages) ? pages.length : 'invalid response'}`);
  }
  return pages[0];
}

function rawContent(page) {
  const content = page?.content;
  if (content && typeof content === 'object' && typeof content.raw === 'string') return content.raw;
  if (content && typeof content === 'object' && typeof content.rendered === 'string') return content.rendered;
  if (typeof content === 'string') return content;
  throw new Error(`WordPress page ${page?.id || 'unknown'} did not expose editable content`);
}

function normalizedContent(content) {
  return String(content || '').trim();
}

function sha256(content) {
  return createHash('sha256').update(normalizedContent(content), 'utf8').digest('hex');
}

const ownedDir = await mkdtemp(join(tmpdir(), 'dtf-wordpress-owned-routes-'));
await cp(sourceDir, ownedDir, { recursive: true });

const preservation = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  siteUrl,
  routes: {}
};

// Learning Experience V3 is the automatic owner of both Home and Learn.
// Preserve the exact currently stored content while the broad WordPress lane
// reconciles community, shop, gallery, about, contact, blog and front-page state.
for (const slug of ['home', 'learn']) {
  const page = await getPage(slug);
  const content = normalizedContent(rawContent(page));
  if (!content) throw new Error(`Refusing to preserve empty /${slug}/ content`);
  preservation.routes[slug] = {
    id: Number(page.id),
    slug,
    status: page.status || 'unknown',
    contentLength: Buffer.byteLength(content, 'utf8'),
    contentSha256: sha256(content)
  };
  await writeFile(join(ownedDir, `${slug}.html`), `${content}\n`, 'utf8');
  console.log(`Preserved Learning-owned /${slug}/ content from WordPress page ${page.id} (${preservation.routes[slug].contentSha256}).`);
}

// Canonical editorial roots consume the accepted DTF visual system from one
// source-controlled stylesheet. Home/Learn/Seeds/Games remain delegated to
// their dedicated owners and are intentionally not rewritten here.
const visualCss = await readFile(visualCssPath, 'utf8');
const visualStyleTag = `<style id="dtf-visual-v1">${visualCss}</style>`;
for (const slug of ['community', 'gallery', 'about', 'contact']) {
  const file = join(ownedDir, `${slug}.html`);
  const content = await readFile(file, 'utf8');
  if (!content.includes('class="dtf-v1"')) continue;
  const cleaned = content.replace(/<style id="dtf-visual-v1">[\s\S]*?<\/style>\s*/i, '');
  await writeFile(file, `${visualStyleTag}\n${cleaned.trim()}\n`, 'utf8');
  console.log(`Applied shared DTF visual system to canonical /${slug}/ source.`);
}

await mkdir(dirname(preservationReport), { recursive: true });
await writeFile(preservationReport, `${JSON.stringify(preservation, null, 2)}\n`, 'utf8');
console.log(`Ownership-preservation evidence: ${preservationReport}`);

process.env.CONTENT_DIR = ownedDir;
await import('./apply-wordpress-public-content-rest.mjs');
