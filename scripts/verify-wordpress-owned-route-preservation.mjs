import { createHash } from 'node:crypto';
import dns from 'node:dns';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

dns.setDefaultResultOrder('ipv4first');

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const preservationReport = process.env.OWNED_ROUTE_PRESERVATION_REPORT || join(
  process.env.BACKUP_ROOT || '/tmp',
  'owned-route-preservation.json'
);
const expectedHomeFeaturedMedia = Number(process.env.EXPECTED_HOME_FEATURED_MEDIA || 0);

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'User-Agent': 'DTFSeeds-Owned-Route-Preservation-Verify/2.0'
};

const ownerMarkers = {
  home: ['data-dtf-layout="home-v3"'],
  learn: [
    'data-dtf-layout="learn-v3"',
    'data-dtf-learning-map="v4"',
    'data-dtf-learning-expanded-reference="v1"'
  ]
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

const report = JSON.parse(await readFile(preservationReport, 'utf8'));
if (report?.schemaVersion !== 2 || !report.routes || typeof report.routes !== 'object') {
  throw new Error(`Invalid ownership-preservation report: ${preservationReport}`);
}
if (report.siteUrl !== siteUrl) {
  throw new Error(`Ownership-preservation report site mismatch: ${report.siteUrl} != ${siteUrl}`);
}
if (!report.canonicalReconciliation?.backupDir || !report.canonicalReconciliation?.delegatedResults) {
  throw new Error('Ownership-preservation report is missing canonical transaction evidence');
}

const verified = [];
for (const slug of ['home', 'learn']) {
  const expected = report.routes[slug];
  const transaction = report.canonicalReconciliation.delegatedResults[slug];
  if (
    !expected ||
    !Number.isInteger(expected.id) ||
    !/^[a-f0-9]{64}$/.test(expected.snapshotContentSha256 || '') ||
    expected.canonicalLaneMutation !== false
  ) {
    throw new Error(`Ownership-preservation report is missing valid read-only /${slug}/ evidence`);
  }
  if (
    !transaction ||
    transaction.preserved !== true ||
    transaction.changed !== false ||
    transaction.created !== false ||
    Number(transaction.pageId) !== expected.id
  ) {
    throw new Error(`Canonical WordPress transaction did not prove delegated /${slug}/ was read-only`);
  }

  const pages = await requestJson(
    `${siteUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`,
    `Could not verify preserved WordPress /${slug}/ owner`
  );
  if (!Array.isArray(pages) || pages.length !== 1) {
    throw new Error(`Expected exactly one WordPress /${slug}/ page after reconciliation; found ${Array.isArray(pages) ? pages.length : 'invalid response'}`);
  }

  const page = pages[0];
  const content = normalizedContent(rawContent(page));
  const actualSha256 = sha256(content);
  const actualLength = Buffer.byteLength(content, 'utf8');
  const ownerAdvanced =
    actualSha256 !== expected.snapshotContentSha256 ||
    actualLength !== expected.snapshotContentLength;

  if (Number(page.id) !== expected.id) {
    throw new Error(`WordPress /${slug}/ owner changed from page ${expected.id} to ${page.id}`);
  }
  if (page.status !== 'publish') {
    throw new Error(`WordPress /${slug}/ page ${page.id} is not published: ${page.status}`);
  }
  if (!content) {
    throw new Error(`WordPress /${slug}/ page ${page.id} became empty`);
  }
  for (const marker of ownerMarkers[slug] || []) {
    if (!content.includes(marker)) {
      throw new Error(`WordPress /${slug}/ page ${page.id} is missing canonical owner marker: ${marker}`);
    }
  }
  if (slug === 'home' && expectedHomeFeaturedMedia > 0 && Number(page.featured_media || 0) !== expectedHomeFeaturedMedia) {
    throw new Error(`WordPress Home featured_media ${page.featured_media || 0} does not match DTF brand media ${expectedHomeFeaturedMedia}`);
  }

  if (ownerAdvanced) {
    console.log(`Learning owner advanced /${slug}/ after the canonical lane snapshot; accepting current owner state because transaction evidence proves the broad lane did not mutate it.`);
  }

  verified.push({
    slug,
    id: Number(page.id),
    status: page.status,
    canonicalLaneMutation: false,
    ownerAdvanced,
    snapshotContentLength: expected.snapshotContentLength,
    snapshotContentSha256: expected.snapshotContentSha256,
    currentContentLength: actualLength,
    currentContentSha256: actualSha256,
    requiredOwnerMarkers: ownerMarkers[slug] || [],
    featuredMedia: Number(page.featured_media || 0)
  });
}

console.log(JSON.stringify({
  verifiedAt: new Date().toISOString(),
  siteUrl,
  preservationReport,
  canonicalReconciliationBackup: report.canonicalReconciliation.backupDir,
  routes: verified
}, null, 2));
