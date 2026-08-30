import dns from 'node:dns';
import fs from 'node:fs/promises';
import process from 'node:process';

dns.setDefaultResultOrder('ipv4first');

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const catalogPath = process.env.SEED_LINE_CATALOG || 'site/wordpress/products/seed-line-catalog.json';
const reportPath = process.env.GENETICS_VERIFY_REPORT || '/tmp/wordpress-genetics-production/genetics-production-verification.json';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.lines) || catalog.lines.length === 0) {
  throw new Error('Seed-line catalog is missing or invalid.');
}

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504, 520, 522, 523, 524]);
const transientCodes = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function collectErrorCodes(error, target = new Set()) {
  if (!error || typeof error !== 'object') return target;
  if (typeof error.code === 'string') target.add(error.code);
  if (error.cause && error.cause !== error) collectErrorCodes(error.cause, target);
  if (Array.isArray(error.errors)) for (const nested of error.errors) collectErrorCodes(nested, target);
  return target;
}

function isTransient(error) {
  if (!error || typeof error !== 'object') return false;
  if (Number.isInteger(error.status) && transientStatuses.has(error.status)) return true;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
  return [...collectErrorCodes(error)].some((code) => transientCodes.has(code));
}

function editableContent(page) {
  if (typeof page?.content?.raw === 'string') return page.content.raw;
  if (typeof page?.content?.rendered === 'string') return page.content.rendered;
  if (typeof page?.content === 'string') return page.content;
  return '';
}

function countWordPressImages(content) {
  return (String(content).match(/\/wp-content\/uploads\//g) || []).length;
}

async function requestJson(path, label) {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, max-age=0',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
      });
      const text = await response.text();
      if (!response.ok) {
        const error = new Error(`${label} failed (${response.status}): ${text.slice(0, 500)}`);
        error.status = response.status;
        if (!transientStatuses.has(response.status)) throw error;
        lastError = error;
      } else {
        try {
          return JSON.parse(text);
        } catch (cause) {
          const error = new Error(`${label} returned invalid JSON.`);
          error.cause = cause;
          lastError = error;
        }
      }
    } catch (error) {
      if (!isTransient(error)) throw error;
      lastError = error;
    }

    if (attempt < 8) {
      const delay = Math.min(1_500 * (2 ** (attempt - 1)), 12_000);
      console.warn(`${label} transient failure on attempt ${attempt}/8; retrying in ${delay}ms.`);
      await sleep(delay);
    }
  }
  throw lastError || new Error(`${label} failed after retries.`);
}

async function getSinglePage(slug) {
  const pages = await requestJson(
    `/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&status=publish&per_page=10`,
    `Read authoritative WordPress /${slug}/`,
  );
  if (!Array.isArray(pages) || pages.length !== 1) {
    throw new Error(`Expected exactly one published WordPress page for slug ${slug}; found ${Array.isArray(pages) ? pages.length : 'invalid response'}.`);
  }
  return pages[0];
}

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  catalogPath,
  lineCount: catalog.lines.length,
  authoritativeRest: { status: 'pending', seedsPageId: null, pages: [] },
  publicConvergence: { status: 'pending', pages: [] },
};

async function persistReport() {
  await fs.mkdir(reportPath.replace(/\/[^/]+$/, ''), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

try {
  const seedsPage = await getSinglePage('seeds');
  const seedsContent = editableContent(seedsPage);
  if (!seedsContent.includes('DTF Genetics library')) throw new Error('Authoritative /seeds/ REST content is missing the DTF Genetics library marker.');
  if (Number(seedsPage.parent || 0) !== 0) throw new Error(`Authoritative /seeds/ page ${seedsPage.id} unexpectedly has parent ${seedsPage.parent}.`);
  if (countWordPressImages(seedsContent) < catalog.lines.length) {
    throw new Error(`Authoritative /seeds/ REST content exposes ${countWordPressImages(seedsContent)} WordPress images; expected at least ${catalog.lines.length}.`);
  }
  for (const line of catalog.lines) {
    const route = `/seeds/${line.slug}/`;
    if (!seedsContent.includes(route)) throw new Error(`Authoritative /seeds/ REST content is missing ${route}.`);
  }

  report.authoritativeRest.seedsPageId = Number(seedsPage.id);
  report.authoritativeRest.pages.push({
    slug: 'seeds',
    id: Number(seedsPage.id),
    parent: Number(seedsPage.parent || 0),
    imageReferences: countWordPressImages(seedsContent),
    modifiedGmt: seedsPage.modified_gmt || null,
  });

  for (const line of catalog.lines) {
    const page = await getSinglePage(line.slug);
    const content = editableContent(page);
    if (Number(page.parent || 0) !== Number(seedsPage.id)) {
      throw new Error(`Authoritative /seeds/${line.slug}/ page ${page.id} has parent ${page.parent}; expected Seeds page ${seedsPage.id}.`);
    }
    if (!content.toLowerCase().includes(String(line.name).toLowerCase())) {
      throw new Error(`Authoritative /seeds/${line.slug}/ REST content is missing line name ${line.name}.`);
    }
    const images = countWordPressImages(content);
    if (images < 1) throw new Error(`Authoritative /seeds/${line.slug}/ REST content has no WordPress-hosted image.`);
    report.authoritativeRest.pages.push({
      slug: line.slug,
      id: Number(page.id),
      parent: Number(page.parent || 0),
      imageReferences: images,
      modifiedGmt: page.modified_gmt || null,
    });
  }

  report.authoritativeRest.status = 'verified';
  await persistReport();
  console.log(`Authoritative WordPress REST proof verified /seeds/ page ${seedsPage.id} plus ${catalog.lines.length} child profiles.`);
} catch (error) {
  report.authoritativeRest.status = 'failed';
  report.authoritativeRest.error = error?.message || String(error);
  await persistReport();
  throw error;
}

function cacheEvidence(response) {
  return {
    status: response.status,
    server: response.headers.get('server'),
    age: response.headers.get('age'),
    cacheControl: response.headers.get('cache-control'),
    liteSpeedCache: response.headers.get('x-litespeed-cache'),
    liteSpeedCacheControl: response.headers.get('x-litespeed-cache-control'),
  };
}

async function waitForPublicPage(path, required, minImages, attempts, delayMs) {
  const pageEvidence = { path, required, minImages, attempts: [] };
  let lastBody = '';
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const separator = path.includes('?') ? '&' : '?';
      const url = `${siteUrl}${path}${separator}dtf_genetics_converge=${encodeURIComponent(process.env.GITHUB_RUN_ID || 'manual')}-${attempt}-${Date.now()}`;
      const response = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
      });
      lastBody = await response.text();
      const images = countWordPressImages(lastBody);
      const hasRequired = lastBody.toLowerCase().includes(String(required).toLowerCase());
      const evidence = {
        attempt,
        at: new Date().toISOString(),
        ...cacheEvidence(response),
        bytes: Buffer.byteLength(lastBody, 'utf8'),
        imageReferences: images,
        hasRequired,
      };
      pageEvidence.attempts.push(evidence);

      if (response.ok && hasRequired && images >= minImages) {
        pageEvidence.status = 'verified';
        pageEvidence.verifiedAttempt = attempt;
        report.publicConvergence.pages.push(pageEvidence);
        return lastBody;
      }

      lastError = new Error(`Public ${path} attempt ${attempt}/${attempts} returned status ${response.status}, marker=${hasRequired}, images=${images}/${minImages}.`);
      console.warn(lastError.message);
    } catch (error) {
      lastError = error;
      pageEvidence.attempts.push({
        attempt,
        at: new Date().toISOString(),
        error: error?.message || String(error),
        codes: [...collectErrorCodes(error)],
      });
      console.warn(`Public ${path} attempt ${attempt}/${attempts} failed: ${error?.message || error}`);
    }

    if (attempt < attempts) await sleep(delayMs);
  }

  pageEvidence.status = 'failed';
  pageEvidence.lastBodyExcerpt = lastBody.slice(0, 2000);
  report.publicConvergence.pages.push(pageEvidence);
  throw lastError || new Error(`Public ${path} did not converge.`);
}

try {
  const seedsBody = await waitForPublicPage('/seeds/', 'DTF Genetics library', catalog.lines.length, 12, 10_000);
  for (const line of catalog.lines) {
    if (!seedsBody.includes(`/seeds/${line.slug}/`)) throw new Error(`Converged public /seeds/ is missing /seeds/${line.slug}/.`);
  }

  for (const line of catalog.lines) {
    await waitForPublicPage(`/seeds/${line.slug}/`, line.name, 1, 6, 7_000);
  }

  report.publicConvergence.status = 'verified';
  await persistReport();
  console.log(`Public Genetics cache convergence verified /seeds/ plus ${catalog.lines.length} child profiles.`);
} catch (error) {
  report.publicConvergence.status = 'failed';
  report.publicConvergence.error = error?.message || String(error);
  await persistReport();
  throw new Error(`Authoritative Genetics REST state is correct, but public cache convergence failed: ${error?.message || error}`);
}
