import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_HOME_FEATURED_MEDIA_GUARD || '').toLowerCase() === 'true';
const reportPath = process.env.HOME_FEATURED_MEDIA_REPORT || '/tmp/dtf-learning-v4-final/home-featured-media-guard.json';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'User-Agent': 'DTFSeeds-Home-Featured-Media-Guard/1.0',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if ((response.status === 429 || response.status >= 500) && attempt < 6) {
        await sleep(attempt * 1500);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status})`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 6) {
        await sleep(attempt * 1500);
        continue;
      }
    }
  }
  throw lastError;
}

function rendered(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.raw || value.rendered || '';
  return '';
}

const pages = await request('/wp-json/wp/v2/pages?slug=home&context=edit&status=publish&per_page=20');
const roots = (Array.isArray(pages) ? pages : []).filter((page) => Number(page.parent || 0) === 0);
if (roots.length !== 1) throw new Error(`Expected exactly one published root Home page; found ${roots.length}`);

const home = roots[0];
const beforeFeaturedMedia = Number(home.featured_media || 0);
let attachment = null;
if (beforeFeaturedMedia > 0) {
  try {
    attachment = await request(`/wp-json/wp/v2/media/${beforeFeaturedMedia}?context=edit`);
  } catch (error) {
    attachment = { lookupError: error.message };
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  apply,
  homePageId: home.id,
  homeLayoutMarker: rendered(home.content).includes('data-dtf-layout="home-v3"'),
  beforeFeaturedMedia,
  attachment: attachment ? {
    id: attachment.id || beforeFeaturedMedia,
    slug: attachment.slug || '',
    title: rendered(attachment.title),
    altText: attachment.alt_text || '',
    sourceUrl: attachment.source_url || '',
    lookupError: attachment.lookupError || null
  } : null,
  action: beforeFeaturedMedia > 0 ? 'clear-home-featured-media' : 'already-clear'
};

if (!report.homeLayoutMarker) {
  throw new Error('Root Home page is not the canonical home-v3 owner; refusing featured-media mutation.');
}

if (apply && beforeFeaturedMedia > 0) {
  await request(`/wp-json/wp/v2/pages/${home.id}`, {
    method: 'POST',
    body: JSON.stringify({ featured_media: 0, status: 'publish' })
  });
}

const verifyPages = await request('/wp-json/wp/v2/pages?slug=home&context=edit&status=publish&per_page=20');
const verifyRoots = (Array.isArray(verifyPages) ? verifyPages : []).filter((page) => Number(page.parent || 0) === 0);
if (verifyRoots.length !== 1) throw new Error(`Expected exactly one published root Home page after guard; found ${verifyRoots.length}`);
report.afterFeaturedMedia = Number(verifyRoots[0].featured_media || 0);
report.verified = report.afterFeaturedMedia === 0;

if (apply && !report.verified) throw new Error(`Home featured-media guard failed; Home still references media ${report.afterFeaturedMedia}`);

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
